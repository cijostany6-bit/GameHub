# 🎮 GameHub

### A Futuristic Gaming Platform Built with AWS & DevOps

GameHub is a portfolio project that combines a futuristic gaming interface with a containerized Node.js backend and a MySQL database — all runnable locally with one command. It demonstrates how frontend applications, backend APIs, container networking, reverse proxies, databases, tests and CI pipelines work together.

The project is being evolved into a production-style application: automated CI/CD, infrastructure as code on AWS, monitoring, and Kubernetes (local kind cluster + Argo CD).

> **Status — Phase 0 complete (2026-10-18):** reproducible local foundation.
> `git clone && make bootstrap` gives a fully working, seeded, smoke-tested stack with **zero configuration**.

---

## 📌 Project Status

**Current phase:** Phase 0 — reproducible local foundation ✅

**Status:** Full stack runs locally end-to-end: `make bootstrap` → seeded database, healthy containers, passing smoke tests. No cloud resources required.

### ✅ Completed (Phase 0)

- Futuristic gaming homepage
- Dedicated Games page
- Dynamic game catalogue loaded through a backend API (12 seeded records)
- Game category filters
- Frontend built with HTML, CSS, and JavaScript
- Node.js and Express backend
- **Local MySQL 8.4 container** with schema + seed (`db/init.sql`) — reproducible on any machine, no cloud account needed
- **Connection pool** (not a connection-per-request), **liveness/readiness split** (`/api/health` vs `/api/ready`), structured JSON logs, CORS locked to explicit origins, generic client-facing errors
- Dockerized frontend and backend with **pinned base images**, `npm ci` from lockfile, **0 npm vulnerabilities**, backend running as **non-root**
- Docker Compose orchestration with **healthchecks + ordered startup**
- Nginx reverse proxy (gzip, security headers) — backend port **not published** to the host
- `make bootstrap` one-command workflow + **smoke test** (`scripts/smoke.sh`)
- Git and GitHub repository setup

### 🚧 Planned

- **Phase 1** — automated tests (unit + integration) and GitHub Actions CI: lint, coverage gate, Trivy, gitleaks
- **Phase 2** — game detail pages, real tournaments/leaderboards (DB-backed), user authentication
- **Phase 3** — observability: metrics, dashboards, alerts, runbooks, SLOs
- **Phase 4** — AWS via CloudFormation: ECR, static frontend on S3 + CloudFront, GitHub Actions OIDC deploy
- **Phase 5** — local Kubernetes (kind) + Argo CD GitOps
- **Phase 6** — security & GDPR hardening (data deletion flow, SBOM)
- **Phase 7** — /learn documentation site, PDF export, load-test report

---

## 🏗️ Architecture

```text
                         Browser
                            |
                            | HTTP :8080
                            v
                    Frontend Nginx
                     Container :80
                            |
                       /api/*
                            |
                            v
                    gamehub-network
                            |
                            v
                    Node.js + Express
                     Backend :3000
                            |
                         MySQL :3306
                            |
                            v
                     MySQL 8.4 container
                   (seeded by db/init.sql)
```

### Request flow

1. A user opens GameHub in the browser.
2. Nginx serves the static frontend files.
3. JavaScript sends API requests to the frontend's `/api/` path.
4. Nginx forwards those requests to the backend container.
5. Express processes the request and queries the MySQL container over the private Docker network.
6. The backend returns JSON, which the frontend uses to render game cards.

**Important:** The browser accesses the frontend through port `8080`. The Nginx container communicates with the backend using Docker networking, and the backend port is **not published to the host** — the database runs as a local MySQL container (a managed cloud database arrives with the infrastructure-as-code phase).

---

## 🧰 Technology Stack

