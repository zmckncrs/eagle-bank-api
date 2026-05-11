import express from 'express';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import accountsRouter from './routes/accounts';
import transactionsRouter from './routes/transactions';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

app.use('/v1/auth', authRouter);
app.use('/v1/users', usersRouter);
app.use('/v1/accounts', accountsRouter);
app.use('/v1/accounts/:accountNumber/transactions', transactionsRouter);

app.use(errorHandler);

export default app;
