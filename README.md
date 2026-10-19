# 🎮 GameHub

> 🇬🇧 English version | 🇩🇪 [Deutsche Version](README.de.md)

### A Futuristic Gaming Platform Built with AWS & DevOps

[![CI](https://github.com/cijostany6-bit/GameHub/actions/workflows/ci.yml/badge.svg)](https://github.com/cijostany6-bit/GameHub/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Tests](https://img.shields.io/badge/tests-84%20passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-%E2%89%A580%25%20gated-blue)

GameHub is a portfolio project that combines a futuristic gaming interface with a containerized Node.js backend and a MySQL database — all runnable locally with one command. It demonstrates how frontend applications, backend APIs, container networking, reverse proxies, databases, tests and CI pipelines work together.

The project is being evolved into a production-style application: automated CI/CD, infrastructure as code on AWS, monitoring, and Kubernetes (local kind cluster + Argo CD).

> **Status — Phase 8 complete (2026-10-19):** tested, CI'd, game-y, playable and
> **live on AWS**, observable, runnable on Kubernetes, hardened — and documented.
> 84 automated tests, a Cognito sign-in gate with **working account deletion**
> (GDPR art. 17, in the app rather than in a policy document), a bilingual
> privacy notice, an SBOM + image scanning in CI, deploys that only run on a
> green CI for the exact commit, a measured `t3.micro` load test, and the whole
> write-up published at **`/learn/`** as a site and a PDF. All described as
> CloudFormation and deployed by keyless GitHub OIDC, on a custom domain with an
> ACM certificate.

**Live demo:** <https://gamehub.worldofvpc.online> — create an account
(email confirmation), sign in, and play. The landing page is public; the
catalogue and the games require a signed-in player.

**Documentation:** the step-by-step write-up, the ADRs and the runbook are
published as a small static site at
**<https://gamehub.worldofvpc.online/learn/>**, with the whole guide as a
printable PDF, and every claim in it traceable to a commit and a CI run.

---

## 📌 Project Status

**Current phase:** Phase 8 — /learn documentation site, PDF & load test ✅ (see
[`docs/step-8-learn-site.md`](docs/step-8-learn-site.md) and
[`docs/load-test.md`](docs/load-test.md))

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
- Dockerized frontend and backend on the **Alpine stable channel** (Dependabot-tracked, security-patched at build time), `npm ci` from lockfile, **0 npm vulnerabilities**, backend running as **non-root**
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

### ✅ Completed (Phase 6 — local Kubernetes + Argo CD GitOps)

- **Real cluster, no bill**: a single-node [kind](https://kind.sigs.k8s.io/)
  cluster (`k8s/kind-config.yaml`) with the same images the Compose stack builds,
  side-loaded into the node (`make kind-up`)
- **Deployments and a StatefulSet**: frontend and backend run 2 replicas each
  with `maxUnavailable: 0` rollouts; MySQL is a StatefulSet with a volume claim
  template — a Deployment would give the database a random name and two pods
  fighting over one data directory
- **Probes with consequences**: liveness on `/api/health` (no database), readiness
  on `/api/ready` (database) — a DB outage stops new traffic instead of
  restarting every pod
- **One source of truth for the seed**: `db/init.sql` is rendered into a
  ConfigMap by `scripts/build-k8s-dbinit.sh`, and CI fails if the copy drifts
  from the source
- **Least privilege, measured rather than assumed**: the backend runs as the
  unprivileged `node` user with `drop: ALL`; nginx keeps exactly the five
  capabilities its root master process needs — the first attempt at `drop: ALL`
  produced `CrashLoopBackOff` with `chown(...) failed (1: Operation not
  permitted)`, which is why the list is now written down with a reason
- **GitOps with Argo CD** (`k8s/argocd/application.yaml`): `automated` sync with
  `prune` and `selfHeal`, so the merge to `main` *is* the deploy and a manual
  `kubectl` edit is reverted by the controller
- **Verified like the rest of the project**: the same `scripts/smoke.sh` runs
  against the cluster's NodePort (8081, so Compose on 8080 keeps working) and
  passes — 12 games served from the StatefulSet through the nginx proxy
- **CI covers it**: a `manifests` job validates every manifest against the
  Kubernetes schema (kubeconform) and checks the generated ConfigMap for drift

### ✅ Completed (Phase 7 — security hardening & GDPR)

- **Erasure that is implemented, not promised**: `DELETE /api/me` deletes the
  player's rows **and** their Cognito identity in one action from the
  [account page](frontend/profile.html). A partial result is reported as a
  partial result (`502`), never as success
- **The account page is the GDPR surface**: it *is* the access/portability
  answer (identity + every stored row, copyable as JSON) and it carries the
  deletion control — one page, three of the four rights, no support email
- **A bilingual privacy notice** ([`frontend/privacy.html`](frontend/privacy.html)):
  a data inventory with purpose, legal basis and retention per item — including
  the 7-day access logs, which are personal data too
- **One AWS call, signed by hand**: account deletion needs
  `cognito-idp:AdminDeleteUser`, so the backend fetches IMDSv2 credentials and
  signs the request itself (SigV4, `node:crypto`) — no AWS SDK, no long-lived
  keys, and the signature is asserted field by field in the test suite
- **Least privilege on the identity**: the instance role's inline policy allows
  that *one* action on *one* user-pool ARN, not `CognitoPowerUser` on `*`
- **Data minimisation in the schema**: one `personal_bests` row per
  `(player, game)` with `GREATEST()` on conflict — the best score, no play
  history — keyed by the Cognito `sub`, so the database holds no email address
- **Migrations with a ledger** (`scripts/migrate.sh`, `db/migrations/`):
  `db/init.sql` only runs on an empty volume, so schema changes ship as
  checksummed, idempotent migrations; a rewritten migration is refused
- **Supply chain in CI**: SPDX SBOM (syft) kept as an artifact, Trivy against
  the **built image** as well as the filesystem, `npm audit`, gitleaks over the
  full history, and Dependabot for npm, Actions and base images
- **Deploys are CI-gated**: the deploy workflow runs on a *successful CI run for
  the exact commit* (never a later, untested tip of `main`) and finishes with a
  post-deploy smoke test against the public URL: the app shell, the documentation
  site and its PDF, a `401` from every protected route without a token, and —
  signing in as a dedicated smoke identity — the 12 catalogue entries, the game
  details, and an identified player from `/api/me`

### ✅ Completed (Phase 8 — /learn documentation site, PDF, load test)

- **A documentation site generated from the repository**:
  [`scripts/build-learn.js`](scripts/build-learn.js) (dependency-free, Node
  built-ins only) renders `README.md` and every `docs/*.md` into `learn/` — a
  landing page, one page per document, a print guide, and a hand-written Markdown
  renderer with GitHub-style table support
- **Published with the app**: `build-frontend.sh` copies `learn/` into the
  deployable artifact, so the *same* CloudFront distribution serves the guide at
  **`/learn/`** — no second bucket, no second CDN, and no chance of the docs
  being deleted by the root sync. `/learn/` and `/learn` are resolved by a
  twelve-line CloudFront Function rather than by a folder object in the bucket
  (ADR-017) — before it existed, `/learn/` answered 200 with the *game hub's*
  home page
- **A downloadable PDF**: `scripts/build-pdf.sh` prints the print-optimised
  `learn/guide.html` through the browser already on the machine (A4 `@page` CSS),
  producing `learn/gamehub-guide.pdf` for offline reading
- **A CI drift check**: the generated site is committed, so the `manifests` job
  regenerates it and fails on any diff, and asserts that every document has a
  page — a generated artifact that is never checked is an artifact that goes
  stale
- **A load test with a real report**: [`scripts/load-test.js`](scripts/load-test.js)
  (dependency-free, committed) drives a weighted mix of static, API and probe
  traffic; [`docs/load-test.md`](docs/load-test.md) records the measured numbers
  for a single `t3.micro` — including a deliberately pushed run, what the alarms
  did, and an explicit list of what the test does **not** prove
- **Erasure verified by a script, not by hand**: `scripts/verify-gdpr.sh` creates
  a real Cognito user, stores a score, deletes the account through the public
  API, and asserts that both the row and the identity are gone — cleaning up
  after itself even when it fails
- **Architecture decisions in one file**: [`docs/decisions.md`](docs/decisions.md)
  — 18 decisions in context / decision / consequences / rejected form, each one
  stating what it costs

### 🚧 Next (deliberately not started)

- A custom domain in front of CloudFront (certificate + DNS record; the
  distribution already exists)
- Moving the database to RDS (multi-AZ, automated backups, managed patching) —
  the cost/ops trade-off `docs/decisions.md` ADR-002 records

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
│   ├── profile.html        ← account page: stored data, JSON export, deletion
│   ├── privacy.html        ← bilingual (EN/DE) privacy notice
│   ├── script.js           ← homepage + catalogue logic
│   ├── play.js             ← runner: ENGINE_MAP, HUD, high scores
│   ├── engines.js          ← 6 dependency-free canvas game engines
│   ├── auth.js             ← Cognito REST client, session, page guard
│   ├── account.js          ← account page: fetch scores, export, delete
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
│   ├── cognito.js          ← IMDSv2 credentials + SigV4 AdminDeleteUser
│   ├── app.js              ← Express app (exported for tests)
│   ├── server.js           ← HTTP entrypoint
│   ├── test/               ← unit, integration, auth, GDPR and signer suites
│   ├── package.json
│   └── package-lock.json
├── db/
│   ├── init.sql            ← schema + seed (runs on first boot)
│   └── migrations/         ← checksummed migrations applied to live schemas
├── infra/
│   ├── cognito.yaml        ← user pool + app client
│   ├── site.yaml           ← S3 + CloudFront (+ /api/* origin)
│   ├── backend.yaml        ← EC2 host, security group, IAM, elastic IP
│   ├── observability.yaml  ← log groups, metric filters, canary, alarms
│   └── github-oidc.yaml    ← OIDC provider + scoped deploy role
├── k8s/
│   ├── kind-config.yaml     ← single-node kind cluster (node port → host 8081)
│   ├── namespace.yaml
│   ├── config.yaml          ← ConfigMap (app config) + local-only Secret
│   ├── db.yaml              ← MySQL StatefulSet + headless Service + PVC
│   ├── db-init-configmap.yaml ← GENERATED from db/init.sql (CI checks drift)
│   ├── backend.yaml         ← Express Deployment + `backend` Service
│   ├── frontend.yaml        ← nginx Deployment + NodePort Service
│   └── argocd/
│       └── application.yaml ← Argo CD Application (prune + selfHeal)
├── scripts/
│   ├── smoke.sh            ← end-to-end checks
│   ├── build-frontend.sh   ← builds the deployable static artifact
│   ├── deploy-frontend.sh  ← S3 sync + CloudFront invalidation
│   ├── kind-up.sh          ← cluster + images + manifests + smoke test
│   ├── argocd-up.sh        ← install Argo CD, sync the app, wait for Healthy
│   ├── build-k8s-dbinit.sh ← renders the DB seed ConfigMap (--check in CI)
│   ├── migrate.sh          ← applies db/migrations (ledger + checksums)
│   ├── build-learn.js      ← builds the /learn site from docs/
│   └── build-pdf.sh        ← renders the guide to PDF
├── learn/                  ← generated documentation site + PDF
├── .github/
│   ├── dependabot.yml      ← weekly npm / Actions / base-image updates
│   └── workflows/
│       ├── ci.yml          ← lint, tests, coverage, compose smoke, manifests, scans
│       └── deploy.yml      ← CI-gated OIDC deploy + post-deploy verification
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
make kind-up          # same app on a local Kubernetes cluster (kind) → :8081
make argocd-up        # install Argo CD and sync the manifests from Git
make k8s-dbinit       # re-render the Kubernetes DB seed ConfigMap
make learn            # rebuild the /learn docs site and the PDF
make migrate          # apply db/migrations to the running database
make load-test SITE_URL=https://…   # dependency-free load test (see docs/load-test.md)
make verify-gdpr      # verify account deletion end to end (needs a deployment)
make help             # list all targets
```

Prefer plain Compose? `docker-compose up -d --build` then `./scripts/smoke.sh` does the same.

### 3. Or run it on Kubernetes

```bash
make kind-up     # kind cluster + images + manifests + the same smoke test
make argocd-up   # Argo CD takes over from Git: Synced + Healthy
```

The cluster publishes the app on **http://localhost:8081** so it can run next to
the Compose stack on 8080. `make kind-down` deletes the cluster; the Docker
images stay. Everything about it — including what it does *not* promise — is in
[`docs/step-6-kubernetes-gitops.md`](docs/step-6-kubernetes-gitops.md).

---

## ☁️ Deploy to AWS

Everything is CloudFormation in [`infra/`](infra/) — six small stacks, each one
a single command. Stack outputs feed the next stack, so there is no spreadsheet
of ids to copy by hand.

```bash
export AWS_REGION=eu-central-1
export ZONE_ID=<your route 53 hosted zone id>   # aws route53 list-hosted-zones

# 1. Cognito user pool + app client
aws cloudformation deploy --region "$AWS_REGION" \
  --stack-name gamehub-cognito --template-file infra/cognito.yaml \
  --parameter-overrides Stage=prod

# 2. Certificate for the custom domain. CloudFront only accepts certificates
#    from us-east-1, hence the separate stack and the separate region. DNS
#    validation happens inside this stack — there is nothing to click.
aws cloudformation deploy --region us-east-1 \
  --stack-name gamehub-dns --template-file infra/dns.yaml \
  --parameter-overrides DomainName=gamehub.worldofvpc.online HostedZoneId="$ZONE_ID"

# 3. S3 + CloudFront (deployed first without an API origin)
aws cloudformation deploy --region "$AWS_REGION" \
  --stack-name gamehub-site --template-file infra/site.yaml \
  --parameter-overrides \
    Stage=prod \
    CustomDomain=gamehub.worldofvpc.online \
    CertificateArn=<gamehub-dns CertificateArn output> \
    HostedZoneId="$ZONE_ID"

# 4. EC2 host running the compose stack (needs the CloudFront domain)
aws cloudformation deploy --region "$AWS_REGION" \
  --stack-name gamehub-backend --template-file infra/backend.yaml \
  --parameter-overrides \
    Stage=prod \
    CognitoUserPoolId=<pool id> \
    CognitoClientId=<client id> \
    SiteOrigin=<https://cloudfront domain> \
    DbPassword=<16+ chars> RootDbPassword=<16+ chars>

# 5. Re-deploy the site stack with the API origin attached, then publish.
#    Repeat every parameter: CloudFormation silently uses the defaults for
#    anything you leave out, and the defaults here would strip the custom
#    domain back off.
aws cloudformation deploy --region "$AWS_REGION" \
  --stack-name gamehub-site --template-file infra/site.yaml \
  --parameter-overrides \
    Stage=prod \
    BackendOriginDomain=<ec2 public dns> \
    CustomDomain=gamehub.worldofvpc.online \
    CertificateArn=<gamehub-dns CertificateArn output> \
    HostedZoneId="$ZONE_ID"

AWS_REGION=$AWS_REGION ./scripts/deploy-frontend.sh

# 6. Observability: log groups + retention, metrics from logs, the synthetic
#    check, eight alarms and the dashboard. AlarmEmail is optional — without it
#    the SNS topic is still created and can be subscribed later (see the
#    AlarmTopicArn output), it just has no subscriber yet.
aws cloudformation deploy --region "$AWS_REGION" \
  --stack-name gamehub-observability --template-file infra/observability.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    Stage=prod \
    InstanceId=<ec2 instance id> \
    SiteUrl=https://gamehub.worldofvpc.online \
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

The workflow does not run on the push itself. It runs when [CI](.github/workflows/ci.yml)
**succeeds on `main`** (`workflow_run` + `conclusion == 'success'`) and checks out
the commit CI tested, so production never receives a commit that has not been
judged. The rollout then pulls the revision on the host, rebuilds the containers,
waits for MySQL and applies pending migrations (`./scripts/migrate.sh`) before a
final job smoke-tests the public CloudFront URL — homepage, all 12 catalogue
entries, game details and a `401` from an unauthenticated `/api/me`.

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
| POST | `/api/scores` | Stores the player's best score for a game (upsert, `GREATEST`) — `201` with the stored best |
| GET | `/api/scores/me` | Every stored row for the caller: the access/portability answer |
| DELETE | `/api/me` | **Erasure** — deletes the caller's scores *and* their Cognito identity; `204`, or `502` if only half of it worked |

The API is reachable **only through the nginx proxy on `:8080`** — port `3000`
is deliberately not published to the host (use `docker-compose exec backend …`
if you need direct access from inside the network).

**Auth behaviour:** middleware on every `/api/*` route except the two probes. If
the Cognito pool is configured (that is: in the deployment), requests without a
valid ID token get `401 {"error":"Unauthorized"}`. If it is not configured (local
development), the read-only routes keep working, the identity echo answers `401`,
and the signed-in features answer **`501`** rather than pretending — the backend
also logs `auth_disabled` at boot, so the bypass is never silent.

```bash
curl http://localhost:8080/api/health
curl http://localhost:8080/api/ready
curl http://localhost:8080/api/games
curl http://localhost:8080/api/games/4

# with the pool configured, protected routes need the ID token:
curl -H "Authorization: Bearer $ID_TOKEN" http://localhost:8080/api/me
curl -H "Authorization: Bearer $ID_TOKEN" http://localhost:8080/api/scores/me
curl -H "Authorization: Bearer $ID_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"game":"Cyber Strike","score":42}' \
     http://localhost:8080/api/scores

# erasure (irreversible — it deletes the Cognito user as well):
curl -X DELETE -H "Authorization: Bearer $ID_TOKEN" http://localhost:8080/api/me
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

The `games` table contains these fields:

| Column | Purpose |
|---|---|
| `id` | Game identifier |
| `name` | Game title |
| `category` | Category used by the frontend filters |
| `description` | Short game description |

Sample categories include Action, Racing, and Strategy.

### Player data (`personal_bests`)

| Column | Purpose |
|---|---|
| `user_sub` | The Cognito `sub` — **never** the email address |
| `game` | Game name (validated against `games.name`, so no free-text rows) |
| `score` | The best score only (`GREATEST()` on conflict) |
| `updated_at` | When that best was last improved |

The primary key is `(user_sub, game)`: one row per player per game, which is the
whole data-minimisation argument. Players are identified to the database by a
pseudonymous Cognito `sub`; no email, no name, no IP is stored next to a score.

### Migrations

`db/init.sql` runs **once**, on an empty data volume — which is correct for a
fresh clone and wrong for a live database. Schema changes therefore ship as
migrations:

```bash
./scripts/migrate.sh            # apply everything pending
./scripts/migrate.sh --status   # what is applied, what is pending
```

Each file in [`db/migrations/`](db/migrations/) is recorded in a
`schema_migrations` ledger with a **checksum**. A migration that was applied and
then edited is refused, because the database that ran it is no longer described
by the file. The runner reaches MySQL through `docker compose exec` on a host and
through the `mysql` client in CI (`MIGRATE_VIA`), so the same script runs in both
places. It is also part of the deploy: the rollout brings the schema up to date
after the containers start.

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
- **One AWS permission, one ARN**: the instance role's inline policy allows
  `cognito-idp:AdminDeleteUser` on the GameHub user pool and nothing else — no
  `CognitoPowerUser`, no `*` resource
- **No third-party requests from the browser**: fonts are self-hosted (OFL), so
  loading a page discloses no visitor IP to Google or to an analytics/CDN
  provider. This is a German data-protection requirement in practice, not a
  performance preference

### Data protection (GDPR)

- **Data minimisation by schema**: one `(user_sub, game)` row per player holding
  the best score — no play history, no email in the score table, no IP next to a
  score
- **Storage limitation**: access logs are retained for 7 days and then deleted
  automatically; the retention is set on the log groups in
  `infra/observability.yaml` and the reason is written down in the notice
- **Erasure (Art. 17)**: `DELETE /api/me` removes the database rows and the
  Cognito identity. The order matters — rows first — because if the identity were
  deleted first, a failure would leave data nobody (including the user) could
  ever delete. A Cognito failure returns `502` with a truthful message
- **Access & portability (Art. 15, 20)**: the account page lists the identity and
  every stored row, with a one-click JSON export
- **Transparency (Art. 13)**: [`frontend/privacy.html`](frontend/privacy.html)
  is a bilingual inventory — item, purpose, legal basis, retention, processors
  (AWS, `eu-central-1`) and rights
- **Not stored on purpose**: passwords (Cognito holds a salted hash we never
  see), advertising identifiers, behavioural profiles, third-party analytics

### Supply chain & pipeline

- **SBOM per build**: an SPDX JSON inventory (syft) is generated in CI and kept
  as a build artifact
- **Two vulnerability scans, two questions**: Trivy over the filesystem (source
  and dependencies) *and* over the **built image** (what the base image adds),
  plus `npm audit` — all failing the job on `CRITICAL`/`HIGH`
- **Secret scanning over history**, not just the diff: gitleaks runs against the
  full git history, because a secret that was committed and removed is still
  leaked
- **Dependabot** for npm, GitHub Actions and base images: updates arrive as
  reviewable pull requests that must pass the same CI, with no auto-merge
- **The deploy is gated on CI, not on the push**: `.github/workflows/deploy.yml`
  triggers on a *successful CI run* for a specific commit and checks out **that**
  commit, so a merge cannot reach production before the tests have judged it
- **Post-deploy verification against the public URL**: the pipeline finishes by
  checking the homepage, all 12 catalogue entries through the API, game details
  by id, and that an unauthenticated `/api/me` returns `401` — the edge, not just
  the host
- **Branch protection on `main`**: the four CI jobs are required status checks in
  strict mode, administrators are not exempt, force-pushes and branch deletion
  are disabled, and unresolved conversations block the merge. The gate is only a
  gate if the merge itself is gated

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
- [x] The app runs on Kubernetes from the same images. *(verified on kind; smoke test passed on :8081)*
- [x] Manifests are valid and the generated DB seed matches `db/init.sql`. *(kubeconform + drift check in CI)*
- [x] Argo CD reports the Application `Synced`/`Healthy` and reverts manual drift. *(verified on kind)*
- [x] Rolling updates never drop below the declared replica count. *(`maxUnavailable: 0`)*
- [x] A player's scores are stored server-side, one row per game, best only. *(gdpr test: upsert semantics)*
- [x] A player can retrieve every row stored about them. *(gdpr test: `/api/scores/me`)*
- [x] One player's query returns nobody else's rows. *(gdpr test: row isolation)*
- [x] Account deletion removes the DB rows **and** the Cognito identity. *(gdpr test: SigV4 `AdminDeleteUser` asserted)*
- [x] A Cognito failure still erases the data and reports a partial result (`502`). *(gdpr test)*
- [x] The identity cannot be deleted by a request that has no pool configured. *(open-mode test: `501`)*
- [x] Signatures are real: session tokens are signed, and a changed body changes the signature. *(10 signer tests)*
- [x] Migrations apply once, are idempotent, and are refused if rewritten. *(CI runs the runner twice)*
- [x] The built image is scanned, not just the source tree. *(Trivy image scan in CI)*
- [x] A dependency inventory (SBOM) is produced on every build. *(syft, SPDX JSON artifact)*
- [x] Production only receives a commit that CI passed, and the deploy is smoke-tested at the edge. *(deploy workflow `workflow_run` + `verify`)*

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
- Non-root container images with **no package manager in the runtime**, base images on the stable channel with build-time security patches, audited lockfiles
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
- Kubernetes: Deployments vs StatefulSets, named ports, probes, resource requests/limits
- Container security context: capability drop lists chosen from evidence, seccomp, non-root
- GitOps with Argo CD: automated sync, prune, selfHeal, drift as a bug to be reverted
- Local cluster engineering: kind, side-loaded images, NodePort mapping, PVC scope
- Host hardening: SSM-only administration, IMDSv2, prefix-list-restricted ingress
- Data protection as code: GDPR art. 15/17/20 implemented as endpoints, not policy text
- Erasure across two systems with a defined failure mode (partial deletion reported as partial)
- AWS request signing by hand (SigV4) and instance-metadata credentials (IMDSv2), no SDK
- IAM least privilege: one action, scoped to one resource ARN
- Data minimisation in schema design (one row per player per game, pseudonymous key)
- Database migrations with a checksum ledger; idempotency verified in CI
- Supply chain: SBOM generation, image-level vulnerability scanning, Dependabot, secret scanning over history
- CI-gated deployment: production receives only the commit CI passed, then a post-deploy smoke test at the edge
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
| **6** | Local Kubernetes (kind) + Argo CD GitOps | ✅ 2026-10-19 |
| **7** | Security & GDPR hardening: account deletion (art. 17) across DB + Cognito, SigV4 without an SDK, migrations with a checksum ledger, SBOM + image scanning, CI-gated deploys | ✅ 2026-10-19 |
| **8** | /learn documentation site + PDF export + load-test report | ✅ 2026-10-19 |

---

## 👨‍💻 Author

**Cijo Stany John**

GameHub is an evolving learning and portfolio project built to practise AWS cloud architecture, backend development, containerization, and DevOps deployment workflows.

---

*Built with curiosity, containers, and a passion for gaming.* 🎮
