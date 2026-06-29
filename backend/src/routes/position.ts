import { Router } from 'express';
import { pool } from '../db';
import { redis, } from '../redis';
import { REDIS_POSITION_KEY, type ISSPosition } from '../scheduler';

const router = Router();

// Returns the latest ISS position. Tries Redis first (written by the scheduler
// every 5 s with a matching TTL); falls back to the most recent Postgres row
// on a cold start or cache miss.
router.get('/position', async (_req, res) => {
  try {
    const cached = await redis.get(REDIS_POSITION_KEY);
    if (cached) {
      res.json({ source: 'cache', position: JSON.parse(cached) as ISSPosition });
      return;
    }

    const { rows } = await pool.query<ISSPosition>(
      'SELECT latitude, longitude, recorded_at FROM position_history ORDER BY recorded_at DESC LIMIT 1',
    );

    if (rows.length === 0) {
      res.status(503).json({ error: 'No position data available yet — scheduler may still be starting up' });
      return;
    }

    res.json({ source: 'db', position: rows[0] });
  } catch (err) {
    console.error('[GET /api/position]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Returns historical ISS positions in ascending chronological order.
// `since` (ISO 8601 timestamp) filters to rows recorded after that point.
// Without `since`, returns the most recent 1 000 rows (enough for a full
// orbit trail without unbounded result sets).
router.get('/position-history', async (req, res) => {
  const { since } = req.query;

  if (since !== undefined) {
    if (typeof since !== 'string' || isNaN(Date.parse(since))) {
      res.status(400).json({ error: '`since` must be a valid ISO 8601 timestamp' });
      return;
    }
  }

  try {
    const { rows } = since
      ? await pool.query<ISSPosition>(
          'SELECT latitude, longitude, recorded_at FROM position_history WHERE recorded_at > $1 ORDER BY recorded_at ASC',
          [since],
        )
      : await pool.query<ISSPosition>(
          'SELECT latitude, longitude, recorded_at FROM position_history ORDER BY recorded_at DESC LIMIT 1000',
        );

    res.json({ positions: since ? rows : rows.reverse() });
  } catch (err) {
    console.error('[GET /api/position-history]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
