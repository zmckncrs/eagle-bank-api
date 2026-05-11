import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { AppError } from '../errors/AppError';

export interface AuthRequest extends Request {
  userId?: string;
}

export function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError(401, 'Access token is missing or invalid'));
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    next(new AppError(401, 'Access token is missing or invalid'));
  }
}
