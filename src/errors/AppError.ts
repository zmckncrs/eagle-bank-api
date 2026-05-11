export interface ErrorDetail {
  field: string;
  message: string;
  type: string;
}

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: ErrorDetail[]
  ) {
    super(message);
    this.name = 'AppError';
  }
}
