import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { signToken } from '../lib/jwt';
import { validate } from '../middleware/validate';
import { loginSchema, LoginInput } from '../validation/schemas';
import { AppError } from '../errors/AppError';

const router = Router();

router.post(
  '/login',
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as LoginInput;

      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        return next(new AppError(401, 'Invalid email or password'));
      }

      const passwordMatch = await bcrypt.compare(password, user.passwordHash);

      if (!passwordMatch) {
        return next(new AppError(401, 'Invalid email or password'));
      }

      const token = signToken({ userId: user.id });

      res.status(200).json({ token, userId: user.id });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
