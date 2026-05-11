/// <reference types="jest" />
import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';
import {
  clearDb,
  BASE_USER,
  OTHER_USER,
  registerUser,
  loginUser,
  setupUser,
  setupAccount,
  authHeader,
} from './helpers';

beforeEach(async () => {
  await clearDb();
});

// ---------------------------------------------------------------------------
// POST /v1/users — Create a user
// ---------------------------------------------------------------------------
describe('POST /v1/users', () => {
  describe('Scenario: Create a new user with all required data', () => {
    it('returns 201 with the created user (no passwordHash)', async () => {
      const res = await registerUser();

      expect(res.status).toBe(201);
      expect(res.body.id).toMatch(/^usr-[A-Za-z0-9]+$/);
      expect(res.body.name).toBe(BASE_USER.name);
      expect(res.body.email).toBe(BASE_USER.email);
      expect(res.body.phoneNumber).toBe(BASE_USER.phoneNumber);
      expect(res.body.address.line1).toBe(BASE_USER.address.line1);
      expect(res.body.address.town).toBe(BASE_USER.address.town);
      expect(res.body).toHaveProperty('createdTimestamp');
      expect(res.body).toHaveProperty('updatedTimestamp');
      expect(res.body).not.toHaveProperty('passwordHash');
    });
  });

  describe('Scenario: Create a new user without supplying all required data', () => {
    it('returns 400 with details when name is missing', async () => {
      const { name: _name, ...body } = BASE_USER;
      const res = await request(app).post('/v1/users').send(body);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('details');
      expect(res.body.details.some((d: { field: string }) => d.field === 'name')).toBe(true);
    });

    it('returns 400 with details when email is missing', async () => {
      const { email: _email, ...body } = BASE_USER;
      const res = await request(app).post('/v1/users').send(body);

      expect(res.status).toBe(400);
      expect(res.body.details.some((d: { field: string }) => d.field === 'email')).toBe(true);
    });

    it('returns 400 with details when address is missing', async () => {
      const { address: _address, ...body } = BASE_USER;
      const res = await request(app).post('/v1/users').send(body);

      expect(res.status).toBe(400);
      expect(res.body.details.some((d: { field: string }) => d.field === 'address')).toBe(true);
    });

    it('returns 400 with details when phoneNumber is missing', async () => {
      const { phoneNumber: _phone, ...body } = BASE_USER;
      const res = await request(app).post('/v1/users').send(body);

      expect(res.status).toBe(400);
      expect(res.body.details.some((d: { field: string }) => d.field === 'phoneNumber')).toBe(true);
    });

    it('returns 400 with details when password is missing', async () => {
      const { password: _pass, ...body } = BASE_USER;
      const res = await request(app).post('/v1/users').send(body);

      expect(res.status).toBe(400);
      expect(res.body.details.some((d: { field: string }) => d.field === 'password')).toBe(true);
    });

    it('returns 400 when email format is invalid', async () => {
      const res = await request(app)
        .post('/v1/users')
        .send({ ...BASE_USER, email: 'not-an-email' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when phoneNumber is not in E.164 format', async () => {
      const res = await request(app)
        .post('/v1/users')
        .send({ ...BASE_USER, phoneNumber: '07123456789' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when password is shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/v1/users')
        .send({ ...BASE_USER, password: 'short' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when address is missing required sub-fields', async () => {
      const res = await request(app)
        .post('/v1/users')
        .send({ ...BASE_USER, address: { line1: '1 Test St' } });

      expect(res.status).toBe(400);
    });

    it('returns 400 when email is already registered', async () => {
      await registerUser();
      const res = await registerUser();

      expect(res.status).toBe(400);
    });
  });
});

// ---------------------------------------------------------------------------
// GET /v1/users/:userId — Fetch a user
// ---------------------------------------------------------------------------
describe('GET /v1/users/:userId', () => {
  describe('Scenario: User wants to fetch their own user details', () => {
    it('returns 200 with user data', async () => {
      const { token, userId } = await setupUser();

      const res = await request(app)
        .get(`/v1/users/${userId}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(userId);
      expect(res.body.name).toBe(BASE_USER.name);
      expect(res.body).not.toHaveProperty('passwordHash');
    });
  });

  describe('Scenario: User wants to fetch the user details of another user', () => {
    it('returns 403', async () => {
      const { token } = await setupUser();
      const other = await setupUser(OTHER_USER);

      const res = await request(app)
        .get(`/v1/users/${other.userId}`)
        .set(authHeader(token));

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('Scenario: User wants to fetch the user details of a non-existent user', () => {
    it('returns 404 when their own account has been deleted (stale token)', async () => {
      const { token, userId } = await setupUser();

      // Simulate account deletion with a stale token still in circulation
      await prisma.user.delete({ where: { id: userId } });

      const res = await request(app)
        .get(`/v1/users/${userId}`)
        .set(authHeader(token));

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('Scenario: unauthenticated request', () => {
    it('returns 401 when no token is supplied', async () => {
      const { userId } = await setupUser();

      const res = await request(app).get(`/v1/users/${userId}`);

      expect(res.status).toBe(401);
    });

    it('returns 401 when token is invalid', async () => {
      const { userId } = await setupUser();

      const res = await request(app)
        .get(`/v1/users/${userId}`)
        .set('Authorization', 'Bearer bad-token');

      expect(res.status).toBe(401);
    });
  });
});

// ---------------------------------------------------------------------------
// PATCH /v1/users/:userId — Update a user
// ---------------------------------------------------------------------------
describe('PATCH /v1/users/:userId', () => {
  describe('Scenario: User wants to update their own user details', () => {
    it('returns 200 with updated user data', async () => {
      const { token, userId } = await setupUser();

      const res = await request(app)
        .patch(`/v1/users/${userId}`)
        .set(authHeader(token))
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.email).toBe(BASE_USER.email);
    });

    it('updates address independently', async () => {
      const { token, userId } = await setupUser();

      const res = await request(app)
        .patch(`/v1/users/${userId}`)
        .set(authHeader(token))
        .send({
          address: {
            line1: '99 New Road',
            town: 'Birmingham',
            county: 'West Midlands',
            postcode: 'B1 1AA',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.address.line1).toBe('99 New Road');
      expect(res.body.address.town).toBe('Birmingham');
      expect(res.body.name).toBe(BASE_USER.name);
    });

    it('updates email independently', async () => {
      const { token, userId } = await setupUser();

      const res = await request(app)
        .patch(`/v1/users/${userId}`)
        .set(authHeader(token))
        .send({ email: 'updated@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('updated@example.com');
    });
  });

  describe('Scenario: User wants to update the user details of another user', () => {
    it('returns 403', async () => {
      const { token } = await setupUser();
      const other = await setupUser(OTHER_USER);

      const res = await request(app)
        .patch(`/v1/users/${other.userId}`)
        .set(authHeader(token))
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(403);
    });
  });

  describe('Scenario: User wants to update a non-existent user (stale token)', () => {
    it('returns 404', async () => {
      const { token, userId } = await setupUser();

      await prisma.user.delete({ where: { id: userId } });

      const res = await request(app)
        .patch(`/v1/users/${userId}`)
        .set(authHeader(token))
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
    });
  });

  describe('Scenario: unauthenticated request', () => {
    it('returns 401', async () => {
      const { userId } = await setupUser();

      const res = await request(app)
        .patch(`/v1/users/${userId}`)
        .send({ name: 'No Auth' });

      expect(res.status).toBe(401);
    });
  });
});

// ---------------------------------------------------------------------------
// DELETE /v1/users/:userId — Delete a user
// ---------------------------------------------------------------------------
describe('DELETE /v1/users/:userId', () => {
  describe('Scenario: User wants to delete their own account (no bank accounts)', () => {
    it('returns 204 and removes the user', async () => {
      const { token, userId } = await setupUser();

      const res = await request(app)
        .delete(`/v1/users/${userId}`)
        .set(authHeader(token));

      expect(res.status).toBe(204);

      const gone = await prisma.user.findUnique({ where: { id: userId } });
      expect(gone).toBeNull();
    });
  });

  describe('Scenario: User wants to delete their account but they have a bank account', () => {
    it('returns 409', async () => {
      const { token, userId } = await setupUser();
      await setupAccount(token);

      const res = await request(app)
        .delete(`/v1/users/${userId}`)
        .set(authHeader(token));

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('message');

      const still = await prisma.user.findUnique({ where: { id: userId } });
      expect(still).not.toBeNull();
    });
  });

  describe('Scenario: User wants to delete the account of another user', () => {
    it('returns 403', async () => {
      const { token } = await setupUser();
      const other = await setupUser(OTHER_USER);

      const res = await request(app)
        .delete(`/v1/users/${other.userId}`)
        .set(authHeader(token));

      expect(res.status).toBe(403);
    });
  });

  describe('Scenario: User wants to delete a non-existent user (stale token)', () => {
    it('returns 404', async () => {
      const { token, userId } = await setupUser();

      await prisma.user.delete({ where: { id: userId } });

      const res = await request(app)
        .delete(`/v1/users/${userId}`)
        .set(authHeader(token));

      expect(res.status).toBe(404);
    });
  });

  describe('Scenario: unauthenticated request', () => {
    it('returns 401', async () => {
      const { userId } = await setupUser();

      const res = await request(app).delete(`/v1/users/${userId}`);

      expect(res.status).toBe(401);
    });
  });
});
