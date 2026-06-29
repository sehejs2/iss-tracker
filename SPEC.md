# ISS Tracker — Project Spec

## Overview
A real-time ISS tracking app: a live world map shows the ISS's current position,
updated via WebSocket push (not client polling). Users can enter their location
and get a prediction of the next time the ISS will be visible overhead.

Core engineering goals this project must demonstrate:
- Caching strategy (Redis) to avoid hammering an upstream API
- Scheduled background jobs (poll ISS position on an interval)
- Real-time fan-out to many concurrent clients (WebSockets)
- A non-trivial geometry/algorithm component (pass prediction), not just API wrapping
- Clean schema design (Postgres)

## Tech Stack
- **Frontend:** React + TypeScript, Leaflet.js
- **Backend:** Node.js + Express, TypeScript
- **Database:** PostgreSQL
- **Cache:** Redis
- **Real-time:** Socket.io
- **Scheduler:** node-cron (or equivalent interval worker)
- **Data source:** Open Notify API (`http://api.open-notify.org/iss-now.json`)
- **Deployment:** Backend + Postgres + Redis on Railway; Frontend on Vercel

## Architecture
```
Open Notify API
      |
      v
Scheduler worker (polls every 5s)
      |
      +--> Redis (latest position, TTL 5s)
      +--> Postgres (position_history table, append-only log)
      |
      v
Express API + Socket.io server
      |
      +--> WebSocket broadcast: latest position --> all connected clients
      +--> REST endpoint: POST /pass-prediction { lat, long } --> next visible pass
      |
      v
React + Leaflet frontend
      - Live ISS marker (WebSocket-driven)
      - "Enter your location" form --> calls /pass-prediction
      - Optional: trailing orbit path, day/night terminator overlay
```

## Database Schema

### `position_history`
| column     | type      | notes                          |
|------------|-----------|---------------------------------|
| id         | serial PK |                                  |
| latitude   | float     |                                  |
| longitude  | float     |                                  |
| recorded_at| timestamp | when this position was polled   |

### `saved_locations`
| column     | type      | notes                          |
|------------|-----------|---------------------------------|
| id         | serial PK |                                  |
| latitude   | float     | user's location                 |
| longitude  | float     |                                  |
| label      | text      | optional, user-provided name    |
| created_at | timestamp |                                  |

## API Endpoints
- `GET /api/position` — returns latest cached ISS position (Redis-backed, fallback to Postgres if cache miss)
- `POST /api/pass-prediction` — body: `{ latitude, longitude }` → returns next predicted visible pass time(s)
- `GET /api/position-history?since=<timestamp>` — returns historical position log (for orbit trail rendering)
- WebSocket event `iss:position` — pushed to all clients whenever the scheduler refreshes the position

## Phased Build Plan

### Phase 1 — Backend core
- Express + TypeScript server scaffold
- Postgres connection + migrations for the two tables above
- Redis connection
- Scheduler worker: poll Open Notify every 5s, write to Redis (TTL 5s) and append to `position_history`
- Unit test the scheduler in isolation (mock the upstream API call)

### Phase 2 — Real-time layer
- Integrate Socket.io into the Express server
- On every scheduler tick, broadcast `iss:position` to all connected sockets
- Manually verify with 2+ simultaneous client connections that all receive updates in sync

### Phase 3 — Pass-prediction logic
- Implement spherical geometry: given observer lat/long + ISS current lat/long/altitude (Open Notify doesn't give altitude/velocity — may need a TLE-based approach using a library like `satellite.js` for real orbital mechanics, or a simplified line-of-sight heuristic as a fallback)
- Decide and document explicitly: are we doing real orbital propagation (TLE + SGP4, via satellite.js) or a simplified visibility heuristic? This decision should be written down — it matters for interview defensibility.
- Endpoint: `POST /api/pass-prediction`

### Phase 4 — Frontend
- React + Leaflet map, marker subscribes to `iss:position` WebSocket event
- Location input form → calls pass-prediction endpoint → displays result
- Optional polish: orbit trail (use `position-history` endpoint), day/night terminator overlay (Leaflet plugin)

### Phase 5 — Deploy + polish
- Dockerize backend (reuse Docker pattern from Gies experience)
- Deploy backend + Postgres + Redis on Railway
- Deploy frontend on Vercel
- README: architecture diagram, real cache hit-rate numbers (measure, don't estimate), live demo link

## Open Decisions (resolve before/during Phase 3)
1. Real orbital mechanics (satellite.js + TLE data) vs. simplified heuristic — pick one and document why.
2. Pinpoint exact "visibility" criteria (e.g., ISS must be above horizon AND it must be dusk/dawn/night locally, since ISS is only visible to the naked eye when sunlit against a dark sky).

## Non-goals (explicitly out of scope for v1)
- User accounts/auth
- Mobile app (web-only, responsive is enough)
- Notifications/alerts for upcoming passes (could be a v2 stretch goal)
