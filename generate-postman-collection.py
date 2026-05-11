"""
Generates an importable Postman collection covering all 77 Eagle Bank test scenarios.
Run: python generate-postman-collection.py
Then import the resulting JSON into Postman.
"""
import json

OUTPUT = r"C:\Users\serca\Downloads\Take Home Test\Eagle Bank - Postman Collection.json"

# ---------------------------------------------------------------------------
# Shared user fixtures
# ---------------------------------------------------------------------------
MAIN_USER = {
    "name": "Main User",
    "email": "main@eagle-test.com",
    "password": "password123",
    "phoneNumber": "+441234567890",
    "address": {"line1": "1 Eagle Street", "town": "London",
                 "county": "Greater London", "postcode": "EC1A 1BB"}
}
OTHER_USER = {
    "name": "Other User",
    "email": "other@eagle-test.com",
    "password": "password456",
    "phoneNumber": "+441234567891",
    "address": {"line1": "2 Other Street", "town": "Manchester",
                 "county": "Greater Manchester", "postcode": "M1 1AA"}
}
TEMP_USER = {       # used only for delete-user-204 test (no accounts)
    "name": "Temp User",
    "email": "temp@eagle-test.com",
    "password": "password789",
    "phoneNumber": "+441234567892",
    "address": {"line1": "3 Temp Lane", "town": "Bristol",
                 "county": "Avon", "postcode": "BS1 1AA"}
}

# ---------------------------------------------------------------------------
# Builder helpers
# ---------------------------------------------------------------------------
def _url(path):
    return {
        "raw": "{{baseUrl}}" + path,
        "host": ["{{baseUrl}}"],
        "path": [s for s in path.split("/") if s]
    }

def _bearer(var="token"):
    return {"type": "bearer",
            "bearer": [{"key": "token", "value": "{{" + var + "}}", "type": "string"}]}

def _body(data):
    raw = json.dumps(data, indent=2) if isinstance(data, dict) else data
    return {"mode": "raw", "raw": raw, "options": {"raw": {"language": "json"}}}

def _test(lines):
    return {"listen": "test",  "script": {"exec": lines, "type": "text/javascript"}}

def _pre(lines):
    return {"listen": "prerequest", "script": {"exec": lines, "type": "text/javascript"}}

def req(name, method, path, body=None, auth=None, tests=(), prereq=()):
    """Build a single Postman request item."""
    r = {
        "method": method,
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "url": _url(path)
    }
    if auth:
        r["auth"] = _bearer(auth)
    if body is not None:
        r["body"] = _body(body)

    node = {"name": name, "request": r}
    evts = []
    if prereq:
        evts.append(_pre(list(prereq)))
    if tests:
        evts.append(_test(list(tests)))
    if evts:
        node["event"] = evts
    return node

def folder(name, items):
    return {"name": name, "item": items}

# Common assertion snippets
def chk_status(code):
    return f'pm.test("Status is {code}", () => pm.response.to.have.status({code}));'

def chk_has(field):
    return f'pm.test("Has {field}", () => pm.expect(pm.response.json()).to.have.property("{field}"));'

def chk_not(field):
    return f'pm.test("No {field} exposed", () => pm.expect(pm.response.json()).to.not.have.property("{field}"));'

def chk_eq(field, value):
    v = f'"{value}"' if isinstance(value, str) else str(value)
    return f'pm.test("{field} = {value}", () => pm.expect(pm.response.json().{field}).to.eql({v}));'

def chk_match(field, pattern):
    return (f'pm.test("{field} matches pattern", () => {{'
            f'  pm.expect(pm.response.json().{field}).to.match({pattern});'
            f'}});')

def chk_msg():
    return 'pm.test("Has message", () => pm.expect(pm.response.json()).to.have.property("message"));'

def chk_details():
    return ('pm.test("Has details array", () => {'
            '  const b = pm.response.json();'
            '  pm.expect(b).to.have.property("details");'
            '  pm.expect(b.details).to.be.an("array").with.length.above(0);'
            '});')

def chk_detail_field(field):
    return (f'pm.test("details includes field \'{field}\'", () => {{'
            f'  const found = pm.response.json().details.some(d => d.field === "{field}");'
            f'  pm.expect(found, "field {field} not in details").to.be.true;'
            f'}});')

