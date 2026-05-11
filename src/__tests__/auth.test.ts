import request from 'supertest';
import app from '../app';
import { clearDb, BASE_USER, registerUser } from './helpers';

beforeEach(async () => {
  await clearDb();
  await registerUser();
});

describe('POST /v1/auth/login', () => {
  describe('Scenario: successful login', () => {
    it('returns 200 with a JWT token and userId', async () => {
      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: BASE_USER.email, password: BASE_USER.password });

      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.length).toBeGreaterThan(0);
      expect(res.body.userId).toMatch(/^usr-[A-Za-z0-9]+$/);
    });
  });

  describe('Scenario: wrong password', () => {
    it('returns 401', async () => {
      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: BASE_USER.email, password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('Scenario: non-existent email', () => {
    it('returns 401', async () => {
      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'nobody@example.com', password: BASE_USER.password });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('Scenario: missing email', () => {
    it('returns 400 with details listing the missing field', async () => {
      const res = await request(app)
        .post('/v1/auth/login')
        .send({ password: BASE_USER.password });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('details');
      expect(res.body.details.some((d: { field: string }) => d.field === 'email')).toBe(true);
    });
  });

  describe('Scenario: missing password', () => {
    it('returns 400 with details listing the missing field', async () => {
      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: BASE_USER.email });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('details');
      expect(res.body.details.some((d: { field: string }) => d.field === 'password')).toBe(true);
    });
  });

  describe('Scenario: invalid email format', () => {
    it('returns 400', async () => {
      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'not-an-email', password: BASE_USER.password });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('details');
    });
  });
});
