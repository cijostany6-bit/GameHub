# syntax=docker/dockerfile:1
# =========================================================
# GameHub backend — Node.js 22 (pinned minor line)
# Reproducible build: lockfile copied, `npm ci`, non-root.
# =========================================================
FROM node:22-alpine

# Apply the Alpine security updates that exist on top of this base tag
# (see the same line in the frontend Dockerfile for the reasoning: the
# scan, not the tag, is what tells you whether the base is current).
RUN apk upgrade --no-cache

WORKDIR /app

# Dependency layer first — cached unless the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# The runtime never runs npm, so it should not contain npm. Deleting the
# package manager also deletes its own bundled dependency tree, which is a
# real part of the shipped attack surface: an image scan of the previous
# build reported 10 HIGH findings inside /usr/local/lib/node_modules/npm
# (picomatch, sigstore, pacote, …) in an image whose entrypoint is
# `node server.js` and which never invokes any of it.
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

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
