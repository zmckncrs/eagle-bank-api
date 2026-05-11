# Eagle Bank API

A REST API for Eagle Bank built with Node.js, TypeScript, Express, Prisma (SQLite), and JWT authentication.

## Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express
- **Database**: SQLite via Prisma ORM (zero-config, no external DB needed)
- **Auth**: JWT bearer tokens (24h expiry)
- **Validation**: Zod
- **Password hashing**: bcryptjs

## Getting Started

### Prerequisites

- Node.js 18+
- npm

> **Windows note:** If PowerShell blocks `npm` with a script execution policy error, either run this once (no admin required):
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```
> Or replace `npm` with `npm.cmd` in every command below.

### Setup

```bash
# 1. Install dependencies and initialise the database
npm run setup

# 2. Start the development server (with hot-reload)
npm run dev
```

The server starts on `http://localhost:3000`.

### Environment

Copy `.env.example` to `.env` and adjust values if needed (defaults work out of the box):

```
DATABASE_URL="file:./eagle-bank.db"
JWT_SECRET="change-me-to-a-secure-random-string"
PORT=3000
```

### Build for production

```bash
npm run build
npm start
```

---

## API Overview

The full OpenAPI specification is in `openapi.yaml`. A summary:

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/v1/auth/login` | — | Login and receive JWT token |

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/v1/users` | — | Register a new user |
| GET | `/v1/users/:userId` | Bearer | Fetch own user details |
| PATCH | `/v1/users/:userId` | Bearer | Update own user details |
| DELETE | `/v1/users/:userId` | Bearer | Delete own user (fails if accounts exist) |

### Accounts

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/v1/accounts` | Bearer | Create a bank account |
| GET | `/v1/accounts` | Bearer | List own accounts |
| GET | `/v1/accounts/:accountNumber` | Bearer | Fetch account by number |
| PATCH | `/v1/accounts/:accountNumber` | Bearer | Update account |
| DELETE | `/v1/accounts/:accountNumber` | Bearer | Delete account |

### Transactions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/v1/accounts/:accountNumber/transactions` | Bearer | Deposit or withdraw |
| GET | `/v1/accounts/:accountNumber/transactions` | Bearer | List transactions |
| GET | `/v1/accounts/:accountNumber/transactions/:transactionId` | Bearer | Fetch single transaction |

---

## Example Workflow

```bash
BASE=http://localhost:3000

# 1. Register
curl -s -X POST $BASE/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@example.com",
    "password": "securepass1",
    "phoneNumber": "+441234567890",
    "address": {
      "line1": "1 Eagle Street",
      "town": "London",
      "county": "Greater London",
      "postcode": "EC1A 1BB"
    }
  }'

# 2. Login — copy the token from the response
TOKEN=$(curl -s -X POST $BASE/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"securepass1"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# 3. Create account
ACCOUNT=$(curl -s -X POST $BASE/v1/accounts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Account","accountType":"personal"}')
echo $ACCOUNT

ACCOUNT_NUMBER=$(echo $ACCOUNT | grep -o '"accountNumber":"[^"]*"' | cut -d'"' -f4)

# 4. Deposit £500
curl -s -X POST $BASE/v1/accounts/$ACCOUNT_NUMBER/transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount":500,"currency":"GBP","type":"deposit","reference":"Initial deposit"}'

# 5. List transactions
curl -s $BASE/v1/accounts/$ACCOUNT_NUMBER/transactions \
  -H "Authorization: Bearer $TOKEN"
```

---

## Design Notes

### ID formats
- **Users**: `usr-` + 8 random alphanumeric characters (e.g. `usr-Ab3xY7kP`)
- **Transactions**: `tan-` + 8 random alphanumeric characters (e.g. `tan-Kz9mQ2wR`)
- **Account numbers**: `01` + 6 random digits (e.g. `01423871`), conforming to the `^01\d{6}$` pattern in the spec

### OpenAPI spec changes
Two additions were made to the provided spec:
1. **`POST /v1/auth/login`** — new endpoint to authenticate and return a JWT token
2. **`password` field** added to `CreateUserRequest` — required to enable authentication; passwords are bcrypt-hashed before storage and never returned in responses

### Authorisation
Every protected endpoint checks that the authenticated user owns the resource (user or account). Attempting to access another user's data returns `403 Forbidden`.

### Transactions
Deposits and withdrawals are atomic: the transaction record and the account balance update are wrapped in a Prisma database transaction, preventing partial state on failure. Withdrawals are rejected with `422 Unprocessable Entity` when the balance would go below zero.

### Account deletion
Deleting an account also removes its transaction history (cascade). Deleting a user is blocked (`409 Conflict`) while they have any active accounts.
