# Glossary — every abbreviation in GameHub

GameHub speaks the vocabulary of AWS, Kubernetes and web security, and it uses
that vocabulary in the repository rather than only in conversation. This page
exists so that no reader — and no interviewer — has to guess what `OAC`,
`IMDSv2` or `RS256` means *here*.

Each entry answers three questions: what the abbreviation stands for, where it
actually appears in this project, and what it is for. The "where" column is not
generic documentation: those are the files you can open.

> **Scope.** This is the vocabulary as used, not a general dictionary. Terms
> that a reader might expect but that the project does not use are listed at the
> end, with the reason.

---

## Cloud & AWS

| Abbreviation | Stands for | Where you meet it here | What it is for |
|---|---|---|---|
| **AWS** | Amazon Web Services | every `infra/*.yaml` template; the live deployment | the cloud provider the whole stack runs on |
| **IAM** | AWS Identity and Access Management | `infra/github-oidc.yaml` (deploy role + trust policy), the canary role in `infra/observability.yaml` | answers *who may call which AWS API*; here it is how GitHub deploys without a stored key |
| **OIDC** | OpenID Connect | `infra/github-oidc.yaml`, `docs/step-4-auth-and-live.md` | lets GitHub Actions prove which repository and branch it is, in exchange for short-lived AWS credentials |
| **STS** | AWS Security Token Service | `infra/github-oidc.yaml` — `sts:AssumeRoleWithWebIdentity` | the service that issues those temporary credentials |
| **IMDS** | Instance Metadata Service (v2) | `infra/backend.yaml` (`HttpTokens: required`, hop limit **2**), `docs/step-7-security-gdpr.md` | hands software on the instance its role credentials; v2 needs a session token, and the hop limit is the detail that broke Docker (`fetch failed` → `502` → `504`) |
| **EC2** | Elastic Compute Cloud | `infra/backend.yaml` | the virtual machine (`t3.micro`) that runs the Docker stack |
| **EIP** | Elastic IP | `infra/backend.yaml` | a fixed public IPv4 address that survives stop/start, so the origin never moves |
| **EBS** | Elastic Block Store | `docs/step-6-kubernetes-gitops.md`, `docs/slo.md` | the network disk behind the instance — and, on kind, the container filesystem standing in for a PersistentVolume |
| **VPC** | Virtual Private Cloud | `infra/backend.yaml` | the isolated network the instance lives in; this project uses the account's default VPC rather than a bespoke one |
| **SG** | Security Group | the architecture diagram in `README.md`, `infra/backend.yaml` | the stateful firewall on the instance: HTTPS from the CloudFront prefix list, nothing else, no SSH |
| **S3** | Simple Storage Service | `infra/site.yaml`, `infra/observability.yaml` | object storage: the private static site and the canary's code |
| **CDN** | Content Delivery Network | `infra/backend.yaml`, `frontend/privacy.html` | a geographically distributed cache in front of the origin; CloudFront is the one used here |
| **OAC** | Origin Access Control | `infra/site.yaml`, `docs/step-4-auth-and-live.md` | the CloudFront feature that lets *only* the distribution read the private bucket |
| **ACM** | AWS Certificate Manager | `infra/dns.yaml`, `infra/site.yaml` | issues and auto-renews the TLS certificate for the custom domain — in **us-east-1**, because CloudFront accepts certificates only from there |
| **DNS** | Domain Name System | `infra/dns.yaml`, `infra/site.yaml` | maps `gamehub.worldofvpc.online` onto the distribution (Route 53 alias records, IPv4 and IPv6) |
| **SNI** | Server Name Indication | `docs/decisions.md` (ADR-018) | how a server picks the right certificate when many names share an address — the reason the custom domain and the CloudFront name both still answer |
| **AZ** | Availability Zone | `docs/decisions.md`, `docs/slo.md` | an isolated datacentre inside a region; this deployment is single-AZ and says so |
| **ARN** | Amazon Resource Name | stack outputs, `docs/step-7-security-gdpr.md` | the unique name of every AWS resource, used to grant permissions as narrowly as possible |
| **SSM** | AWS Systems Manager | `infra/backend.yaml`, `infra/github-oidc.yaml` | administers the host with no SSH at all: Session Manager for a shell, Send-Command for deploys |
| **SNS** | Simple Notification Service | `infra/observability.yaml` | the pub/sub topic the eight alarms publish to |
| **RDS** | Relational Database Service | future work in `README.md` (and one stale line in `frontend/games.html`) | managed MySQL. **Not used**: the database is a container on the instance |
| **ECS / EKS / ECR** | Elastic Container Service / Elastic Kubernetes Service / Elastic Container Registry | `docs/decisions.md`, `docs/step-6-kubernetes-gitops.md` | the managed AWS options considered and rejected — cost, and they hide the layer this project is about |
| **EMF** | Embedded Metric Format | `docs/step-5-observability.md` | a way to emit CloudWatch metrics from log lines; considered, then rejected in favour of metric filters (less code in the request path) |

