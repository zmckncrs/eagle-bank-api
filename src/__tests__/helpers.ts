import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';

export const BASE_USER = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'password123',
  phoneNumber: '+441234567890',
  address: {
    line1: '1 Test Street',
    town: 'London',
    county: 'Greater London',
    postcode: 'EC1A 1BB',
  },
};

export const OTHER_USER = {
  name: 'Other User',
  email: 'other@example.com',
  password: 'password456',
  phoneNumber: '+441234567891',
  address: {
    line1: '2 Other Street',
    town: 'Manchester',
    county: 'Greater Manchester',
    postcode: 'M1 1AA',
  },
};

export async function clearDb(): Promise<void> {
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
}

export async function registerUser(data: Partial<typeof BASE_USER> = {}): Promise<request.Response> {
  return request(app)
    .post('/v1/users')
    .send({ ...BASE_USER, ...data });
}

export async function loginUser(
  email = BASE_USER.email,
  password = BASE_USER.password
): Promise<string> {
  const res = await request(app)
    .post('/v1/auth/login')
    .send({ email, password });
  return res.body.token as string;
}

export async function setupUser(overrides: Partial<typeof BASE_USER> = {}): Promise<{
  token: string;
  userId: string;
  user: Record<string, unknown>;
}> {
  const data = { ...BASE_USER, ...overrides };
  const createRes = await registerUser(overrides);
  const token = await loginUser(data.email, data.password);
  return { token, userId: createRes.body.id as string, user: createRes.body };
}

export async function setupAccount(
  token: string,
  overrides: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const res = await request(app)
    .post('/v1/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Account', accountType: 'personal', ...overrides });
  return res.body as Record<string, unknown>;
}

export async function setupDeposit(
  token: string,
  accountNumber: string,
  amount = 500
): Promise<Record<string, unknown>> {
  const res = await request(app)
    .post(`/v1/accounts/${accountNumber}/transactions`)
    .set('Authorization', `Bearer ${token}`)
    .send({ amount, currency: 'GBP', type: 'deposit' });
  return res.body as Record<string, unknown>;
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
