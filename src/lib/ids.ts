import { randomBytes } from 'crypto';

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomAlphanumeric(length: number): string {
  const bytes = randomBytes(length);
  return Array.from(bytes)
    .map((b) => ALPHANUMERIC[b % ALPHANUMERIC.length])
    .join('');
}

export function generateUserId(): string {
  return `usr-${randomAlphanumeric(8)}`;
}

export function generateTransactionId(): string {
  return `tan-${randomAlphanumeric(8)}`;
}

export function generateAccountId(): string {
  return randomAlphanumeric(16);
}

export function generateAccountNumber(): string {
  const digits = Array.from(randomBytes(6))
    .map((b) => b % 10)
    .join('');
  return `01${digits}`;
}