## The web & networking

| Abbreviation | Stands for | Where you meet it here | What it is for |
|---|---|---|---|
| **HTTP / HTTPS** | HyperText Transfer Protocol (Secure) | `infra/site.yaml` (`viewerProtocolPolicy`), every `fetch` in the frontend | the request protocol; HTTPS is HTTP inside TLS |
| **TLS** | Transport Layer Security | `infra/site.yaml` (minimum protocol `TLSv1.2_2021`) | encrypts traffic and authenticates the site; the certificate in `gamehub-dns` exists for this |
| **TTL** | Time To Live | `docs/step-7-security-gdpr.md` (the IMDSv2 token) | how long a credential or cached object stays valid before it must be renewed |
| **URL / URI** | Uniform Resource Locator / Identifier | `infra/site.yaml` (the directory-index CloudFront Function) | the address of a resource — and the thing the function rewrites so `/learn/` finds `index.html` |
| **API** | Application Programming Interface | `backend/`, `apiFetch` in the frontend | the JSON interface the UI calls; everything under `/api/*` except health endpoints requires a token |
| **REST** | Representational State Transfer | `infra/site.yaml`, `infra/cognito.yaml` | the API's style: HTTP verbs against URLs (`GET`, `POST`, `PUT`, `DELETE`) |
| **JSON** | JavaScript Object Notation | request/response bodies; the nginx log lines CloudWatch parses | the data format for the API, and for the structured logs the metric filters read |
| **YAML** | YAML Ain't Markup Language | `infra/*.yaml`, `k8s/*.yaml`, the workflows | the configuration language of CloudFormation, Kubernetes and CI |
| **HTML / CSS / JS** | HyperText Markup Language / Cascading Style Sheets / JavaScript | `frontend/` | the three languages the UI is written in — no framework, no build step |
| **DOM** | Document Object Model | `frontend/bg.js`, `frontend/test/` | the in-memory tree of the page that scripts read and modify |
| **SPA** | Single-Page Application | `infra/cognito.yaml` (public client), `infra/site.yaml` | an app rendered in the browser with no server-side session — the reason the Cognito client holds no secret |
| **CORS** | Cross-Origin Resource Sharing | `infra/site.yaml`, `infra/backend.yaml` | the browser rule deciding which origins may call the API; configured for the site's own origin |
| **TTY** | Teletype (a terminal) | `scripts/migrate.sh` (`exec -T`) | why the "no terminal" flag matters when the same command runs from CI or an SSM invocation |
| **IP / TCP** | Internet Protocol / Transmission Control Protocol | `infra/backend.yaml`, `k8s/kind-config.yaml` | addressing and transport; the security-group and NodePort rules are TCP |

## Security & identity