| Technology | Purpose |
|---|---|
| HTML5 | Frontend structure |
| CSS3 | Styling and responsive visual design |
| JavaScript | UI interactions, API requests, and category filters |
| Node.js | Backend JavaScript runtime |
| Express.js | REST API |
| MySQL 8.4 | Relational database, local container (managed RDS via IaC in Phase 4) |
| Docker | Application containerization |
| Docker Compose | Multi-container orchestration |
| Nginx | Static web server and reverse proxy |
| Git | Version control |
| GitHub | Source code hosting |
| Colima | Local Docker runtime on macOS |
| Make | One-command developer workflow (`make bootstrap`) |

---

## 📁 Project Structure

```text
GameHub/
├── frontend/
│   ├── index.html
│   ├── games.html
│   ├── script.js
│   ├── style.css
│   └── nginx.conf
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── .env.example        ← copy to .env only for non-Docker runs
│   ├── db.js               ← connection pool
│   ├── app.js              ← Express app (exported for tests)
│   ├── server.js           ← HTTP entrypoint
│   ├── package.json
│   └── package-lock.json
├── db/
│   └── init.sql            ← schema + seed (runs on first boot)
├── scripts/
│   └── smoke.sh            ← end-to-end checks (CI will reuse it)
├── Dockerfile              ← frontend image (nginx)
├── docker-compose.yml      ← frontend + backend + db
├── Makefile                ← make bootstrap / up / down / smoke / db-reset
├── .dockerignore
├── .gitignore
└── README.md
```

**Security note:** no credentials are needed for local development — the defaults in `docker-compose.yml` are for the private Docker network only. If you run the server outside Docker, copy `backend/.env.example` to `backend/.env`. Real `.env` files are excluded from Git **and** from image builds (`backend/.dockerignore`).

---

## 🚀 Run GameHub Locally

### Prerequisites

