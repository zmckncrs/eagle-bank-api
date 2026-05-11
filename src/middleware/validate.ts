import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../errors/AppError';

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join('.') || 'body',
        message: e.message,
        type: e.code,
      }));
      return next(new AppError(400, 'Invalid details supplied', details));
    }

    req.body = result.data;
    next();
  };
}