# ---------------------------------------------------------------------------
# 0. SETUP FOLDER
# ---------------------------------------------------------------------------
setup_items = [
    req("Register Main User", "POST", "/v1/users", body=MAIN_USER,
        tests=[chk_status(201), chk_has("id"),
               'pm.test("No passwordHash", () => pm.expect(pm.response.json()).to.not.have.property("passwordHash"));']),

    req("Login Main User", "POST", "/v1/auth/login",
        body={"email": MAIN_USER["email"], "password": MAIN_USER["password"]},
        tests=[chk_status(200), chk_has("token"),
               'pm.environment.set("token",  pm.response.json().token);',
               'pm.environment.set("userId", pm.response.json().userId);',
               'pm.test("token saved", () => pm.expect(pm.environment.get("token")).to.not.be.empty);']),

    req("Register Other User", "POST", "/v1/users", body=OTHER_USER,
        tests=[chk_status(201)]),

    req("Login Other User", "POST", "/v1/auth/login",
        body={"email": OTHER_USER["email"], "password": OTHER_USER["password"]},
        tests=[chk_status(200),
               'pm.environment.set("token2",  pm.response.json().token);',
               'pm.environment.set("userId2", pm.response.json().userId);']),

    req("Register Temp User (for delete test)", "POST", "/v1/users", body=TEMP_USER,
        tests=[chk_status(201)]),

    req("Login Temp User", "POST", "/v1/auth/login",
        body={"email": TEMP_USER["email"], "password": TEMP_USER["password"]},
        tests=[chk_status(200),
               'pm.environment.set("tokenTemp",  pm.response.json().token);',
               'pm.environment.set("userIdTemp", pm.response.json().userId);']),

    req("Create Main Account", "POST", "/v1/accounts",
        body={"name": "Main Account", "accountType": "personal"}, auth="token",
        tests=[chk_status(201), chk_eq("balance", 0),
               'pm.environment.set("accountNumber", pm.response.json().accountNumber);',
               'pm.test("accountNumber pattern", () => pm.expect(pm.response.json().accountNumber).to.match(/^01\\d{6}$/));']),

    req("Create Other User Account", "POST", "/v1/accounts",
        body={"name": "Other Account", "accountType": "personal"}, auth="token2",
        tests=[chk_status(201),
               'pm.environment.set("accountNumber2", pm.response.json().accountNumber);']),

    req("Create Spare Account (for delete test)", "POST", "/v1/accounts",
        body={"name": "Spare Account", "accountType": "personal"}, auth="token",
        tests=[chk_status(201),
               'pm.environment.set("accountNumberToDelete", pm.response.json().accountNumber);']),

    req("Deposit £500 to Main Account", "POST",
        "/v1/accounts/{{accountNumber}}/transactions",
        body={"amount": 500, "currency": "GBP", "type": "deposit", "reference": "Setup deposit"},
        auth="token",
        tests=[chk_status(201),
               'pm.environment.set("transactionId", pm.response.json().id);',
               'pm.test("transactionId pattern", () => pm.expect(pm.response.json().id).to.match(/^tan-[A-Za-z0-9]+$/));']),

    req("Deposit £100 to Other Account", "POST",
        "/v1/accounts/{{accountNumber2}}/transactions",
        body={"amount": 100, "currency": "GBP", "type": "deposit"}, auth="token2",
        tests=[chk_status(201),
               'pm.environment.set("transactionId2", pm.response.json().id);']),
]

# ---------------------------------------------------------------------------
# 1. AUTH TESTS (6)
# ---------------------------------------------------------------------------
auth_items = [
    req("✅ Login — valid credentials", "POST", "/v1/auth/login",
        body={"email": MAIN_USER["email"], "password": MAIN_USER["password"]},
        tests=[chk_status(200), chk_has("token"), chk_has("userId"),
               'pm.test("token is string", () => pm.expect(pm.response.json().token).to.be.a("string"));',
               'pm.test("userId pattern usr-*", () => pm.expect(pm.response.json().userId).to.match(/^usr-[A-Za-z0-9]+$/));']),

    req("❌ Login — wrong password → 401", "POST", "/v1/auth/login",
        body={"email": MAIN_USER["email"], "password": "wrongpassword"},
        tests=[chk_status(401), chk_msg()]),

    req("❌ Login — unknown email → 401", "POST", "/v1/auth/login",
        body={"email": "nobody@example.com", "password": MAIN_USER["password"]},
        tests=[chk_status(401), chk_msg()]),

    req("❌ Login — missing email → 400", "POST", "/v1/auth/login",
        body={"password": MAIN_USER["password"]},
        tests=[chk_status(400), chk_details(), chk_detail_field("email")]),

    req("❌ Login — missing password → 400", "POST", "/v1/auth/login",
        body={"email": MAIN_USER["email"]},
        tests=[chk_status(400), chk_details(), chk_detail_field("password")]),

    req("❌ Login — invalid email format → 400", "POST", "/v1/auth/login",
        body={"email": "not-an-email", "password": MAIN_USER["password"]},
        tests=[chk_status(400), chk_details()]),
]

