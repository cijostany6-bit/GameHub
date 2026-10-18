# syntax=docker/dockerfile:1
# =========================================================
# GameHub backend — Node.js 22 (pinned minor line)
# Reproducible build: lockfile copied, `npm ci`, non-root.
# =========================================================
FROM node:22-alpine

WORKDIR /app

# Dependency layer first — cached unless the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Application code (backend/.dockerignore keeps secrets out)
COPY . .

ENV NODE_ENV=production

# Serve as the unprivileged `node` user, not root.
USER node

EXPOSE 3000

# Liveness only (no DB dependency) — readiness is /api/ready.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
    CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
