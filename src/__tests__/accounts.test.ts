import request from 'supertest';
import app from '../app';
import {
  clearDb,
  BASE_USER,
  OTHER_USER,
  setupUser,
  setupAccount,
  authHeader,
} from './helpers';

beforeEach(async () => {
  await clearDb();
});

// ---------------------------------------------------------------------------
// POST /v1/accounts — Create a bank account
// ---------------------------------------------------------------------------
describe('POST /v1/accounts', () => {
  describe('Scenario: User wants to create a new bank account', () => {
    it('returns 201 with account details', async () => {
      const { token } = await setupUser();

      const res = await request(app)
        .post('/v1/accounts')
        .set(authHeader(token))
        .send({ name: 'My Savings', accountType: 'personal' });

      expect(res.status).toBe(201);
      expect(res.body.accountNumber).toMatch(/^01\d{6}$/);
      expect(res.body.sortCode).toBe('10-10-10');
      expect(res.body.name).toBe('My Savings');
      expect(res.body.accountType).toBe('personal');
      expect(res.body.balance).toBe(0);
      expect(res.body.currency).toBe('GBP');
      expect(res.body).toHaveProperty('createdTimestamp');
      expect(res.body).toHaveProperty('updatedTimestamp');
    });
  });

  describe('Scenario: User wants to create a new bank account without supplying all required data', () => {
    it('returns 400 when name is missing', async () => {
      const { token } = await setupUser();

      const res = await request(app)
        .post('/v1/accounts')
        .set(authHeader(token))
        .send({ accountType: 'personal' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('details');
      expect(res.body.details.some((d: { field: string }) => d.field === 'name')).toBe(true);
    });

    it('returns 400 when accountType is missing', async () => {
      const { token } = await setupUser();

      const res = await request(app)
        .post('/v1/accounts')
        .set(authHeader(token))
        .send({ name: 'My Account' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('details');
    });

    it('returns 400 when accountType is not "personal"', async () => {
      const { token } = await setupUser();

      const res = await request(app)
        .post('/v1/accounts')
        .set(authHeader(token))
        .send({ name: 'My Account', accountType: 'business' });

      expect(res.status).toBe(400);
    });
  });

  describe('Scenario: unauthenticated request', () => {
    it('returns 401', async () => {
      const res = await request(app)
        .post('/v1/accounts')
        .send({ name: 'My Account', accountType: 'personal' });

      expect(res.status).toBe(401);
    });
  });
});

// ---------------------------------------------------------------------------
// GET /v1/accounts — List bank accounts
// ---------------------------------------------------------------------------
describe('GET /v1/accounts', () => {
  describe('Scenario: User wants to view their bank accounts', () => {
    it('returns 200 with only the authenticated user\'s accounts', async () => {
      const { token } = await setupUser();
      await setupAccount(token, { name: 'Account One' });
      await setupAccount(token, { name: 'Account Two' });

      // Another user's account should not appear
      const other = await setupUser(OTHER_USER);
      await setupAccount(other.token, { name: 'Other Account' });

      const res = await request(app)
        .get('/v1/accounts')
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accounts');
      expect(res.body.accounts).toHaveLength(2);
      const names = res.body.accounts.map((a: { name: string }) => a.name);
      expect(names).toContain('Account One');
      expect(names).toContain('Account Two');
    });

    it('returns empty array when user has no accounts', async () => {
      const { token } = await setupUser();

      const res = await request(app)
        .get('/v1/accounts')
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.accounts).toHaveLength(0);
    });
  });

  describe('Scenario: unauthenticated request', () => {
    it('returns 401', async () => {
      const res = await request(app).get('/v1/accounts');

      expect(res.status).toBe(401);
    });
  });
});

// ---------------------------------------------------------------------------
// GET /v1/accounts/:accountNumber — Fetch a bank account
// ---------------------------------------------------------------------------
describe('GET /v1/accounts/:accountNumber', () => {
  describe('Scenario: User wants to fetch their bank account details', () => {
    it('returns 200 with account details', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token);

      const res = await request(app)
        .get(`/v1/accounts/${account.accountNumber}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.accountNumber).toBe(account.accountNumber);
      expect(res.body.balance).toBe(0);
    });
  });

  describe('Scenario: User wants to fetch another user\'s bank account details', () => {
    it('returns 403', async () => {
      const { token } = await setupUser();
      const other = await setupUser(OTHER_USER);
      const otherAccount = await setupAccount(other.token);

      const res = await request(app)
        .get(`/v1/accounts/${otherAccount.accountNumber}`)
        .set(authHeader(token));

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('Scenario: User wants to fetch a non-existent bank account', () => {
    it('returns 404', async () => {
      const { token } = await setupUser();

      const res = await request(app)
        .get('/v1/accounts/01000000')
        .set(authHeader(token));

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('Scenario: unauthenticated request', () => {
    it('returns 401', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token);

      const res = await request(app).get(`/v1/accounts/${account.accountNumber}`);

      expect(res.status).toBe(401);
    });
  });
});

// ---------------------------------------------------------------------------
// PATCH /v1/accounts/:accountNumber — Update a bank account
// ---------------------------------------------------------------------------
describe('PATCH /v1/accounts/:accountNumber', () => {
  describe('Scenario: User wants to update their bank account details', () => {
    it('returns 200 with updated account data', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token, { name: 'Original Name' });

      const res = await request(app)
        .patch(`/v1/accounts/${account.accountNumber}`)
        .set(authHeader(token))
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.accountNumber).toBe(account.accountNumber);
    });
  });

  describe('Scenario: User wants to update another user\'s bank account details', () => {
    it('returns 403', async () => {
      const { token } = await setupUser();
      const other = await setupUser(OTHER_USER);
      const otherAccount = await setupAccount(other.token);

      const res = await request(app)
        .patch(`/v1/accounts/${otherAccount.accountNumber}`)
        .set(authHeader(token))
        .send({ name: 'Hacked' });

      expect(res.status).toBe(403);
    });
  });

  describe('Scenario: User wants to update a non-existent bank account', () => {
    it('returns 404', async () => {
      const { token } = await setupUser();

      const res = await request(app)
        .patch('/v1/accounts/01000000')
        .set(authHeader(token))
        .send({ name: 'Ghost Account' });

      expect(res.status).toBe(404);
    });
  });

  describe('Scenario: unauthenticated request', () => {
    it('returns 401', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token);

      const res = await request(app)
        .patch(`/v1/accounts/${account.accountNumber}`)
        .send({ name: 'No Auth' });

      expect(res.status).toBe(401);
    });
  });
});

// ---------------------------------------------------------------------------
// DELETE /v1/accounts/:accountNumber — Delete a bank account
// ---------------------------------------------------------------------------
describe('DELETE /v1/accounts/:accountNumber', () => {
  describe('Scenario: User deletes their own bank account', () => {
    it('returns 204 and removes the account', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token);

      const res = await request(app)
        .delete(`/v1/accounts/${account.accountNumber}`)
        .set(authHeader(token));

      expect(res.status).toBe(204);

      // Confirming it's gone
      const fetchRes = await request(app)
        .get(`/v1/accounts/${account.accountNumber}`)
        .set(authHeader(token));
      expect(fetchRes.status).toBe(404);
    });
  });

  describe('Scenario: User wants to delete another user\'s bank account', () => {
    it('returns 403', async () => {
      const { token } = await setupUser();
      const other = await setupUser(OTHER_USER);
      const otherAccount = await setupAccount(other.token);

      const res = await request(app)
        .delete(`/v1/accounts/${otherAccount.accountNumber}`)
        .set(authHeader(token));

      expect(res.status).toBe(403);
    });
  });

  describe('Scenario: User wants to delete a non-existent bank account', () => {
    it('returns 404', async () => {
      const { token } = await setupUser();

      const res = await request(app)
        .delete('/v1/accounts/01000000')
        .set(authHeader(token));

      expect(res.status).toBe(404);
    });
  });

  describe('Scenario: unauthenticated request', () => {
    it('returns 401', async () => {
      const { token } = await setupUser();
      const account = await setupAccount(token);

      const res = await request(app)
        .delete(`/v1/accounts/${account.accountNumber}`);

      expect(res.status).toBe(401);
    });
  });
});