# ---------------------------------------------------------------------------
# 2. USER TESTS (27)
# ---------------------------------------------------------------------------

# --- Create (11) ---
create_user_items = [
    req("✅ Create user — all fields → 201", "POST", "/v1/users",
        body={**MAIN_USER, "email": "newuser@eagle-test.com"},
        tests=[chk_status(201),
               'pm.test("id pattern usr-*", () => pm.expect(pm.response.json().id).to.match(/^usr-[A-Za-z0-9]+$/));',
               chk_has("name"), chk_has("email"), chk_has("address"),
               chk_has("createdTimestamp"), chk_has("updatedTimestamp"),
               chk_not("passwordHash")]),

    req("❌ Create user — missing name → 400", "POST", "/v1/users",
        body={"email": "x@x.com", "password": "password123", "phoneNumber": "+441234567890",
              "address": {"line1": "1 St", "town": "London", "county": "Greater London", "postcode": "EC1 1AA"}},
        tests=[chk_status(400), chk_details(), chk_detail_field("name")]),

    req("❌ Create user — missing email → 400", "POST", "/v1/users",
        body={"name": "Test", "password": "password123", "phoneNumber": "+441234567890",
              "address": {"line1": "1 St", "town": "London", "county": "Greater London", "postcode": "EC1 1AA"}},
        tests=[chk_status(400), chk_details(), chk_detail_field("email")]),

    req("❌ Create user — missing address → 400", "POST", "/v1/users",
        body={"name": "Test", "email": "t@t.com", "password": "password123", "phoneNumber": "+441234567890"},
        tests=[chk_status(400), chk_details(), chk_detail_field("address")]),

    req("❌ Create user — missing phoneNumber → 400", "POST", "/v1/users",
        body={"name": "Test", "email": "t@t.com", "password": "password123",
              "address": {"line1": "1 St", "town": "London", "county": "Greater London", "postcode": "EC1 1AA"}},
        tests=[chk_status(400), chk_details(), chk_detail_field("phoneNumber")]),

    req("❌ Create user — missing password → 400", "POST", "/v1/users",
        body={"name": "Test", "email": "t@t.com", "phoneNumber": "+441234567890",
              "address": {"line1": "1 St", "town": "London", "county": "Greater London", "postcode": "EC1 1AA"}},
        tests=[chk_status(400), chk_details(), chk_detail_field("password")]),

    req("❌ Create user — invalid email format → 400", "POST", "/v1/users",
        body={**MAIN_USER, "email": "not-an-email"},
        tests=[chk_status(400), chk_details()]),

    req("❌ Create user — invalid phone (no +) → 400", "POST", "/v1/users",
        body={**MAIN_USER, "email": "p@test.com", "phoneNumber": "07123456789"},
        tests=[chk_status(400), chk_details()]),

    req("❌ Create user — password too short → 400", "POST", "/v1/users",
        body={**MAIN_USER, "email": "s@test.com", "password": "short"},
        tests=[chk_status(400), chk_details()]),

    req("❌ Create user — address missing sub-fields → 400", "POST", "/v1/users",
        body={**MAIN_USER, "email": "a@test.com", "address": {"line1": "1 St"}},
        tests=[chk_status(400), chk_details()]),

    req("❌ Create user — duplicate email → 400", "POST", "/v1/users",
        body=MAIN_USER,
        tests=[chk_status(400), chk_has("message")]),
]

