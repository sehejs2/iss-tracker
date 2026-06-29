import axios from 'axios';
import cron from 'node-cron';
import { redis } from './redis';

// ISS NORAD catalog number 25544.  FORMAT=TLE gives the classic 3-line format:
//   line 0: name
//   line 1: TLE line 1 (starts with "1 ")
//   line 2: TLE line 2 (starts with "2 ")
const CELESTRAK_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';
const REDIS_TLE_KEY = 'iss:tle';
const TLE_TTL_SECONDS = 86_400; // 24 hours

export interface TleData {
  line1: string;
  line2: string;
  fetchedAt: string;
}

async function fetchFromCelestrak(): Promise<TleData> {
  const { data } = await axios.get<string>(CELESTRAK_URL, { responseType: 'text' });
  const lines = data.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 3) {
    throw new Error(`Unexpected TLE format from Celestrak: "${data.slice(0, 80)}"`);
  }
  return { line1: lines[1], line2: lines[2], fetchedAt: new Date().toISOString() };
}

// Returns TLE from Redis cache if still fresh; otherwise fetches from
// Celestrak and re-caches.  Callers should never hold a reference longer than
// one request — always call getTle() so stale elements are never used.
export async function getTle(): Promise<TleData> {
  const cached = await redis.get(REDIS_TLE_KEY);
  if (cached) return JSON.parse(cached) as TleData;

  const tle = await fetchFromCelestrak();
  await redis.set(REDIS_TLE_KEY, JSON.stringify(tle), 'EX', TLE_TTL_SECONDS);
  console.log('[tle] fetched fresh from Celestrak:', tle.fetchedAt);
  return tle;
}

// TLEs degrade in accuracy over days.  Refresh every midnight UTC so the
// orbital elements used for pass prediction never trail reality by more than
// ~24 hours.  Even at 24 h, SGP4 position error is only a few km — fine for
// naked-eye pass prediction (which has ~1-minute timing uncertainty anyway).
export function startTleRefresh(): void {
  cron.schedule('0 0 * * *', async () => {
    try {
      const tle = await fetchFromCelestrak();
      await redis.set(REDIS_TLE_KEY, JSON.stringify(tle), 'EX', TLE_TTL_SECONDS);
      console.log('[tle] refreshed:', tle.fetchedAt);
    } catch (err) {
      console.error('[tle] daily refresh failed (stale TLE still cached):', err);
    }
  });
}