| Abbreviation | Stands for | Where you meet it here | What it is for |
|---|---|---|---|
| **JWT** | JSON Web Token | the frontend's `auth.js`, the backend's token verification | the signed token a player sends; the API verifies it on every protected route |
| **JWKS** | JSON Web Key Set | backend tests, the architecture diagram in `README.md` | the public keys used to verify token signatures without holding a secret |
| **RS256** | RSA Signature with SHA-256 | the tokens Cognito issues | the signing algorithm — asymmetric, so the API needs only public keys |
| **GDPR** | General Data Protection Regulation | `infra/backend.yaml`, `frontend/profile.html`, `docs/step-7-security-gdpr.md` | the EU law behind the working account deletion, data minimisation and the privacy notice |
| **DSGVO** | Datenschutz-Grundverordnung | `frontend/privacy.html`, `README.de.md` | the German name of the GDPR — the project and its docs are bilingual |
| **EU** | European Union | the privacy notice | the jurisdiction whose rules the design follows |
| **MFA** | Multi-Factor Authentication | `infra/cognito.yaml`, `docs/step-4-auth-and-live.md` | a second factor at sign-in that the user pool can require |
| **SSH** | Secure Shell | `infra/backend.yaml` | deliberately absent: no port 22, no key pair; administration is SSM only |
| **ID** | identifier | the `sub` claim stored on every score row | what rows are keyed by — the Cognito subject, never the email address |
| **UUID** | Universally Unique Identifier | scripts and infrastructure naming | a collision-free identifier for resources and test data |
| **SHA** | Secure Hash Algorithm | `.github/workflows/deploy.yml` | the commit fingerprint; the deploy pins itself to the exact SHA that CI tested |

## CI/CD & delivery

| Abbreviation | Stands for | Where you meet it here | What it is for |
|---|---|---|---|
| **CI** | Continuous Integration | `.github/workflows/ci.yml`, the README badge | every change runs 84 tests, a Compose smoke test, manifest checks and security scans |
| **CD** | Continuous Delivery / Deployment | `.github/workflows/deploy.yml` (triggered by a green CI run) | the delivery half: publish only what CI proved, then verify the public result |
| **IaC** | Infrastructure as Code | `infra/` (six stacks), `docs/step-5-observability.md` | the environment is versioned templates rather than console clicks — it can be rebuilt from the repository |
| **ADR** | Architecture Decision Record | `docs/decisions.md` (18 of them), referenced from template comments | the written record of *why*, including the options rejected |
| **PR** | Pull Request | the workflow in `docs/step-1-tests-and-ci.md` | the unit of change; merges need four green checks, and are never force-pushed |
| **SBOM** | Software Bill of Materials | `docs/step-7-security-gdpr.md`, CI artifacts | a complete inventory of what is inside the image, produced by syft |
| **SPDX** | Software Package Data Exchange | `docs/step-7-security-gdpr.md` | the standard file format that SBOM is written in |
| **CVE** | Common Vulnerabilities and Exposures | Trivy output in CI | the public identifiers for known vulnerabilities; the scan gates on HIGH/CRITICAL |
| **npm / npx** | Node Package Manager / npm execute | `backend/package.json`, `backend/Dockerfile` | how Node dependencies are installed and binaries run — and why both are *removed* from the runtime image (smaller attack surface) |
| **MIT** | MIT License | `LICENSE`, the README badge | the permissive licence this project is published under |
| **README** | "read me" | `README.md`, `README.de.md`, and `/learn/readme.html` | the front door of the repository — itself published as part of the docs site |

## Observability & operations

| Abbreviation | Stands for | Where you meet it here | What it is for |
|---|---|---|---|
| **SLO** | Service Level Objective | `docs/slo.md` (SLO-1 … SLO-4), `infra/observability.yaml` | the internal targets (availability, 5xx rate, p99 latency, host health) that the eight alarms are set against |
| **UTC** | Coordinated Universal Time | `docs/load-test.md` | the timezone measurements and timestamps are recorded in, so results stay comparable |

## Data & the application

| Abbreviation | Stands for | Where you meet it here | What it is for |
|---|---|---|---|
| **DB** | database | `Makefile`, `docker-compose.yml`, `k8s/backend.yaml` | shorthand for the MySQL 8.4 instance holding games and personal bests |
| **SQL** | Structured Query Language | `db/init.sql`, the backend tests | the language the schema, seed data and queries are written in |
| **HUD** | Heads-Up Display | `frontend/play.html`, `frontend/engines.js` | the score / lives / combo overlay drawn around a game canvas |

