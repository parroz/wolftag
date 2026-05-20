# ── Stage 1: install production deps ─────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
# native module build tools (required by better-sqlite3)
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: build TypeScript ─────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

# ── Stage 3: lean runtime image ───────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

COPY --from=deps    /app/node_modules    ./node_modules
COPY --from=builder /app/dist            ./dist
# SQL files are not compiled by tsc — copy them next to the JS output
COPY src/db/migrations ./dist/db/migrations

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/app.db

EXPOSE 3000

# /data is mounted as a named volume to persist the SQLite database
VOLUME ["/data"]

# server.ts already imports runMigrations — migrations run on every startup
CMD ["node", "dist/server.js"]
