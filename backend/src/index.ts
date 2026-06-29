import 'dotenv/config';
import express from 'express';
import positionRouter from './routes/position';
import { startScheduler } from './scheduler';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', positionRouter);

startScheduler();

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

export { app };
