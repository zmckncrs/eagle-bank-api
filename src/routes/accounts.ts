import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { generateAccountId, generateAccountNumber } from '../lib/ids';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { createAccountSchema, updateAccountSchema, CreateAccountInput, UpdateAccountInput } from '../validation/schemas';
import { AppError } from '../errors/AppError';
import { Account } from '@prisma/client';

const router = Router();

function formatAccount(account: Account) {
  return {
    accountNumber: account.accountNumber,
    sortCode: account.sortCode,
    name: account.name,
    accountType: account.accountType,
    balance: account.balance,
    currency: account.currency,
    createdTimestamp: account.createdTimestamp.toISOString(),
    updatedTimestamp: account.updatedTimestamp.toISOString(),
  };
}

router.post(
  '/',
  authenticate,
  validate(createAccountSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateAccountInput;
      const userId = req.userId!;

      let accountNumber: string;
      let attempts = 0;

      do {
        accountNumber = generateAccountNumber();
        attempts++;
        if (attempts > 10) {
          return next(new AppError(500, 'An unexpected error occurred'));
        }
      } while (await prisma.account.findUnique({ where: { accountNumber } }));

      const account = await prisma.account.create({
        data: {
          id: generateAccountId(),
          accountNumber,
          userId,
          name: body.name,
          accountType: body.accountType,
        },
      });

      res.status(201).json(formatAccount(account));
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const accounts = await prisma.account.findMany({
        where: { userId: req.userId },
      });

      res.status(200).json({ accounts: accounts.map(formatAccount) });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:accountNumber',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { accountNumber } = req.params;

      const account = await prisma.account.findUnique({ where: { accountNumber } });

      if (!account) {
        return next(new AppError(404, 'Bank account was not found'));
      }

      if (account.userId !== req.userId) {
        return next(new AppError(403, 'You are not allowed to access this bank account'));
      }

      res.status(200).json(formatAccount(account));
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:accountNumber',
  authenticate,
  validate(updateAccountSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { accountNumber } = req.params;
      const body = req.body as UpdateAccountInput;

      const existing = await prisma.account.findUnique({ where: { accountNumber } });

      if (!existing) {
        return next(new AppError(404, 'Bank account was not found'));
      }

      if (existing.userId !== req.userId) {
        return next(new AppError(403, 'You are not allowed to update this bank account'));
      }

      const account = await prisma.account.update({
        where: { accountNumber },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.accountType !== undefined ? { accountType: body.accountType } : {}),
        },
      });

      res.status(200).json(formatAccount(account));
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:accountNumber',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { accountNumber } = req.params;

      const existing = await prisma.account.findUnique({ where: { accountNumber } });

      if (!existing) {
        return next(new AppError(404, 'Bank account was not found'));
      }

      if (existing.userId !== req.userId) {
        return next(new AppError(403, 'You are not allowed to delete this bank account'));
      }

      await prisma.transaction.deleteMany({ where: { accountId: existing.id } });
      await prisma.account.delete({ where: { accountNumber } });

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
