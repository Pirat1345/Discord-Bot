# ── Stage 1: Build Frontend ──────────────────────────────────
FROM node:22-slim AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 make g++ libopus-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Production ─────────────────────────────────────
FROM node:22-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 make g++ libopus-dev ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && \
    apt-get purge -y python3 make g++ && \
    apt-get autoremove -y

COPY server/ ./server/

# Built frontend from stage 1
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV API_PORT=3001

EXPOSE 3001

CMD ["node", "server/index.js"]
