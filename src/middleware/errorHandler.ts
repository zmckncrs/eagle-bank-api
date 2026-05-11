import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    if (err.details) {
      res.status(err.statusCode).json({ message: err.message, details: err.details });
    } else {
      res.status(err.statusCode).json({ message: err.message });
    }
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'An unexpected error occurred' });
}