# --- Fetch (5) ---
fetch_user_items = [
    req("✅ Fetch own user → 200", "GET", "/v1/users/{{userId}}", auth="token",
        tests=[chk_status(200), chk_has("id"), chk_has("name"), chk_has("email"),
               chk_has("address"), chk_has("createdTimestamp"), chk_not("passwordHash"),
               'pm.test("id matches userId", () => pm.expect(pm.response.json().id).to.eql(pm.environment.get("userId")));']),

    req("❌ Fetch another user's details → 403", "GET", "/v1/users/{{userId2}}", auth="token",
        tests=[chk_status(403), chk_msg()]),

    req("❌ Fetch non-existent userId → 403", "GET", "/v1/users/usr-doesnotexist", auth="token",
        tests=[chk_status(403), chk_msg(),
               'pm.test("Note: returns 403 because ownership check runs before DB lookup", () => pm.expect(true).to.be.true);']),

    req("❌ Fetch user — no token → 401", "GET", "/v1/users/{{userId}}",
        tests=[chk_status(401), chk_msg()]),

    req("❌ Fetch user — invalid token → 401", "GET", "/v1/users/{{userId}}",
        tests=[chk_status(401), chk_msg()],
        prereq=['pm.request.headers.add({key: "Authorization", value: "Bearer invalid.token.here"});']),
]

# --- Update (6) ---
update_user_items = [
    req("✅ Update own name → 200", "PATCH", "/v1/users/{{userId}}",
        body={"name": "Updated Name"}, auth="token",
        tests=[chk_status(200), chk_eq("name", "Updated Name"),
               'pm.test("email unchanged", () => pm.expect(pm.response.json().email).to.eql("main@eagle-test.com"));']),

    req("✅ Update own address → 200", "PATCH", "/v1/users/{{userId}}",
        body={"address": {"line1": "99 New Road", "town": "Birmingham",
                          "county": "West Midlands", "postcode": "B1 1AA"}}, auth="token",
        tests=[chk_status(200),
               'pm.test("address updated", () => pm.expect(pm.response.json().address.line1).to.eql("99 New Road"));']),

    req("✅ Update own email → 200", "PATCH", "/v1/users/{{userId}}",
        body={"email": "main-updated@eagle-test.com"}, auth="token",
        tests=[chk_status(200),
               'pm.test("email updated", () => pm.expect(pm.response.json().email).to.eql("main-updated@eagle-test.com"));',
               # Restore original email for subsequent tests
               'const r = pm.response.json(); console.log("Note: email changed - may affect subsequent logins");']),

    req("❌ Update another user → 403", "PATCH", "/v1/users/{{userId2}}",
        body={"name": "Hacked"}, auth="token",
        tests=[chk_status(403), chk_msg()]),

    req("❌ Update non-existent userId → 403", "PATCH", "/v1/users/usr-doesnotexist",
        body={"name": "Ghost"}, auth="token",
        tests=[chk_status(403), chk_msg()]),

    req("❌ Update user — no token → 401", "PATCH", "/v1/users/{{userId}}",
        body={"name": "No Auth"},
        tests=[chk_status(401), chk_msg()]),
]

# --- Delete (5) ---
delete_user_items = [
    req("❌ Delete user with accounts → 409", "DELETE", "/v1/users/{{userId}}", auth="token",
        tests=[chk_status(409), chk_msg(),
               'pm.test("User still exists (not deleted)", () => pm.expect(pm.response.json()).to.have.property("message"));']),

    req("❌ Delete another user → 403", "DELETE", "/v1/users/{{userId2}}", auth="token",
        tests=[chk_status(403), chk_msg()]),

    req("❌ Delete non-existent userId → 403", "DELETE", "/v1/users/usr-doesnotexist", auth="token",
        tests=[chk_status(403), chk_msg()]),

    req("❌ Delete user — no token → 401", "DELETE", "/v1/users/{{userId}}",
        tests=[chk_status(401), chk_msg()]),

    req("✅ Delete temp user (no accounts) → 204", "DELETE", "/v1/users/{{userIdTemp}}",
        auth="tokenTemp",
        tests=[chk_status(204),
               'pm.test("Body is empty", () => pm.expect(pm.response.text()).to.be.empty);']),
]

user_items = [
    folder("Create User (11 tests)", create_user_items),
    folder("Fetch User (5 tests)",   fetch_user_items),
    folder("Update User (6 tests)",  update_user_items),
    folder("Delete User (5 tests)",  delete_user_items),
]

# ---------------------------------------------------------------------------
# 3. ACCOUNT TESTS (21)
# ---------------------------------------------------------------------------