- macOS or Linux
- Git
- A Docker runtime + Docker Compose
  (on this Mac: [Colima](https://github.com/abiosoft/colima) — start it with `colima start`)

**No configuration needed.** The stack ships with working local defaults: a MySQL
container is seeded automatically from `db/init.sql` on first start.

### 1. Clone and bootstrap

```bash
git clone https://github.com/cijostany6-bit/GameHub.git
cd GameHub
make bootstrap        # build → start → wait for health → run smoke tests
```

### 2. Open GameHub

**http://localhost:8080**

### Useful commands

```bash
make ps               # container status (healthy?)
make logs             # tail all logs
make smoke            # re-run the end-to-end checks
make down             # stop, keep database data
make db-reset         # wipe + re-seed the database
make clean            # full teardown incl. images and DB volume
make help             # list all targets
```

Prefer plain Compose? `docker-compose up -d --build` then `./scripts/smoke.sh` does the same.

---

## 🔌 Backend API

The following endpoints are implemented in the current application.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | **Liveness** — process is up (never touches the database) |
| GET | `/api/ready` | **Readiness** — database reachable, safe to route traffic (503 otherwise) |
| GET | `/api/games` | Retrieve games from the database |

The API is reachable **only through the nginx proxy on `:8080`** — port `3000`
is deliberately not published to the host (use `docker-compose exec backend …`
if you need direct access from inside the network).

```bash
curl http://localhost:8080/api/health
curl http://localhost:8080/api/ready
curl http://localhost:8080/api/games
```

Or run the full check suite: `make smoke`.

---

## 🗄️ Database

GameHub uses **MySQL 8.4 in a local container**, seeded automatically from
[`db/init.sql`](db/init.sql) on the first start of an empty volume. This makes a
fresh clone reproducible with no cloud account and no secrets. A managed
database (AWS RDS) arrives in Phase 4 via infrastructure as code.

Reset to a clean seeded state any time with `make db-reset`.

The current games table contains these fields:

| Column | Purpose |
|---|---|
| `id` | Game identifier |
| `name` | Game title |
| `category` | Category used by the frontend filters |
| `description` | Short game description |

Sample categories include Action, Racing, and Strategy.

The frontend retrieves game records dynamically through the Express API rather than relying entirely on hardcoded game cards.

---

## 🐳 Docker Design

### Frontend container

- Uses Nginx Alpine.
- Serves HTML, CSS, and JavaScript.
- Loads the custom Nginx configuration.
- Forwards `/api/` requests to the backend service.

### Backend container

- Uses Node.js Alpine.
- Installs application dependencies.
- Runs the Express server.
- Reads database configuration from environment variables.
- Connects to the MySQL container over the private Docker network (no host port published).

### Docker Compose

Compose manages both services and connects them through the `gamehub-network` network.

Useful commands:

```bash
docker-compose ps
docker-compose restart
docker-compose up -d --build frontend
docker-compose up -d --build backend
docker-compose logs -f backend
docker-compose down
```

Rebuild a service after changing its code:

```bash
docker-compose up -d --build frontend
```

Or:

```bash
docker-compose up -d --build backend
```

---

## 🔐 Security Practices

- **No secrets required for local development** — compose defaults live in the private Docker network; nothing sensitive exists in the repo.
- `.env` is excluded from Git **and** from image builds (`backend/.dockerignore`); `backend/.env.example` documents every variable.
- The backend runs as a **non-root** user and reads all configuration from environment variables (12-factor).
- The API port is **not published** to the host — only nginx on `:8080` is reachable.
- `npm ci` from a committed lockfile; the dependency tree is audited (**0 vulnerabilities** at the time of writing).

For the production deployment (Phase 4): secrets come from AWS Systems Manager Parameter Store via the task/instance role — never baked into images.

---

## 🧪 Testing Checklist

- [x] Homepage loads successfully. *(smoke check)*
- [ ] Home and Games navigation works.
- [ ] Tournaments and Leaderboard links navigate to their intended sections.
- [x] Games page loads the catalogue (12 seeded games). *(browser-verified)*
- [ ] Category filters display the expected games.
- [x] Backend liveness endpoint responds. *(smoke check)*
- [x] Backend readiness endpoint reports database state. *(smoke check)*
- [x] Games API returns database records. *(smoke check)*
- [x] Nginx successfully proxies API requests. *(smoke check on :8080)*
- [x] Unknown routes return clean JSON 404s. *(smoke check)*
- [x] Backend port is not reachable from the host. *(verified: connection refused)*
- [x] Database credentials remain untracked (Git **and** image builds).
- [x] A clean rebuild + reseed works via `make bootstrap`. *(verified: full teardown → smoke passed)*

---

## 📚 Skills Demonstrated

- Frontend and backend integration
- REST API development
- Relational database connectivity
- MySQL schema bootstrap and seeding
- Docker image creation
- Multi-container application orchestration
- Docker network communication
- Nginx reverse proxy configuration
- Environment-based configuration
- Healthcheck-driven container startup (ordered dependency waits)
- Liveness vs readiness probe design
- Connection pooling
- Non-root container images, pinned base images, audited lockfiles
- One-command bootstrap + smoke testing
- Git and GitHub workflows
- Application troubleshooting

---

## 🗺️ Roadmap

| Phase | Focus | Status |
|---|---|---|
| **0** | Reproducible local foundation (compose, seed, healthchecks, `make bootstrap`, smoke tests) | ✅ **2026-10-18** |
| **1** | Automated tests + GitHub Actions CI (lint, coverage gate, Trivy, gitleaks) | ⏭️ next |
| **2** | Product depth: game detail pages, DB-backed tournaments/leaderboards, auth | Planned |
| **3** | Observability: metrics, dashboards, alerts, runbooks, SLOs | Planned |
| **4** | AWS via CloudFormation: ECR, S3 + CloudFront frontend, OIDC deploy (CD) | Planned |
| **5** | Local Kubernetes (kind) + Argo CD GitOps | Planned |
| **6** | Security & GDPR hardening (deletion flow, SBOM) | Planned |
| **7** | /learn documentation site + PDF export + load-test report | Planned |

---

## 👨‍💻 Author

**Cijo Stany John**

GameHub is an evolving learning and portfolio project built to practise AWS cloud architecture, backend development, containerization, and DevOps deployment workflows.

---

*Built with curiosity, containers, and a passion for gaming.* 🎮
