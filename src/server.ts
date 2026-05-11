import app from './app';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.listen(PORT, () => {
  console.log(`Eagle Bank API running on http://localhost:${PORT}`);
});
