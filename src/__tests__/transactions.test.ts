import request from 'supertest';
import app from '../app';
import {
  clearDb,
  OTHER_USER,
  setupUser,
  setupAccount,
  setupDeposit,
  authHeader,
} from './helpers';

beforeEach(async () => {
  await clearDb();
});

// ---------------------------------------------------------------------------
// Helpers local to this file
// ---------------------------------------------------------------------------
async function setupFundedAccount(amount = 500) {
  const { token } = await setupUser();
  const account = await setupAccount(token);
  await setupDeposit(token, account.accountNumber as string, amount);

  // Re-fetch to get updated balance
  const refreshed = await request(app)
    .get(`/v1/accounts/${account.accountNumber}`)
    .set(authHeader(token));

  return { token, account: refreshed.body as Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// POST /v1/accounts/:accountNumber/transactions — Create a transaction
// ---------------------------------------------------------------------------
describe('POST /v1/accounts/:accountNumber/transactions', () => {
  describe('Scenario: User wants to deposit money into their bank account', () => {
    it('returns 201, records the transaction, and updates the balance', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token);

      const res = await request(app)
        .post(`/v1/accounts/${account.accountNumber}/transactions`)
        .set(authHeader(token))
        .send({ amount: 250.50, currency: 'GBP', type: 'deposit', reference: 'Salary' });

      expect(res.status).toBe(201);
      expect(res.body.id).toMatch(/^tan-[A-Za-z0-9]+$/);
      expect(res.body.amount).toBe(250.50);
      expect(res.body.currency).toBe('GBP');
      expect(res.body.type).toBe('deposit');
      expect(res.body.reference).toBe('Salary');
      expect(res.body).toHaveProperty('createdTimestamp');

      // Balance should be updated
      const accountRes = await request(app)
        .get(`/v1/accounts/${account.accountNumber}`)
        .set(authHeader(token));
      expect(accountRes.body.balance).toBe(250.50);
    });
  });

  describe('Scenario: User wants to withdraw money from their bank account', () => {
    it('returns 201, records the transaction, and deducts the balance', async () => {
      const { token, account } = await setupFundedAccount(500);

      const res = await request(app)
        .post(`/v1/accounts/${account.accountNumber}/transactions`)
        .set(authHeader(token))
        .send({ amount: 100, currency: 'GBP', type: 'withdrawal', reference: 'ATM' });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('withdrawal');
      expect(res.body.amount).toBe(100);

      const accountRes = await request(app)
        .get(`/v1/accounts/${account.accountNumber}`)
        .set(authHeader(token));
      expect(accountRes.body.balance).toBe(400);
    });
  });

  describe('Scenario: User wants to withdraw money but has insufficient funds', () => {
    it('returns 422', async () => {
      const { token, account } = await setupFundedAccount(100);

      const res = await request(app)
        .post(`/v1/accounts/${account.accountNumber}/transactions`)
        .set(authHeader(token))
        .send({ amount: 200, currency: 'GBP', type: 'withdrawal' });

      expect(res.status).toBe(422);
      expect(res.body).toHaveProperty('message');

      // Balance must be unchanged
      const accountRes = await request(app)
        .get(`/v1/accounts/${account.accountNumber}`)
        .set(authHeader(token));
      expect(accountRes.body.balance).toBe(100);
    });

    it('returns 422 when balance is exactly zero', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token);

      const res = await request(app)
        .post(`/v1/accounts/${account.accountNumber}/transactions`)
        .set(authHeader(token))
        .send({ amount: 0.01, currency: 'GBP', type: 'withdrawal' });

      expect(res.status).toBe(422);
    });
  });

  describe('Scenario: User wants to transact on another user\'s bank account', () => {
    it('returns 403', async () => {
      const { token } = await setupUser();
      const other = await setupUser(OTHER_USER);
      const otherAccount = await setupAccount(other.token);

      const res = await request(app)
        .post(`/v1/accounts/${otherAccount.accountNumber}/transactions`)
        .set(authHeader(token))
        .send({ amount: 50, currency: 'GBP', type: 'deposit' });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('Scenario: User wants to transact on a non-existent bank account', () => {
    it('returns 404', async () => {
      const { token } = await setupUser();

      const res = await request(app)
        .post('/v1/accounts/01000000/transactions')
        .set(authHeader(token))
        .send({ amount: 50, currency: 'GBP', type: 'deposit' });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('Scenario: User wants to transact without supplying all required data', () => {
    it('returns 400 when amount is missing', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token);

      const res = await request(app)
        .post(`/v1/accounts/${account.accountNumber}/transactions`)
        .set(authHeader(token))
        .send({ currency: 'GBP', type: 'deposit' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('details');
      expect(res.body.details.some((d: { field: string }) => d.field === 'amount')).toBe(true);
    });

    it('returns 400 when currency is missing', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token);

      const res = await request(app)
        .post(`/v1/accounts/${account.accountNumber}/transactions`)
        .set(authHeader(token))
        .send({ amount: 50, type: 'deposit' });

      expect(res.status).toBe(400);
      expect(res.body.details.some((d: { field: string }) => d.field === 'currency')).toBe(true);
    });

    it('returns 400 when type is missing', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token);

      const res = await request(app)
        .post(`/v1/accounts/${account.accountNumber}/transactions`)
        .set(authHeader(token))
        .send({ amount: 50, currency: 'GBP' });

      expect(res.status).toBe(400);
      expect(res.body.details.some((d: { field: string }) => d.field === 'type')).toBe(true);
    });

    it('returns 400 when type is invalid', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token);

      const res = await request(app)
        .post(`/v1/accounts/${account.accountNumber}/transactions`)
        .set(authHeader(token))
        .send({ amount: 50, currency: 'GBP', type: 'transfer' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when currency is not GBP', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token);

      const res = await request(app)
        .post(`/v1/accounts/${account.accountNumber}/transactions`)
        .set(authHeader(token))
        .send({ amount: 50, currency: 'USD', type: 'deposit' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when amount exceeds maximum (10000)', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token);

      const res = await request(app)
        .post(`/v1/accounts/${account.accountNumber}/transactions`)
        .set(authHeader(token))
        .send({ amount: 10001, currency: 'GBP', type: 'deposit' });

      expect(res.status).toBe(400);
    });
  });

  describe('Scenario: unauthenticated request', () => {
    it('returns 401', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token);

      const res = await request(app)
        .post(`/v1/accounts/${account.accountNumber}/transactions`)
        .send({ amount: 50, currency: 'GBP', type: 'deposit' });

      expect(res.status).toBe(401);
    });
  });
});

// ---------------------------------------------------------------------------
// GET /v1/accounts/:accountNumber/transactions — List transactions
// ---------------------------------------------------------------------------
describe('GET /v1/accounts/:accountNumber/transactions', () => {
  describe('Scenario: User wants to view all transactions on their bank account', () => {
    it('returns 200 with a list of transactions', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token);
      const accountNumber = account.accountNumber as string;

      await setupDeposit(token, accountNumber, 300);
      await setupDeposit(token, accountNumber, 200);

      const res = await request(app)
        .get(`/v1/accounts/${accountNumber}/transactions`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('transactions');
      expect(res.body.transactions).toHaveLength(2);

      const tx = res.body.transactions[0];
      expect(tx).toHaveProperty('id');
      expect(tx).toHaveProperty('amount');
      expect(tx).toHaveProperty('currency');
      expect(tx).toHaveProperty('type');
      expect(tx).toHaveProperty('createdTimestamp');
    });

    it('returns an empty list when no transactions exist', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token);

      const res = await request(app)
        .get(`/v1/accounts/${account.accountNumber}/transactions`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.transactions).toHaveLength(0);
    });
  });

  describe('Scenario: User wants to view all transactions on another user\'s bank account', () => {
    it('returns 403', async () => {
      const { token } = await setupUser();
      const other = await setupUser(OTHER_USER);
      const otherAccount = await setupAccount(other.token);

      const res = await request(app)
        .get(`/v1/accounts/${otherAccount.accountNumber}/transactions`)
        .set(authHeader(token));

      expect(res.status).toBe(403);
    });
  });

  describe('Scenario: User wants to view all transactions on a non-existent bank account', () => {
    it('returns 404', async () => {
      const { token } = await setupUser();

      const res = await request(app)
        .get('/v1/accounts/01000000/transactions')
        .set(authHeader(token));

      expect(res.status).toBe(404);
    });
  });

  describe('Scenario: unauthenticated request', () => {
    it('returns 401', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token);

      const res = await request(app).get(
        `/v1/accounts/${account.accountNumber}/transactions`
      );

      expect(res.status).toBe(401);
    });
  });
});

