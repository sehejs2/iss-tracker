# ISS Tracker
🔴 Live Demo: https://iss-tracker-dusky.vercel.app/

<img width="1427" height="676" alt="Screenshot 2026-06-29 at 2 28 39 PM" src="https://github.com/user-attachments/assets/9d5b971f-dd7b-4b4c-bc84-3db164f2fa2d" />

Real-time ISS tracking on a world map with WebSocket-pushed position updates and orbital-mechanics-based visible pass prediction.

## Architecture
```
Open Notify API (every 5 s)
      │
      ▼
Scheduler (node-cron)
      ├── Redis  — latest position, TTL 5 s
      └── Postgres — position_history (append-only)
            │
            ▼
Express + Socket.io
      ├── WS broadcast: iss:position → all clients
      ├── GET  /api/position
      ├── GET  /api/position-history
      └── POST /api/pass-prediction  (SGP4 via satellite.js)
            │
            ▼
React + Leaflet frontend
      ├── Live ISS marker (WebSocket)
      ├── 30-min orbit trail
      └── Visible pass predictor (local-timezone times)
```

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, Leaflet / react-leaflet, socket.io-client |
| Backend | Node.js, Express, TypeScript, Socket.io |
| Orbital mechanics | satellite.js (SGP4 propagation), suncalc (civil twilight) |
| TLE source | Celestrak (refreshed daily, cached in Redis) |
| Database | PostgreSQL |
| Cache | Redis |
| Scheduler | node-cron |
| Deployment | Backend + Postgres + Redis on Railway; frontend on Vercel |

## Local development

**Prerequisites:** Node 22+, PostgreSQL, Redis running locally.

### Backend

```bash
cd backend
cp .env.example .env        # fill in DATABASE_URL, REDIS_URL
npm install
npm run migrate             # creates position_history + saved_locations tables
npm run dev                 # ts-node, port 3001
```

### Frontend

```bash
cd frontend
cp .env.example .env        # set VITE_API_URL=http://localhost:3001
npm install
npm run dev                 # Vite, port 5173
```

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | Postgres connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `PORT` | `3001` | HTTP port |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001` | Backend base URL |

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/position` | Latest ISS position (Redis → Postgres fallback). Includes `source: "cache" \| "db"`. |
| `GET` | `/api/position-history?since=<ISO>` | Historical positions in ascending order. Omit `since` for the most recent 1 000 rows. |
| `POST` | `/api/pass-prediction` | Body: `{ latitude, longitude }`. Returns visible passes over the next 48 hours. |
| `WS` | `iss:position` | Socket.io event pushed every 5 s to all connected clients. |

## Pass prediction

Uses real SGP4 orbital propagation (satellite.js) against a TLE fetched from Celestrak and cached in Redis for 24 hours. A pass is reported as visible only when all three conditions hold simultaneously at the same 15-second sample:

1. **ISS ≥ 10° above the observer's horizon** — computed via ECI → ECF → local look-angle transform.
2. **ISS in sunlight** — cylindrical Earth shadow model: illuminated unless on the night side of Earth *and* within Earth's shadow cylinder.
3. **Observer past civil twilight** — Sun more than 6° below the horizon at the observer's location (suncalc).

## Docker (backend)

```bash
cd backend
docker build -t iss-tracker-backend .
docker run -p 3001:3001 --env-file .env iss-tracker-backend
```

The image uses a two-stage build: TypeScript is compiled in a `builder` stage; the `runtime` stage ships only compiled JS and production dependencies (~180 MB on Alpine).