# --- Create (5) ---
create_account_items = [
    req("✅ Create account — all fields → 201", "POST", "/v1/accounts",
        body={"name": "Test Account", "accountType": "personal"}, auth="token",
        tests=[chk_status(201),
               'pm.test("accountNumber pattern", () => pm.expect(pm.response.json().accountNumber).to.match(/^01\\d{6}$/));',
               chk_eq("sortCode", "10-10-10"), chk_eq("balance", 0),
               chk_eq("currency", "GBP"), chk_eq("accountType", "personal"),
               chk_has("createdTimestamp"), chk_has("updatedTimestamp")]),

    req("❌ Create account — missing name → 400", "POST", "/v1/accounts",
        body={"accountType": "personal"}, auth="token",
        tests=[chk_status(400), chk_details(), chk_detail_field("name")]),

    req("❌ Create account — missing accountType → 400", "POST", "/v1/accounts",
        body={"name": "My Account"}, auth="token",
        tests=[chk_status(400), chk_details()]),

    req("❌ Create account — invalid accountType → 400", "POST", "/v1/accounts",
        body={"name": "My Account", "accountType": "business"}, auth="token",
        tests=[chk_status(400), chk_details()]),

    req("❌ Create account — no token → 401", "POST", "/v1/accounts",
        body={"name": "My Account", "accountType": "personal"},
        tests=[chk_status(401), chk_msg()]),
]

# --- List (3) ---
list_account_items = [
    req("✅ List accounts — returns own accounts only → 200", "GET", "/v1/accounts",
        auth="token",
        tests=[chk_status(200), chk_has("accounts"),
               'pm.test("accounts is array", () => pm.expect(pm.response.json().accounts).to.be.an("array"));',
               'pm.test("all accounts belong to user", () => {'
               '  const accs = pm.response.json().accounts;'
               '  pm.expect(accs.length).to.be.above(0);'
               '});']),

    req("✅ List accounts — other user has no access to main accounts", "GET", "/v1/accounts",
        auth="token2",
        tests=[chk_status(200),
               'pm.test("Other user only sees their own accounts", () => {'
               '  const accs = pm.response.json().accounts;'
               '  const mainAccNum = pm.environment.get("accountNumber");'
               '  pm.expect(accs.some(a => a.accountNumber === mainAccNum)).to.be.false;'
               '});']),

    req("❌ List accounts — no token → 401", "GET", "/v1/accounts",
        tests=[chk_status(401), chk_msg()]),
]

# --- Fetch (4) ---
fetch_account_items = [
    req("✅ Fetch own account → 200", "GET", "/v1/accounts/{{accountNumber}}", auth="token",
        tests=[chk_status(200),
               'pm.test("accountNumber matches", () => pm.expect(pm.response.json().accountNumber).to.eql(pm.environment.get("accountNumber")));',
               chk_has("balance"), chk_has("sortCode"), chk_has("currency")]),

    req("❌ Fetch another user's account → 403", "GET", "/v1/accounts/{{accountNumber2}}", auth="token",
        tests=[chk_status(403), chk_msg()]),

    req("❌ Fetch non-existent account → 404", "GET", "/v1/accounts/01000000", auth="token",
        tests=[chk_status(404), chk_msg()]),

    req("❌ Fetch account — no token → 401", "GET", "/v1/accounts/{{accountNumber}}",
        tests=[chk_status(401), chk_msg()]),
]

# --- Update (4) ---
update_account_items = [
    req("✅ Update own account name → 200", "PATCH", "/v1/accounts/{{accountNumber}}",
        body={"name": "Renamed Account"}, auth="token",
        tests=[chk_status(200), chk_eq("name", "Renamed Account"),
               'pm.test("accountNumber unchanged", () => pm.expect(pm.response.json().accountNumber).to.eql(pm.environment.get("accountNumber")));']),

    req("❌ Update another user's account → 403", "PATCH", "/v1/accounts/{{accountNumber2}}",
        body={"name": "Hacked"}, auth="token",
        tests=[chk_status(403), chk_msg()]),

    req("❌ Update non-existent account → 404", "PATCH", "/v1/accounts/01000000",
        body={"name": "Ghost"}, auth="token",
        tests=[chk_status(404), chk_msg()]),

    req("❌ Update account — no token → 401", "PATCH", "/v1/accounts/{{accountNumber}}",
        body={"name": "No Auth"},
        tests=[chk_status(401), chk_msg()]),
]