## Kubernetes & containers

| Abbreviation | Stands for | Where you meet it here | What it is for |
|---|---|---|---|
| **k8s** | Kubernetes ("k" + 8 letters + "s") | `k8s/*.yaml`, the `Makefile`, CI | the container orchestrator, and its standard abbreviation |
| **kind** | Kubernetes IN Docker | `scripts/kind-up.sh`, `Dockerfile` | a real Kubernetes control plane running inside Docker containers — the local cluster |
| **PVC / PV** | PersistentVolumeClaim / PersistentVolume | `k8s/db.yaml`, `docs/step-6-kubernetes-gitops.md` | the storage *request* and the storage itself that the MySQL StatefulSet keeps its data on (backed by the container filesystem on kind) |
| **CRD** | Custom Resource Definition | `docs/step-6-kubernetes-gitops.md`, `scripts/argocd-up.sh` | how Argo CD adds its own `Application` object to Kubernetes — and why the install needs `--server-side` |
| **PID** | Process Identifier | `k8s/frontend.yaml`, `docs/step-6-kubernetes-gitops.md` | used by probes and signals (nginx writes a PID file; PID 1 is the container's init process) |
| **VM** | Virtual Machine | `docs/step-6-kubernetes-gitops.md`, `docs/decisions.md` | the Colima VM that hosts Docker on macOS, and therefore kind |
| **OS** | Operating System | `docs/runbook.md` | the platform the runbook commands assume |
| **UI / UX** | User Interface / User Experience | `Dockerfile`, `frontend/*.js` | the visible layer, and the experience of using it |
| **OFL** | SIL Open Font License | `docs/step-7-security-gdpr.md`, `docs/step-2-gamey-ui.md` | the licence of the four self-hosted fonts, committed alongside their licence files |
| **CLI** | Command Line Interface | `scripts/`, the runbook | the terminal interface everything is operated through |
| **GitOps** | *(not an abbreviation — Git + Operations)* | `k8s/argocd/application.yaml` | the practice of Git as the single source of truth that a controller continuously reconciles |

## Units, formats & notation

| Abbreviation | Stands for | Where you meet it here | What it is for |
|---|---|---|---|
| **A4** | ISO 216 paper size | `docs/step-8-learn-site.md`, `README.md` | the page size the printable guide is rendered to |
| **UTF-8** | Unicode Transformation Format, 8-bit | `<meta charset="utf-8">` on every page | the text encoding, so German umlauts and the logo emoji render correctly |
| **GB / GiB** | gigabyte (decimal) / gibibyte (binary) | `infra/*.yaml` limits, `docs/step-6-kubernetes-gitops.md` | data sizes; the distinction matters when a provider's GB meets an operating system's GiB |
| **p95 / p99** | 95th / 99th percentile | `docs/load-test.md`, `docs/slo.md` (SLO-3) | the latency under which 95 % (or 99 %) of requests finished — a more honest figure than an average |
| **2xx / 4xx / 5xx** | HTTP status classes | the smoke tests, the runbook | `200` is fine, **`401` means the auth gate is working**, and `502`/`504` were the signature of the IMDS hop-limit bug |

---

## Deliberately not in this project

A glossary is also a promise about what is *not* claimed. These are absent on
purpose:

- **SLA** — no availability *promise* is made. There are internal SLOs and
  alarms; an SLA would be a contractual claim the architecture cannot support.
- **MTTR / MTBF** — there is no incident history yet, so any recovery-time
  average would be invented.
- **HPA / autoscaling** — the kind cluster runs fixed replicas and production is
  a single `t3.micro`; autoscaling would be vocabulary without a mechanism.
- **RBAC** — Kubernetes role-based access control is not configured; the local
  cluster is single-user.
- **TTFB / RPS** — the load test reports latency percentiles and request
  counts rather than throughput targets.
- **RDS** — planned and documented as future work (see the AWS table), not
  implemented. The database is a container.
