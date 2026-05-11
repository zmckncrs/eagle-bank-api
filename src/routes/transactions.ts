import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { generateTransactionId } from '../lib/ids';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { createTransactionSchema, CreateTransactionInput } from '../validation/schemas';
import { AppError } from '../errors/AppError';
import { Transaction } from '@prisma/client';

const router = Router({ mergeParams: true });

function formatTransaction(transaction: Transaction) {
  return {
    id: transaction.id,
    amount: transaction.amount,
    currency: transaction.currency,
    type: transaction.type,
    ...(transaction.reference ? { reference: transaction.reference } : {}),
    userId: transaction.userId,
    createdTimestamp: transaction.createdTimestamp.toISOString(),
  };
}

router.post(
  '/',
  authenticate,
  validate(createTransactionSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { accountNumber } = req.params;
      const body = req.body as CreateTransactionInput;
      const userId = req.userId!;

      const account = await prisma.account.findUnique({ where: { accountNumber } });

      if (!account) {
        return next(new AppError(404, 'Bank account was not found'));
      }

      if (account.userId !== userId) {
        return next(new AppError(403, 'You are not allowed to access this bank account'));
      }

      if (body.type === 'withdrawal' && account.balance < body.amount) {
        return next(new AppError(422, 'Insufficient funds to process transaction'));
      }

      const balanceDelta = body.type === 'deposit' ? body.amount : -body.amount;

      const [transaction] = await prisma.$transaction([
        prisma.transaction.create({
          data: {
            id: generateTransactionId(),
            accountId: account.id,
            userId,
            amount: body.amount,
            currency: body.currency,
            type: body.type,
            reference: body.reference,
          },
        }),
        prisma.account.update({
          where: { id: account.id },
          data: { balance: account.balance + balanceDelta },
        }),
      ]);

      res.status(201).json(formatTransaction(transaction));
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
      const { accountNumber } = req.params;

      const account = await prisma.account.findUnique({ where: { accountNumber } });

      if (!account) {
        return next(new AppError(404, 'Bank account was not found'));
      }

      if (account.userId !== req.userId) {
        return next(new AppError(403, 'You are not allowed to access this bank account'));
      }

      const transactions = await prisma.transaction.findMany({
        where: { accountId: account.id },
        orderBy: { createdTimestamp: 'desc' },
      });

      res.status(200).json({ transactions: transactions.map(formatTransaction) });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:transactionId',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { accountNumber, transactionId } = req.params;

      const account = await prisma.account.findUnique({ where: { accountNumber } });

      if (!account) {
        return next(new AppError(404, 'Bank account was not found'));
      }

      if (account.userId !== req.userId) {
        return next(new AppError(403, 'You are not allowed to access this bank account'));
      }

      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        return next(new AppError(404, 'Transaction was not found'));
      }

      if (transaction.accountId !== account.id) {
        return next(new AppError(404, 'Transaction was not found'));
      }

      res.status(200).json(formatTransaction(transaction));
    } catch (err) {
      next(err);
    }
  }
);

export default router;