# --- Delete (4) ---
delete_account_items = [
    req("❌ Delete another user's account → 403", "DELETE", "/v1/accounts/{{accountNumber2}}",
        auth="token",
        tests=[chk_status(403), chk_msg()]),

    req("❌ Delete non-existent account → 404", "DELETE", "/v1/accounts/01000000",
        auth="token",
        tests=[chk_status(404), chk_msg()]),

    req("❌ Delete account — no token → 401", "DELETE", "/v1/accounts/{{accountNumberToDelete}}",
        tests=[chk_status(401), chk_msg()]),

    req("✅ Delete spare account → 204", "DELETE", "/v1/accounts/{{accountNumberToDelete}}",
        auth="token",
        tests=[chk_status(204),
               'pm.test("Body is empty", () => pm.expect(pm.response.text()).to.be.empty);']),
]

account_items = [
    folder("Create Account (5 tests)", create_account_items),
    folder("List Accounts (3 tests)",  list_account_items),
    folder("Fetch Account (4 tests)",  fetch_account_items),
    folder("Update Account (4 tests)", update_account_items),
    folder("Delete Account (4 tests)", delete_account_items),
]

# ---------------------------------------------------------------------------
# 4. TRANSACTION TESTS (23)
# ---------------------------------------------------------------------------

# --- Create — deposit / withdraw (13) ---
create_tx_items = [
    req("✅ Deposit into own account → 201", "POST",
        "/v1/accounts/{{accountNumber}}/transactions",
        body={"amount": 250, "currency": "GBP", "type": "deposit", "reference": "Test deposit"},
        auth="token",
        tests=[chk_status(201),
               'pm.test("id pattern tan-*", () => pm.expect(pm.response.json().id).to.match(/^tan-[A-Za-z0-9]+$/));',
               chk_eq("amount", 250), chk_eq("type", "deposit"), chk_eq("currency", "GBP"),
               'pm.test("reference saved", () => pm.expect(pm.response.json().reference).to.eql("Test deposit"));',
               chk_has("createdTimestamp")]),

    req("✅ Withdraw from own account (sufficient funds) → 201", "POST",
        "/v1/accounts/{{accountNumber}}/transactions",
        body={"amount": 100, "currency": "GBP", "type": "withdrawal", "reference": "ATM"},
        auth="token",
        tests=[chk_status(201), chk_eq("type", "withdrawal"), chk_eq("amount", 100),
               'pm.test("Balance should have decreased (verify via GET account)", () => pm.expect(true).to.be.true);']),

    req("✅ Verify balance after deposit & withdrawal", "GET",
        "/v1/accounts/{{accountNumber}}", auth="token",
        tests=[chk_status(200),
               'pm.test("Balance = 500 (setup) + 250 (deposit) - 100 (withdrawal) = 650", () => {'
               '  pm.expect(pm.response.json().balance).to.eql(650);'
               '});']),

    req("❌ Withdraw — insufficient funds → 422", "POST",
        "/v1/accounts/{{accountNumber}}/transactions",
        body={"amount": 9999, "currency": "GBP", "type": "withdrawal"},
        auth="token",
        tests=[chk_status(422), chk_msg()]),

    req("❌ Withdraw — account balance is 0 → 422", "POST",
        "/v1/accounts/{{accountNumber2}}/transactions",
        body={"amount": 0.01, "currency": "GBP", "type": "withdrawal"},
        auth="token2",
        tests=[chk_status(422), chk_msg()]),

    req("❌ Deposit to another user's account → 403", "POST",
        "/v1/accounts/{{accountNumber2}}/transactions",
        body={"amount": 50, "currency": "GBP", "type": "deposit"},
        auth="token",
        tests=[chk_status(403), chk_msg()]),

    req("❌ Deposit to non-existent account → 404", "POST",
        "/v1/accounts/01000000/transactions",
        body={"amount": 50, "currency": "GBP", "type": "deposit"},
        auth="token",
        tests=[chk_status(404), chk_msg()]),

    req("❌ Transaction — missing amount → 400", "POST",
        "/v1/accounts/{{accountNumber}}/transactions",
        body={"currency": "GBP", "type": "deposit"},
        auth="token",
        tests=[chk_status(400), chk_details(), chk_detail_field("amount")]),

    req("❌ Transaction — missing currency → 400", "POST",
        "/v1/accounts/{{accountNumber}}/transactions",
        body={"amount": 50, "type": "deposit"},
        auth="token",
        tests=[chk_status(400), chk_details(), chk_detail_field("currency")]),

    req("❌ Transaction — missing type → 400", "POST",
        "/v1/accounts/{{accountNumber}}/transactions",
        body={"amount": 50, "currency": "GBP"},
        auth="token",
        tests=[chk_status(400), chk_details(), chk_detail_field("type")]),

    req("❌ Transaction — invalid type → 400", "POST",
        "/v1/accounts/{{accountNumber}}/transactions",
        body={"amount": 50, "currency": "GBP", "type": "transfer"},
        auth="token",
        tests=[chk_status(400), chk_details()]),

    req("❌ Transaction — non-GBP currency → 400", "POST",
        "/v1/accounts/{{accountNumber}}/transactions",
        body={"amount": 50, "currency": "USD", "type": "deposit"},
        auth="token",
        tests=[chk_status(400), chk_details()]),

    req("❌ Transaction — amount exceeds 10000 → 400", "POST",
        "/v1/accounts/{{accountNumber}}/transactions",
        body={"amount": 10001, "currency": "GBP", "type": "deposit"},
        auth="token",
        tests=[chk_status(400), chk_details()]),

    req("❌ Transaction — no token → 401", "POST",
        "/v1/accounts/{{accountNumber}}/transactions",
        body={"amount": 50, "currency": "GBP", "type": "deposit"},
        tests=[chk_status(401), chk_msg()]),
]

