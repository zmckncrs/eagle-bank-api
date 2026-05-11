import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { generateUserId } from '../lib/ids';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { createUserSchema, updateUserSchema, CreateUserInput, UpdateUserInput } from '../validation/schemas';
import { AppError } from '../errors/AppError';
import { User } from '@prisma/client';

const router = Router();

function formatUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    address: {
      line1: user.addressLine1,
      ...(user.addressLine2 ? { line2: user.addressLine2 } : {}),
      ...(user.addressLine3 ? { line3: user.addressLine3 } : {}),
      town: user.addressTown,
      county: user.addressCounty,
      postcode: user.addressPostcode,
    },
    phoneNumber: user.phoneNumber,
    email: user.email,
    createdTimestamp: user.createdTimestamp.toISOString(),
    updatedTimestamp: user.updatedTimestamp.toISOString(),
  };
}

router.post(
  '/',
  validate(createUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateUserInput;

      const existing = await prisma.user.findUnique({ where: { email: body.email } });
      if (existing) {
        return next(
          new AppError(400, 'Invalid details supplied', [
            { field: 'email', message: 'Email is already in use', type: 'conflict' },
          ])
        );
      }

      const passwordHash = await bcrypt.hash(body.password, 10);
      const id = generateUserId();

      const user = await prisma.user.create({
        data: {
          id,
          name: body.name,
          addressLine1: body.address.line1,
          addressLine2: body.address.line2,
          addressLine3: body.address.line3,
          addressTown: body.address.town,
          addressCounty: body.address.county,
          addressPostcode: body.address.postcode,
          phoneNumber: body.phoneNumber,
          email: body.email,
          passwordHash,
        },
      });

      res.status(201).json(formatUser(user));
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:userId',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      if (userId !== req.userId) {
        return next(new AppError(403, 'You are not allowed to access this user'));
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        return next(new AppError(404, 'User was not found'));
      }

      res.status(200).json(formatUser(user));
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:userId',
  authenticate,
  validate(updateUserSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      if (userId !== req.userId) {
        return next(new AppError(403, 'You are not allowed to update this user'));
      }

      const existing = await prisma.user.findUnique({ where: { id: userId } });
      if (!existing) {
        return next(new AppError(404, 'User was not found'));
      }

      const body = req.body as UpdateUserInput;

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.phoneNumber !== undefined ? { phoneNumber: body.phoneNumber } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.address !== undefined
            ? {
                addressLine1: body.address.line1,
                addressLine2: body.address.line2,
                addressLine3: body.address.line3,
                addressTown: body.address.town,
                addressCounty: body.address.county,
                addressPostcode: body.address.postcode,
              }
            : {}),
        },
      });

      res.status(200).json(formatUser(user));
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:userId',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      if (userId !== req.userId) {
        return next(new AppError(403, 'You are not allowed to delete this user'));
      }

      const existing = await prisma.user.findUnique({ where: { id: userId } });
      if (!existing) {
        return next(new AppError(404, 'User was not found'));
      }

      const accounts = await prisma.account.findMany({ where: { userId } });
      if (accounts.length > 0) {
        return next(
          new AppError(409, 'User cannot be deleted while they have active bank accounts')
        );
      }

      await prisma.user.delete({ where: { id: userId } });

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
