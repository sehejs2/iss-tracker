import axios from 'axios';
import cron from 'node-cron';
import { pool } from './db';
import { redis } from './redis';

export interface ISSPosition {
  latitude: number;
  longitude: number;
  recorded_at: string;
}

interface OpenNotifyResponse {
  iss_position: { latitude: string; longitude: string };
  timestamp: number;
  message: string;
}

const OPEN_NOTIFY_URL = 'http://api.open-notify.org/iss-now.json';
export const REDIS_POSITION_KEY = 'iss:position';
const REDIS_TTL_SECONDS = 5;

async function fetchAndStore(): Promise<void> {
  const { data } = await axios.get<OpenNotifyResponse>(OPEN_NOTIFY_URL);
  const position: ISSPosition = {
    latitude: parseFloat(data.iss_position.latitude),
    longitude: parseFloat(data.iss_position.longitude),
    // Open Notify gives a Unix timestamp; convert to ISO for consistent storage.
    recorded_at: new Date(data.timestamp * 1000).toISOString(),
  };

  await Promise.all([
    redis.set(REDIS_POSITION_KEY, JSON.stringify(position), 'EX', REDIS_TTL_SECONDS),
    pool.query(
      'INSERT INTO position_history (latitude, longitude, recorded_at) VALUES ($1, $2, $3)',
      [position.latitude, position.longitude, position.recorded_at],
    ),
  ]);
}

// Polls Open Notify every 5 s. Errors are logged without crashing the process
// so a transient network hiccup doesn't kill the scheduler.
export function startScheduler(): void {
  cron.schedule('*/5 * * * * *', () => {
    fetchAndStore().catch(err => console.error('[scheduler]', err));
  });
}
