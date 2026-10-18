# Step 0 — Reproducible Local Foundation ✅ (2026-10-18)

> **Verified by:** `scripts/smoke.sh` (5 checks) · full `make clean` →
> `make bootstrap` teardown-and-rebuild · browser check (12 DB-backed cards)

## What was built

The stack went from **not runnable at all** (dead AWS RDS endpoint, no local
database, Docker runtime down) to `git clone && make bootstrap` giving a fully
working, seeded application with **zero configuration**.

| Piece | Decision | Why not the alternative |
|---|---|---|
| MySQL **8.4 container** + `db/init.sql` | Auto-seeds schema + 12 games on first boot of an empty volume | *Cloud DB now* → needs an account, costs money, breaks fresh clones; *no DB* → the original state, catalogue dead |
| **Connection pool** (`mysql2/promise`) | One shared pool, `connectionLimit: 10` | *Connection per request* (what existed) → TCP+TLS handshake on every request, exhausts MySQL `max_connections` under load |
| **Liveness vs readiness split** | `/api/health` never touches the DB; `/api/ready` does | *Health checks the DB* (what existed) → a database blip makes the orchestrator think the app is dead → crash-looping containers |
| **Healthchecks + ordered startup** in compose | `db` healthy → `backend` healthy → `frontend` starts | *`depends_on` without conditions* → app starts before MySQL accepts connections → first queries fail |
| **No published API port** | Only nginx `:8080` reaches the host | *Publishing `:3000`* → the API bypasses the proxy layer on every developer machine |
| Pinned images + `npm ci` + non-root | `node:22-alpine`, `nginx:1.29-alpine`, `mysql:8.4`, uid 1000 | *`node:alpine` + `npm install`* → unreproducible builds, root processes |

## The bugs we hit

1. **Critical npm advisory** (`proxy-addr`, IP spoofing via IPv4-mapped IPv6)
   surfaced by `npm audit` during the build → fixed with `npm audit fix`,
   lockfile updated, image rebuilt, 0 vulnerabilities since.
2. **A README claim was false**: it said "AWS RDS integration" while the
   configured endpoint did not even resolve (NXDOMAIN). The honest fix — a
   local database plus an honest status table — beat any workaround.

## Concepts to understand cold

- Why a **pool** beats per-request connections (and what `connectionLimit` protects)
- **Liveness vs readiness**: which probe answers "should I restart you?" vs
  "should I send you traffic?" — and why mixing them causes crash loops
- **Layer caching**: dependency layer (`package.json` + lockfile) before source
  so code edits don't re-download packages
- What `docker-entrypoint-initdb.d` does (and why it only runs on an *empty* volume)

## Interview questions this unlocks

1. *"Your service is running but `/api/ready` returns 503 — what's happening and
   what do you do?"*
2. *"How do you make an application reproducible for a new developer?"*
3. *"Why is your backend port not exposed on the host?"*
4. *"The database container was recreated and your data is gone — why, and how
   do you prevent it?"* (named volume; `make db-reset` is the *intentional* wipe)