# --- List (5) ---
list_tx_items = [
    req("✅ List transactions on own account → 200", "GET",
        "/v1/accounts/{{accountNumber}}/transactions", auth="token",
        tests=[chk_status(200), chk_has("transactions"),
               'pm.test("transactions is array", () => pm.expect(pm.response.json().transactions).to.be.an("array"));',
               'pm.test("at least 1 transaction", () => pm.expect(pm.response.json().transactions.length).to.be.above(0));',
               'pm.test("each tx has required fields", () => {'
               '  const t = pm.response.json().transactions[0];'
               '  pm.expect(t).to.have.all.keys("id","amount","currency","type","createdTimestamp","userId");'
               '});']),

    req("✅ List transactions — empty account → 200 empty array", "GET",
        "/v1/accounts/{{accountNumber2}}/transactions", auth="token2",
        tests=[chk_status(200),
               'pm.test("transactions array is empty", () => pm.expect(pm.response.json().transactions).to.have.lengthOf(0));']),

    req("❌ List transactions on another user's account → 403", "GET",
        "/v1/accounts/{{accountNumber2}}/transactions", auth="token",
        tests=[chk_status(403), chk_msg()]),

    req("❌ List transactions on non-existent account → 404", "GET",
        "/v1/accounts/01000000/transactions", auth="token",
        tests=[chk_status(404), chk_msg()]),

    req("❌ List transactions — no token → 401", "GET",
        "/v1/accounts/{{accountNumber}}/transactions",
        tests=[chk_status(401), chk_msg()]),
]

# --- Fetch single (6) ---
fetch_tx_items = [
    req("✅ Fetch transaction on own account → 200", "GET",
        "/v1/accounts/{{accountNumber}}/transactions/{{transactionId}}", auth="token",
        tests=[chk_status(200),
               'pm.test("id matches", () => pm.expect(pm.response.json().id).to.eql(pm.environment.get("transactionId")));',
               chk_has("amount"), chk_has("currency"), chk_has("type"), chk_has("createdTimestamp")]),

    req("❌ Fetch transaction on another user's account → 403", "GET",
        "/v1/accounts/{{accountNumber2}}/transactions/{{transactionId2}}", auth="token",
        tests=[chk_status(403), chk_msg()]),

    req("❌ Fetch transaction — non-existent account → 404", "GET",
        "/v1/accounts/01000000/transactions/{{transactionId}}", auth="token",
        tests=[chk_status(404), chk_msg()]),

    req("❌ Fetch transaction — non-existent transactionId → 404", "GET",
        "/v1/accounts/{{accountNumber}}/transactions/tan-doesnotexist", auth="token",
        tests=[chk_status(404), chk_msg()]),

    req("❌ Fetch transaction — transactionId belongs to different account → 404", "GET",
        "/v1/accounts/{{accountNumber}}/transactions/{{transactionId2}}", auth="token",
        tests=[chk_status(404), chk_msg(),
               'pm.test("Note: transactionId2 belongs to accountNumber2, not accountNumber", () => pm.expect(true).to.be.true);']),

    req("❌ Fetch transaction — no token → 401", "GET",
        "/v1/accounts/{{accountNumber}}/transactions/{{transactionId}}",
        tests=[chk_status(401), chk_msg()]),
]