// ---------------------------------------------------------------------------
// GET /v1/accounts/:accountNumber/transactions/:transactionId — Fetch transaction
// ---------------------------------------------------------------------------
describe('GET /v1/accounts/:accountNumber/transactions/:transactionId', () => {
  describe('Scenario: User wants to fetch a transaction on their bank account', () => {
    it('returns 200 with the transaction details', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token);
      const accountNumber = account.accountNumber as string;
      const tx = await setupDeposit(token, accountNumber, 150);

      const res = await request(app)
        .get(`/v1/accounts/${accountNumber}/transactions/${tx.id}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(tx.id);
      expect(res.body.amount).toBe(150);
      expect(res.body.type).toBe('deposit');
      expect(res.body.currency).toBe('GBP');
      expect(res.body).toHaveProperty('createdTimestamp');
    });
  });

  describe('Scenario: User wants to fetch a transaction on another user\'s bank account', () => {
    it('returns 403', async () => {
      const { token } = await setupUser();
      const other = await setupUser(OTHER_USER);
      const otherAccount = await setupAccount(other.token);
      const otherAccountNumber = otherAccount.accountNumber as string;
      const otherTx = await setupDeposit(other.token, otherAccountNumber, 100);

      const res = await request(app)
        .get(`/v1/accounts/${otherAccountNumber}/transactions/${otherTx.id}`)
        .set(authHeader(token));

      expect(res.status).toBe(403);
    });
  });

  describe('Scenario: User wants to fetch a transaction on a non-existent bank account', () => {
    it('returns 404', async () => {
      const { token } = await setupUser();

      const res = await request(app)
        .get('/v1/accounts/01000000/transactions/tan-abc12345')
        .set(authHeader(token));

      expect(res.status).toBe(404);
    });
  });

  describe('Scenario: User wants to fetch a non-existent transactionId', () => {
    it('returns 404', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token);

      const res = await request(app)
        .get(`/v1/accounts/${account.accountNumber}/transactions/tan-notexist`)
        .set(authHeader(token));

      expect(res.status).toBe(404);
    });
  });

  describe('Scenario: User wants to fetch a transaction against the wrong bank account', () => {
    it('returns 404 when the transactionId belongs to a different account', async () => {
      const { token } = await setupUser();

      const accountA = await setupAccount(token, { name: 'Account A' });
      const accountB = await setupAccount(token, { name: 'Account B' });
      const accountNumberA = accountA.accountNumber as string;
      const accountNumberB = accountB.accountNumber as string;

      const txOnA = await setupDeposit(token, accountNumberA, 100);

      // Fetch the transaction but supply Account B's number — should be 404
      const res = await request(app)
        .get(`/v1/accounts/${accountNumberB}/transactions/${txOnA.id}`)
        .set(authHeader(token));

      expect(res.status).toBe(404);
    });
  });

  describe('Scenario: unauthenticated request', () => {
    it('returns 401', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token);
      const accountNumber = account.accountNumber as string;
      const tx = await setupDeposit(token, accountNumber, 100);

      const res = await request(app).get(
        `/v1/accounts/${accountNumber}/transactions/${tx.id}`
      );

      expect(res.status).toBe(401);
    });
  });
});
