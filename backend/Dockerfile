# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first so this layer is cached unless package files change
COPY package*.json ./
RUN npm ci --include=dev

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

# Production deps only — devDependencies (tsc, ts-node, @types/*) are excluded
COPY package*.json ./
RUN npm ci --omit=dev

# Compiled JS from the builder stage
COPY --from=builder /app/dist ./dist

# Migrations are plain SQL; include them so Railway can run npm run migrate
COPY migrations ./migrations

EXPOSE 3001

CMD ["node", "dist/index.js"]