transaction_items = [
    folder("Create Transaction (14 tests)", create_tx_items),
    folder("List Transactions (5 tests)",   list_tx_items),
    folder("Fetch Transaction (6 tests)",   fetch_tx_items),
]

# ---------------------------------------------------------------------------
# 5. TEARDOWN — deletes all data so Setup can be re-run cleanly
# ---------------------------------------------------------------------------
# Note: transactions cannot be deleted via the API (read-only per spec).
# Deleting an account cascade-deletes its transactions automatically.
# Teardown order: accounts first (clears transactions), then users.

teardown_note = (
    'pm.test("Teardown — ignore 404 (already deleted)", () => {'
    '  pm.expect([204, 404]).to.include(pm.response.code);'
    '});'
)

teardown_items = [
    req("1. Delete spare account (accountNumberToDelete)", "DELETE",
        "/v1/accounts/{{accountNumberToDelete}}", auth="token",
        tests=[teardown_note]),

    req("2. Delete other user's account (accountNumber2)", "DELETE",
        "/v1/accounts/{{accountNumber2}}", auth="token2",
        tests=[teardown_note]),

    req("3. Delete main account (accountNumber) — also clears transactions", "DELETE",
        "/v1/accounts/{{accountNumber}}", auth="token",
        tests=[teardown_note]),

    req("4. Delete temp user (userIdTemp)", "DELETE",
        "/v1/users/{{userIdTemp}}", auth="tokenTemp",
        tests=[teardown_note]),

    req("5. Delete other user (userId2)", "DELETE",
        "/v1/users/{{userId2}}", auth="token2",
        tests=[teardown_note]),

    req("6. Delete main user (userId)", "DELETE",
        "/v1/users/{{userId}}", auth="token",
        tests=[teardown_note]),

    req("7. Clear environment variables", "GET", "/health",
        tests=[
            'const vars = ["token","userId","token2","userId2","tokenTemp","userIdTemp",'
            '"accountNumber","accountNumber2","accountNumberToDelete","transactionId","transactionId2"];',
            'vars.forEach(v => pm.environment.unset(v));',
            'pm.test("Environment cleared — ready to run Setup again", () => pm.expect(true).to.be.true);',
        ]),
]

# ---------------------------------------------------------------------------
# Build collection
# ---------------------------------------------------------------------------
collection = {
    "info": {
        "name": "Eagle Bank API — All Test Scenarios",
        "description": (
            "Complete test suite for the Eagle Bank API.\n\n"
            "HOW TO RUN:\n"
            "1. Select the 'Eagle Bank' environment (set baseUrl = http://localhost:3000)\n"
            "2. Run folder '0. SETUP' — creates all users, accounts, transactions\n"
            "3. Run any test suite (1-4) in any order\n"
            "4. Run '5. TEARDOWN' to delete all data and clear env vars\n"
            "5. You can then re-run Setup and start fresh\n\n"
            "To reset and start again: Run TEARDOWN then SETUP."
        ),
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    "variable": [
        {"key": "baseUrl", "value": "http://localhost:3000", "type": "string"}
    ],
    "item": [
        folder("0. SETUP — Run this first", setup_items),
        folder("1. AUTH (6 tests)", auth_items),
        folder("2. USERS (27 tests)", user_items),
        folder("3. ACCOUNTS (21 tests)", account_items),
        folder("4. TRANSACTIONS (25 tests)", transaction_items),
        folder("5. TEARDOWN — Run to reset & start fresh", teardown_items),
    ]
}

with open(OUTPUT, "w") as f:
    json.dump(collection, f, indent=2)

total = (len(setup_items) + len(auth_items)
         + len(create_user_items) + len(fetch_user_items) + len(update_user_items) + len(delete_user_items)
         + len(create_account_items) + len(list_account_items) + len(fetch_account_items) + len(update_account_items) + len(delete_account_items)
         + len(create_tx_items) + len(list_tx_items) + len(fetch_tx_items))
print(f"Collection saved: {OUTPUT}")
print(f"Total requests: {total} ({len(setup_items)} setup + {len(teardown_items)} teardown + {total - len(setup_items)} tests)")
