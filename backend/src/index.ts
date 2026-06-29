import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import { Server } from 'socket.io';
import positionRouter from './routes/position';
import passPredictionRouter from './routes/passPrediction';
import { startScheduler } from './scheduler';
import { startTleRefresh } from './tle';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', positionRouter);
app.use('/api', passPredictionRouter);

// Wrap Express in a plain HTTP server so Socket.io can share the same port.
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*' },
});

io.on('connection', socket => {
  console.log(`[ws] client connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`[ws] client disconnected: ${socket.id}`));
});

startScheduler(io);
startTleRefresh();

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

export { app, io };
