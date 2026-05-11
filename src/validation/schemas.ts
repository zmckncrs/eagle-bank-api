import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.object({
    line1: z.string().min(1, 'Address line1 is required'),
    line2: z.string().optional(),
    line3: z.string().optional(),
    town: z.string().min(1, 'Town is required'),
    county: z.string().min(1, 'County is required'),
    postcode: z.string().min(1, 'Postcode is required'),
  }),
  phoneNumber: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format (e.g. +441234567890)'),
  email: z.string().email('Must be a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const updateUserSchema = z
  .object({
    name: z.string().min(1).optional(),
    address: z
      .object({
        line1: z.string().min(1, 'Address line1 is required'),
        line2: z.string().optional(),
        line3: z.string().optional(),
        town: z.string().min(1, 'Town is required'),
        county: z.string().min(1, 'County is required'),
        postcode: z.string().min(1, 'Postcode is required'),
      })
      .optional(),
    phoneNumber: z
      .string()
      .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format')
      .optional(),
    email: z.string().email('Must be a valid email address').optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const loginSchema = z.object({
  email: z.string().email('Must be a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Account name is required'),
  accountType: z.enum(['personal'], {
    errorMap: () => ({ message: 'accountType must be "personal"' }),
  }),
});

export const updateAccountSchema = z
  .object({
    name: z.string().min(1).optional(),
    accountType: z
      .enum(['personal'], { errorMap: () => ({ message: 'accountType must be "personal"' }) })
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const createTransactionSchema = z.object({
  amount: z
    .number({ invalid_type_error: 'amount must be a number' })
    .positive('amount must be greater than 0')
    .max(10000, 'amount cannot exceed 10000'),
  currency: z.enum(['GBP'], { errorMap: () => ({ message: 'currency must be "GBP"' }) }),
  type: z.enum(['deposit', 'withdrawal'], {
    errorMap: () => ({ message: 'type must be "deposit" or "withdrawal"' }),
  }),
  reference: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
