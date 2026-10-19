# 🎮 GameHub

### A Futuristic Gaming Platform Built with AWS & DevOps

[![CI](https://github.com/cijostany6-bit/GameHub/actions/workflows/ci.yml/badge.svg)](https://github.com/cijostany6-bit/GameHub/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Tests](https://img.shields.io/badge/tests-64%20passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-%E2%89%A580%25%20gated-blue)

GameHub is a portfolio project that combines a futuristic gaming interface with a containerized Node.js backend and a MySQL database — all runnable locally with one command. It demonstrates how frontend applications, backend APIs, container networking, reverse proxies, databases, tests and CI pipelines work together.

The project is being evolved into a production-style application: automated CI/CD, infrastructure as code on AWS, monitoring, and Kubernetes (local kind cluster + Argo CD).

> **Status — Phase 4 complete (2026-10-19):** tested, CI'd, game-y, playable,
> and **live on AWS**. 64 automated tests, a Cognito sign-in gate, the static
> site on S3 + CloudFront, the API on EC2, all described as CloudFormation and
> deployed by keyless GitHub OIDC.

**Live demo:** <https://d2qf9zxehny6bk.cloudfront.net> — create an account
(email confirmation), sign in, and play. The landing page is public; the
catalogue and the games require a signed-in player.

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

### ✅ Completed (Phase 1 — tests & CI)

- **14 automated tests** using Node's built-in `node:test` (zero extra test deps):
  unit suite (runs anywhere, no DB) + integration suite against real MySQL
  (skips loudly if no database is reachable)
- Behavioural coverage of the paths that matter: liveness survives a database
  outage while readiness returns 503, CORS refuses unknown origins, driver
  errors never leak to clients, malformed JSON → 400
- **Coverage gate**: ≥80% lines / branches / functions or CI fails
- **ESLint** (flat config) as a build gate
- **GitHub Actions CI — 3 jobs on every push/PR:**
  1. lint + tests + coverage gate against a MySQL **service container**
  2. **full-stack smoke test** — builds the real Docker images, runs the real
     compose stack on the runner
  3. **security scans** — gitleaks (full history), Trivy (CRITICAL/HIGH), npm audit
- Local equivalents: `make test` · `make lint` · `make coverage`

### ✅ Completed (Phase 2 — game-y UI)

- **Live animated background**: canvas starfield (3 parallax layers, pixel
  stars), rising neon pixel particles, rare shooting stars — plus a scrolling
  grid and a drifting neon orb. Zero JS dependencies, ~118 draw calls/frame
- **GDPR-clean fonts**: Press Start 2P (arcade accents) + Chakra Petch
  (headings/body) **self-hosted** as woff2 with OFL licenses in-repo — the
  Google Fonts CDN import is gone, so **zero third-party requests** at load
- **Accessibility**: `prefers-reduced-motion` visitors get a fully static page
  (canvas is never even created)
- Arcade styling on all interactive elements (PS2P buttons with press feel)

### ✅ Completed (Phase 3 — real playable games)

- **All 12 catalogue games are actually playable** — `play.html?id=<n>` fetches
  the title and runs one of **6 dependency-free canvas engines**: snake,
  breakout, survival-racing (dodge), memory, reflex targeting, pong
- Runner state machine: READY → PLAYING → GAME OVER with **Play again**, HUD
  (score / best / status), per-title **high scores in localStorage** (guarded),
  controls help, Escape → catalogue
- **`GET /api/games/:id`** endpoint: honest 404s for unknown *and* non-numeric
  ids; malformed/oversized JSON now 400/413 instead of 500
- **Frontend tests (21)**: the six engines execute in Node against a stubbed
  canvas — frame-driven, asserting real terminal paths; plus a **coverage
  contract test** that fails CI if any seeded title lacks an engine
- An engine test found and fixed a real stall bug (dead-centre breakout hit →
  vertical ball → unwinnable game)

### ✅ Completed (Phase 4 — real auth + live on AWS)

- **Cognito sign-in gate**: sign-up with email confirmation, sign-in, sign-out.
  The static frontend talks to Cognito's REST API directly (no Amplify, no SDK)
  and sends the ID token as a `Bearer` header on every `/api/*` call
- **Server-side token verification** (`backend/auth.js`): RS256 signature checked
  against the pool's JWKS with `node:crypto`, plus `iss`, `aud`/`client_id`,
  `exp` and `token_use` — no `jsonwebtoken` dependency
- **Honest fail-open**: the gate is enforced only when the pool is configured;
  local development runs open and the backend logs an `auth_disabled` warning
  at boot — never a silent bypass
- **Static site on S3 + CloudFront**: private bucket, CloudFront Origin Access
  Control, `/api/*` behaviour with caching disabled, HTML short-cache vs assets
  long-cache
- **API host on EC2** running the *same* `docker-compose.yml` as local
  development (nginx + Express + MySQL), with a 2 GB swap file for headroom
- **No SSH**: the security group opens port 8080 to the AWS-managed CloudFront
  origin-facing prefix list only; administration is via SSM Session Manager,
  IMDSv2 is required and the root volume is encrypted
- **Four CloudFormation stacks** (`infra/cognito.yaml`, `site.yaml`,
  `backend.yaml`, `github-oidc.yaml`) — one command per stack, outputs wired
  into the next
- **Keyless deploys**: GitHub Actions assumes a scoped role through OIDC
  (no AWS access keys anywhere); the workflow publishes the site, invalidates
  CloudFront and rolls out the API host over SSM
- **Landing page stays public** while the catalogue and the runner require a
  signed-in player — found by actually signing out live and following the
  redirect, not by reading the code
- **Versioned asset URLs** (`script.js?v=<deploy sha>`): assets are cached for a
  week, so a CloudFront invalidation alone still leaves returning browsers on
  the previous script. HTML (one-minute cache) points at the new version —
  found by watching a stale `script.js` run in the browser after a deploy

### ✅ Completed (Phase 5 — observability)

- **Structured request logs**: nginx emits JSON access logs (`status`,
  `uri`, `request_time`, `upstream_time`) — CloudWatch parses them without regex
  guesswork
- **CloudWatch agent on the host**: ships those logs plus container stdout to
  `/gamehub/prod/nginx-access` and `/gamehub/prod/app` (7-day retention set by
  the template), and host `mem`/`disk`/`swap` metrics into the `CWAgent`
  namespace — installed by user-data, no manual setup
- **Metrics derived from logs** (`AWS::Logs::MetricFilter`): request count,
  5xx count, and API latency as a *numeric* extraction (`$.request_time`) for
  p50/p99 — nginx already knew the numbers, so the app is not instrumented with
  an extra library to repeat them
- **External availability check**: EventBridge runs a small Lambda every 5
  minutes against the public CloudFront URL and `/api/health`; its log line
  becomes the `SyntheticSuccess` metric — a synthetic check without the
  CloudWatch Synthetics price tag
- **Eight alarms** into one SNS topic: synthetic availability (`TreatMissingData:
  breaching` — silence is a failure), 5xx count, API p99 latency, instance
  status, CPU, CPU credits, memory and disk. Host-metric alarms treat missing
  data as `notBreaching`, because a stopped agent is not an outage
- **One dashboard** (`gamehub-prod`): availability, requests vs errors, latency
  percentiles, host pressure, and two live log tables (recent 5xx, backend tail)
- **SLOs with error budgets** ([`docs/slo.md`](docs/slo.md)): 99.5 % availability
  and p99 ≤ 1.5 s over a rolling 30 days, with the measurement method for each —
  and an explicit list of what is **not** claimed, because a single-AZ t3.micro
  cannot honestly promise it
- **Runbook** ([`docs/runbook.md`](docs/runbook.md)): one section per alarm with
  the exact SSM/Logs-Insights commands to confirm the cause, plus the
  revert-to-roll-back path
- **Verified live, not assumed**: the agent's metric dimensions were read back
  from `list-metrics` and then written into the template — an alarm with the
  wrong dimension set sits in `INSUFFICIENT_DATA` forever

### 🚧 Planned

- **Phase 6 — local Kubernetes (kind) + Argo CD GitOps**
- **Phase 7 — security & GDPR hardening** (data deletion flow, SBOM)
- **Phase 8 — /learn documentation site, PDF export, load-test report**

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

**Important:** The browser accesses the frontend through port `8080`. The Nginx container communicates with the backend using Docker networking, and the backend port is **not published to the host** — the database runs as a local MySQL container (managed by hand, not by IaC — see the note in the Database section).

### Live deployment (Phase 4)

```text
                        Browser
                           |
                           | HTTPS            Cognito user pool
                           v                  (sign-up / sign-in)
                   CloudFront  <---------------------------+
                     |      |                              |
        default behavior|     \__ /api/* (caching disabled)  |
                        v                    |              |
                  S3 bucket                  v              |
          (private, OAC, static UI)     EC2 t2.micro :8080  |
                                             |              |
                                    SG: CloudFront prefix   |
                                    list only, no SSH; SSM  |
                                             v              |
                                 nginx → Express → MySQL    |
                                 (same compose stack)       |
                                             |              |
                                             +--- JWKS -----+
```

The browser signs in against Cognito, receives an **ID token**, and sends it as
`Authorization: Bearer <token>` on every API call. The backend verifies the
token's RS256 signature against the pool's public JWKS — the frontend guard is
UX, the API is the security boundary.


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
| Amazon Cognito | Player sign-up / sign-in, issues the ID token the API verifies |
| Amazon S3 + CloudFront | Static site hosting (private bucket, OAC) and global edge delivery |
| Amazon EC2 | Hosts the compose stack (nginx + API + MySQL) |
| AWS CloudFormation | All infrastructure as code (`infra/*.yaml`) |
| AWS Systems Manager | Keyless administration and deploys run over SSM, without SSH |
| GitHub Actions OIDC | Keyless deploys: short-lived AWS credentials, no stored secrets |

---

## 📁 Project Structure

```text
GameHub/
├── frontend/
│   ├── index.html          ← landing page (hero, tournaments, leaderboard)
│   ├── games.html          ← catalogue (rendered from the API)
│   ├── play.html           ← game runner host (READY → PLAYING → GAME OVER)
│   ├── signin.html         ← Cognito sign-in
│   ├── signup.html         ← Cognito sign-up + email confirmation step
│   ├── script.js           ← homepage + catalogue logic
│   ├── play.js             ← runner: ENGINE_MAP, HUD, high scores
│   ├── engines.js          ← 6 dependency-free canvas game engines
│   ├── auth.js             ← Cognito REST client, session, page guard
│   ├── config.js           ← runtime config (local dev: auth off)
│   ├── bg.js               ← animated arcade background
│   ├── style.css
│   ├── fonts/              ← self-hosted game fonts (OFL)
│   ├── nginx.conf
│   └── test/               ← engine, mapping contract and auth tests
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── .env.example        ← copy to .env only for non-Docker runs
│   ├── db.js               ← connection pool
│   ├── auth.js             ← Cognito JWKS verification (no SDK)
│   ├── app.js              ← Express app (exported for tests)
│   ├── server.js           ← HTTP entrypoint
│   ├── test/               ← unit, integration and auth suites
│   ├── package.json
│   └── package-lock.json
├── db/
│   └── init.sql            ← schema + seed (runs on first boot)
├── infra/
│   ├── cognito.yaml        ← user pool + app client
│   ├── site.yaml           ← S3 + CloudFront (+ /api/* origin)
│   ├── backend.yaml        ← EC2 host, security group, IAM, elastic IP
│   ├── observability.yaml  ← log groups, metric filters, canary, alarms
│   └── github-oidc.yaml    ← OIDC provider + scoped deploy role
├── scripts/
│   ├── smoke.sh            ← end-to-end checks
│   ├── build-frontend.sh   ← builds the deployable static artifact
│   └── deploy-frontend.sh  ← S3 sync + CloudFront invalidation
├── .github/workflows/
│   ├── ci.yml              ← lint, tests, coverage, compose smoke, scans
│   └── deploy.yml          ← OIDC deploy (site + API host)
├── docs/                   ← learning notes, SLOs, runbook, ADRs
├── Dockerfile              ← frontend image (nginx)
├── docker-compose.yml      ← frontend + backend + db
├── Makefile                ← make bootstrap / up / smoke / test / db-reset
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
make test             # backend unit + integration tests (needs MySQL)
make test-frontend    # game-engine, mapping-contract and auth tests (Node only)
make down             # stop, keep database data
make db-reset         # wipe + re-seed the database
make clean            # full teardown incl. images and DB volume
make help             # list all targets
```

Prefer plain Compose? `docker-compose up -d --build` then `./scripts/smoke.sh` does the same.

---

## ☁️ Deploy to AWS

Everything is CloudFormation in [`infra/`](infra/) — five small stacks, each one
a single command. Stack outputs feed the next stack, so there is no spreadsheet
of ids to copy by hand.

```bash
export AWS_REGION=eu-central-1

# 1. Cognito user pool + app client
aws cloudformation deploy --region "$AWS_REGION" \
  --stack-name gamehub-cognito --template-file infra/cognito.yaml \
  --parameter-overrides Stage=prod

# 2. S3 + CloudFront (deployed first without an API origin)
aws cloudformation deploy --region "$AWS_REGION" \
  --stack-name gamehub-site --template-file infra/site.yaml \
  --parameter-overrides Stage=prod

# 3. EC2 host running the compose stack (needs the CloudFront domain)
aws cloudformation deploy --region "$AWS_REGION" \
  --stack-name gamehub-backend --template-file infra/backend.yaml \
  --parameter-overrides \
    Stage=prod \
    CognitoUserPoolId=<pool id> \
    CognitoClientId=<client id> \
    SiteOrigin=<https://cloudfront domain> \
    DbPassword=<16+ chars> RootDbPassword=<16+ chars>

# 4. Re-deploy the site stack with the API origin attached, then publish
aws cloudformation deploy --region "$AWS_REGION" \
  --stack-name gamehub-site --template-file infra/site.yaml \
  --parameter-overrides Stage=prod BackendOriginDomain=<ec2 public dns>

AWS_REGION=$AWS_REGION ./scripts/deploy-frontend.sh

# 5. Observability: log groups + retention, metrics from logs, the synthetic
#    check, eight alarms and the dashboard. AlarmEmail is optional — without it
#    the SNS topic is still created and can be subscribed later (see the
#    TopicArn output), it just has no subscriber yet.
aws cloudformation deploy --region "$AWS_REGION" \
  --stack-name gamehub-observability --template-file infra/observability.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    Stage=prod \
    InstanceId=<ec2 instance id> \
    SiteUrl=<https://cloudfront domain> \
    AlarmEmail=<you@example.com>
```

Deploy the observability stack **before** the host's CloudWatch agent writes its
first log line: the template owns the log groups so their retention is set, and
an agent-created group would make that resource fail with `AlreadyExists`.

For continuous deployment, deploy the fourth stack
(`infra/github-oidc.yaml`) once, then set these GitHub repository variables and
push to `main` — the [deploy workflow](.github/workflows/deploy.yml) does the
rest through OIDC, with no AWS keys stored anywhere:

`AWS_REGION`, `AWS_DEPLOY_ROLE_ARN`, `SITE_BUCKET`, `DISTRIBUTION_ID`,
`INSTANCE_ID`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`.

**Cost note (honest):** the site (S3 + CloudFront), Cognito and the four
CloudFormation stacks are inside the free tier at this traffic level. The EC2
instance is the only line item: this account is on a free plan, so AWS *rejects*
instance types that are not free-tier eligible (`t2.micro` failed with
"not eligible for Free Tier") — the stack therefore defaults to `t3.micro`.
On a non-free-tier account that is roughly $8/month. Tear everything down with
`aws cloudformation delete-stack` in reverse order.

---

## 🔌 Backend API

The following endpoints are implemented in the current application.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | **Liveness** — process is up (never touches the database) |
| GET | `/api/ready` | **Readiness** — database reachable, safe to route traffic (503 otherwise) |
| GET | `/api/games` | Retrieve games from the database |
| GET | `/api/games/:id` | Single game (powers the runner); 404 for unknown *and* non-numeric ids |
| GET | `/api/me` | Echoes the verified Cognito identity — proof the token was checked |

The API is reachable **only through the nginx proxy on `:8080`** — port `3000`
is deliberately not published to the host (use `docker-compose exec backend …`
if you need direct access from inside the network).

**Auth behaviour:** middleware on every `/api/*` route except the two probes. If
the Cognito pool is configured (that is: in the deployment), requests without a
valid ID token get `401 {"error":"Unauthorized"}`. If it is not configured (local
development), requests pass through and the backend logs `auth_disabled` at boot
— so the app is never broken, but the bypass is never silent either.

```bash
curl http://localhost:8080/api/health
curl http://localhost:8080/api/ready
curl http://localhost:8080/api/games
curl http://localhost:8080/api/games/4

# with the pool configured, protected routes need the ID token:
curl -H "Authorization: Bearer $ID_TOKEN" http://localhost:8080/api/me
```

Or run the full check suite: `make smoke`.

---

## 🗄️ Database

GameHub uses **MySQL 8.4 in a container**, seeded automatically from
[`db/init.sql`](db/init.sql) on the first start of an empty volume. This makes a
fresh clone reproducible with no cloud account and no secrets — and the deployed
stack runs the *same* container on the EC2 host, so there is exactly one
database setup to reason about. Moving to RDS (multi-AZ, automated backups,
managed patching) is a deliberate cost/ops trade-off left for a later phase
rather than a claim made here.

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

Live deployment hardening:

- **JWT verification instead of trust**: the API validates the Cognito ID token's
  RS256 signature against the pool's JWKS using `node:crypto` (no SDK), then
  checks `iss`, `aud`/`client_id`, `exp` and `token_use`. A forged, expired,
  wrong-pool or non-ID token is a `401`
- **Session expiry is enforced client- and server-side**: the guard treats an
  expired token as signed out, and the API would reject it anyway
- **No SSH on the EC2 host**: port 22 is not opened at all; the security group
  allows 8080 only from the AWS-managed CloudFront origin-facing prefix list,
  and administration happens through SSM Session Manager / Run Command
- **IMDSv2 required**, one-hop response limit, and an encrypted `gp3` root volume
- **No long-lived AWS credentials**: GitHub Actions assumes a role via OIDC that
  is scoped to this repository, this bucket, this distribution and this instance
- **Runtime secrets stay on the host**: the deployed stack's Cognito ids, CORS
  origin and database passwords are written into a root-only `.env` by the
  CloudFormation user data script — never in Git, never in an image, and the
  passwords are `NoEcho` parameters in the stack
- **CloudFront enforces HTTPS** for viewers, and the S3 bucket is private with a
  bucket policy that only permits that distribution (OAC)

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
- [x] All 12 catalogue entries open a real game. *(engines tested in CI + browser spot-checks)*
- [x] Game engines survive hundreds of frames and reach their terminal states. *(21 frontend tests)*
- [x] Every seeded game maps to an engine (no dead catalogue entries). *(mapping contract test)*
- [x] Cognito tokens are verified server-side; bad/expired/wrong-pool tokens get 401. *(12 auth tests)*
- [x] Sign-in gate stays open (with a loud boot warning) when no pool is configured. *(auth test)*
- [x] Live site deployed to S3 + CloudFront, API reachable through CloudFront `/api/*`. *(verified live)*
- [x] Deployment is keyless: GitHub Actions assumes a role via OIDC. *(deploy workflow)*
- [x] Structured JSON access logs reach CloudWatch Logs. *(verified with Logs Insights)*
- [x] Log-derived metrics produce data points. *(verified with `get-metric-statistics`)*
- [x] The synthetic check runs on schedule and its result is a metric, not just a log line. *(verified live)*
- [x] Every alarm has a real state and a notification target. *(verified with `describe-alarms`)*

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
- Automated testing (unit + integration) with coverage gates
- CI/CD pipelines (GitHub Actions): lint → test → build → security scan
- Dependency and image security scanning (Trivy, npm audit, gitleaks)
- GDPR-conscious frontend: self-hosted assets, zero third-party requests
- Canvas-based UI animation and game development (6 engines, game-loop design)
- Testing graphics code without a browser (stubbed canvas, frame-driven tests)
- Canvas-based UI animation with accessibility (reduced-motion) support
- Identity and access: Cognito user pools, ID tokens, JWKS-based JWT verification
- Keyless CI/CD: GitHub Actions OIDC federation and least-privilege deploy roles
- Infrastructure as code: five CloudFormation stacks with cross-stack outputs
- Static hosting and CDN design: private S3 + CloudFront OAC, cache-behaviour split
- Observability: structured JSON logs, log-derived metrics, metric math on a dashboard
- Synthetic (black-box) availability monitoring with alarm semantics that treat silence as failure
- Alert design: 8 actionable alarms, SNS notification path, `TreatMissingData` chosen per signal
- SLOs and error budgets written before the incident, with a per-alarm runbook
- Host hardening: SSM-only administration, IMDSv2, prefix-list-restricted ingress
- Git and GitHub workflows
- Application troubleshooting

---

## 🗺️ Roadmap

| Phase | Focus | Status |
|---|---|---|
| **0** | Reproducible local foundation (compose, seed, healthchecks, `make bootstrap`, smoke tests) | ✅ 2026-10-18 |
| **1** | Automated tests + GitHub Actions CI (lint, coverage gate, Trivy, gitleaks) | ✅ 2026-10-18 |
| **2** | Game-y UI: live animated background, self-hosted game fonts, arcade styling | ✅ 2026-10-18 |
| **3** | Real playable games — every catalogue entry opens a game | ✅ 2026-10-19 |
| **4** | Auth & live: Cognito (sign-in gate), S3 + CloudFront, EC2 backend, CloudFormation + OIDC CD | ✅ 2026-10-19 |
| **5** | Observability: structured logs, metrics from logs, synthetic check, 8 alarms, dashboard, SLOs, runbook | ✅ 2026-10-19 |
| **6** | Local Kubernetes (kind) + Argo CD GitOps | Planned |
| **7** | Security & GDPR hardening (deletion flow, SBOM) | Planned |
| **8** | /learn documentation site + PDF export + load-test report | Planned |

---

## 👨‍💻 Author

**Cijo Stany John**

GameHub is an evolving learning and portfolio project built to practise AWS cloud architecture, backend development, containerization, and DevOps deployment workflows.

---

*Built with curiosity, containers, and a passion for gaming.* 🎮
