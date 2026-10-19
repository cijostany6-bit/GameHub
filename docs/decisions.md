# Architecture decisions (ADRs)

Every non-obvious choice in this project, in the same shape: **context**,
**decision**, **consequences** (including what it costs), **rejected
alternatives**. The step documents (`docs/step-*.md`) tell the story of each
phase; this file is the index of the decisions that story is made of.

| # | Decision | Status | Phase |
|---|---|---|---|
| [001](#adr-001) | One Compose file for local development and production | Accepted | 0 |
| [002](#adr-002) | MySQL in a container, not RDS | Accepted | 0 |
| [003](#adr-003) | CloudFormation, not Terraform | Accepted | 4 |
| [004](#adr-004) | Keyless deploys with GitHub OIDC | Accepted | 4 |
| [005](#adr-005) | Self-hosted fonts, zero third-party requests | Accepted | 2 |
| [006](#adr-006) | Metrics derived from structured nginx logs | Accepted | 5 |
| [007](#adr-007) | The synthetic check is a scheduled Lambda writing a log line | Accepted | 5 |
| [008](#adr-008) | kind with the Compose images side-loaded | Accepted | 6 |
| [009](#adr-009) | Argo CD with `automated` + `prune` + `selfHeal` | Accepted | 6 |
| [010](#adr-010) | JWT verification with `node:crypto` and the pool's JWKS | Accepted | 4 |
| [011](#adr-011) | One personal-best row per `(sub, game)`, not a score history | Accepted | 7 |
| [012](#adr-012) | SigV4 by hand over IMDSv2 credentials, no AWS SDK | Accepted | 7 |
| [013](#adr-013) | A checksummed migration runner, not only `init.sql` | Accepted | 7 |
| [014](#adr-014) | Deploy on a successful CI run, not on the push | Accepted | 7 |
| [015](#adr-015) | No package manager in the runtime image | Accepted | 7 |

---

## ADR-001

**One Compose file for local development and production**

**Context.** The project has to run on a laptop with one command and on an EC2
host. Two definitions of "the stack" drift.

**Decision.** `docker-compose.yml` is the only definition. The host clones the
repository and runs the same file, the same images and the same environment
variable names.

**Consequences.** A bug found locally is a bug in production, and the EC2 host
needs Git + Docker and nothing else. The host runs MySQL in a container, so the
database is stateful inside Docker — acceptable at this size, wrong at scale.

**Rejected.** A separate production compose file (two files to keep in sync);
ECS/Fargate (more moving parts than the app).

---

## ADR-002

**MySQL in a container, not RDS**

**Context.** A managed database with backups and patching is what a real service
would use; it is also the largest line item in a small AWS bill.

**Decision.** MySQL 8.4 in a container on the host, seeded from `db/init.sql` on
an empty volume.

**Consequences.** Zero cost, and the schema is reproducible from the repository.
No automated backups, no multi-AZ, no managed patching — and the project says so
rather than implying otherwise. The migration path to RDS is a phase of its own.

**Rejected.** RDS (cost, and it would have hidden the one-command local story);
SQLite (removes the realistic connection-pool and migration surface).

---

## ADR-003

**CloudFormation, not Terraform**

**Context.** Infrastructure as code for five stacks: Cognito, S3+CloudFront, the
EC2 host, observability and the OIDC provider.

**Decision.** Plain YAML CloudFormation templates in `infra/`, one per stack,
wired with outputs.

**Consequences.** No state file to store, lock or lose, and no third-party
provider to trust. The templates are verbose, cross-stack references are
awkward, and `!If`/`!Sub` are not a programming language.

**Rejected.** Terraform/OpenTofu (an extra state backend to run and secure for
five small stacks); CDK (a build step and a runtime for what is mostly
declarative configuration).

---

## ADR-004

**Keyless deploys with GitHub OIDC**

**Context.** CI has to reach S3, CloudFront, EC2 (via SSM) and ECR-less hosts.

**Decision.** A GitHub OIDC provider plus an IAM role restricted to this
repository, whose trust policy pins the repo and the deploy branch. Credentials
are short-lived tokens from `sts:AssumeRoleWithWebIdentity`.

**Consequences.** Nothing to rotate, nothing to leak, and the role is the audit
trail. The trust policy must be kept in step with repository renames — a rename
breaks deploys until the condition string is updated.

**Rejected.** Long-lived IAM user access keys in GitHub secrets (a rotation
problem and a leak risk); a self-hosted runner (cost, and a runner is not a
credential strategy).

---

## ADR-005

**Self-hosted fonts, zero third-party requests**

**Context.** The UI needs a game-style typeface. The obvious way is
`fonts.googleapis.com`.

**Decision.** The four OFL-licensed woff2 files are committed under
`frontend/fonts/` and served from the same origin; the /learn site does the same.

**Consequences.** No visitor IP is disclosed to a third party at page load, which
German courts have held needs consent, and no CDN dependency. The woff2 files
(~120 KB total) live in the repository, and each font's licence is committed next
to it.

**Rejected.** Google Fonts (a data-protection problem for a German audience); a
system-font stack (loses the arcade look the project is about).

---

## ADR-006

**Metrics derived from structured nginx logs**

**Context.** The SLOs need request rate, 5xx rate and latency percentiles. A
plaintext access log can only be grepped.

**Decision.** nginx writes JSON (`frontend/nginx-log-format.conf`), the logs go
to CloudWatch through the agent, and *metric filters* extract the numbers. The
`log_format` lives in its own file because it is an http-level directive and the
repository's nginx config is a `server` block.

**Consequences.** The metric definition is a CloudFormation pattern next to the
alarm that uses it, and the log line is the source of truth. Metric filters are
eventually consistent (~1 minute), a non-matching event still emits the filter's
default value (so `Sum` is safe and `Average` is diluted), and percentiles can
only be approximated from bucketed filters.

**Rejected.** An agent that parses logs into custom metrics (a second parser to
maintain); application-level metrics only (loses nginx's view of status codes
and timing).

---

## ADR-007

**The synthetic check is a scheduled Lambda writing a log line**

**Context.** Availability should be judged from outside, on a schedule, and it
should be visible on a dashboard.

**Decision.** EventBridge runs a small Lambda every 5 minutes; the Lambda
requests the real site, asserts the result, and writes **one** JSON log line. A
metric filter turns pass/fail into a metric, and the alarm is `Sum < 1` with
`TreatMissingData: breaching` — silence is a failure, not an unknown.

**Consequences.** No per-check charge and a single code path from the check to
the alarm. The threshold semantics are unusual and are written down
(`docs/step-5-observability.md`) precisely because `Sum < 1` looks wrong at a
glance.

**Rejected.** CloudWatch Synthetics canaries (a per-run cost and a second
deployment model); external uptime services (a third party, and no path into the
dashboard).

---

## ADR-008

**kind with the Compose images side-loaded**

**Context.** Kubernetes manifests need to be exercised somewhere real.

**Decision.** A single-node kind cluster (`k8s/kind-config.yaml`), loaded with
the **same** images the Compose stack builds (`imagePullPolicy: Never`), with the
NodePort published on host 8081 so Compose keeps 8080.

**Consequences.** One image, two orchestrators — a manifest change is tested
against the artifact that also runs locally. kind needs a capable container VM
(4 CPU / 6 GiB Colima here), and a `Never` pull policy fails fast when the image
was not side-loaded.

**Rejected.** minikube (a VM plus a driver argument per laptop); EKS (real money
for a demo); a separate Kubernetes image build (two artifacts that can drift).

---

## ADR-009

**Argo CD with `automated` + `prune` + `selfHeal`**

**Context.** "GitOps" is a claim about who owns cluster state.

**Decision.** An Argo CD `Application` points at `k8s/` on `main` with `syncPolicy.automated { prune: true, selfHeal: true }`.

**Consequences.** The merge is the deploy, and a manual `kubectl` change is
reverted by the controller — verified by scaling a Deployment by hand and
watching it return to the declared replica count within 90 seconds. A mistake in
`k8s/` is now a cluster-wide change on merge, which is exactly why CI validates
the manifests (kubeconform) and the generated seed ConfigMap before the merge
happens.

**Rejected.** `kubectl apply` from a pipeline (state is whatever the last
successful run left behind); Flux (equivalent here, and Argo CD's UI makes the
demo legible).

---

## ADR-010

**JWT verification with `node:crypto` and the pool's JWKS**

**Context.** The API must verify Cognito ID tokens: RS256 signature, `iss`,
`aud`, `exp`, `token_use`, and a key id that rotates.

**Decision.** Fetch the JWKS, cache it, and verify the RS256 signature with
`node:crypto`'s `createPublicKey`/`verify` — no `jsonwebtoken`, no AWS SDK.

**Consequences.** The backend has no authentication dependency to audit, and the
verification rules are visible in one file. The JWKS cache, key rotation and the
`kid`-miss refetch path are code this project owns and tests (a forged token, an
expired token, a wrong-pool token and a non-ID token each get a `401`).

**Rejected.** `jsonwebtoken` (fine, but it hides the checks that are worth
demonstrating); API Gateway's Cognito authorizer (removes the app's own
authorization surface entirely).

---

## ADR-011

**One personal-best row per `(sub, game)`, not a score history**

**Context.** "Remember my high score" could be a row per play.

**Decision.** `personal_bests` has the primary key `(user_sub, game)` and updates
with `GREATEST(score, VALUES(score))`. The player is referenced by the Cognito
`sub`; the table holds no email address.

**Consequences.** The feature works with one row per player per game, so the data
a breach would expose is smaller than it needed to be, and deletion (`DELETE
/api/me`) is a single indexed delete. The cost is real: there is no history, so
no leaderboard-over-time, no graphs, no "your last 10 games" — features that
would require collecting personal data the app currently has no reason to hold.

**Rejected.** An append-only `scores` table (a behavioural record collected for
a feature that does not exist); keying on email (copying an identifier into a
second system for no benefit).

---

## ADR-012

**SigV4 by hand over IMDSv2 credentials, no AWS SDK**

**Context.** Account deletion needs `cognito-idp:AdminDeleteUser`, which is an
admin API: the player's JWT cannot authorize it, so the backend must sign its own
AWS request.

**Decision.** `backend/cognito.js` fetches temporary credentials from the
instance metadata service with IMDSv2 (a `PUT` for a token, the token on every
`GET`) and signs the request with a hand-rolled SigV4 implementation.

**Consequences.** No SDK in the image, no long-lived keys on the host, and the
signing algorithm is asserted in tests (canonical request, signed-header list,
payload binding, session token included in the signature). The maintenance cost
is real: the code is this project's to keep correct, and the tests are the reason
that is acceptable.

**Rejected.** `@aws-sdk/client-cognito-identity-provider` (tens of megabytes and
a credential-provider chain for one call); IMDSv1 (any SSRF becomes role theft);
a long-lived IAM user key (a secret on disk to rotate and leak).

---

## ADR-013

**A checksummed migration runner, not only `init.sql`**

**Context.** `db/init.sql` runs once, on an empty data volume. A live database
that already has data can never be changed by editing it.

**Decision.** `scripts/migrate.sh` applies files from `db/migrations/` in order,
recording each in a `schema_migrations` ledger **with a checksum**, and refuses a
migration whose file changed after it was applied. It reaches MySQL through
`docker compose exec` on a host and the `mysql` client in CI.

**Consequences.** The same script is used by the deploy, by CI, and by a
developer, and the ledger answers "what has been applied here?". The rule that a
migration is immutable once applied is a discipline the tool only enforces for
files it has seen before.

**Rejected.** Relying on `init.sql` plus manual `ALTER` statements on the host
(undocumented, unrepeatable); a framework (a dependency for ~100 lines, and the
runner is a teaching artifact here).

---

## ADR-014

**Deploy on a successful CI run, not on the push**

**Context.** A push to `main` should reach production, but only after the tests
have judged it — and, with concurrent merges, not a later commit than the one
tested.

**Decision.** `.github/workflows/deploy.yml` triggers on `workflow_run` for the
CI workflow completing on `main` with `conclusion == 'success'`, and checks out
`github.event.workflow_run.head_sha`.

**Consequences.** Production receives exactly the commit CI passed. Path filters
are gone, so a documentation-only merge re-deploys identical content (idempotent,
and worth the safety). The pipeline ends with a smoke test against the public
CloudFront URL.

**Rejected.** Deploying on `push` (a race against CI); a single workflow with
jobs depending on each other (couples a 20-minute test run to a deploy trigger).

---

## ADR-015

**No package manager in the runtime image**

**Context.** A Trivy scan of the backend image reported 10 HIGH findings, all
inside `/usr/local/lib/node_modules/npm` — the package manager's own bundled
dependency tree, in an image whose entrypoint is `node server.js`.

**Decision.** Remove npm, npx and corepack from the runtime layer after `npm ci`
has installed the production dependencies.

**Consequences.** A smaller image, fewer findings, and no package manager for an
attacker to use if the process is ever compromised. The image can no longer be
used for interactive dependency debugging (`docker run … npm …` needs a build
stage or a different image), which is the intended trade.

**Rejected.** Accepting the findings with a `.trivyignore` (the vulnerable code
is not needed at runtime, so removing it beats excusing it); moving to a
distroless base (attractive, but it removes the shell this project uses for
`HEALTHCHECK` and for diagnosing the container).

---

## ADR-016

**A post-deploy check must assert what production actually does**

**Context.** The first version of the deploy's `verify` job fetched `/api/games`
without a token and asserted 200 with 12 games. Against production it got 401 —
the auth gate doing exactly its job — and failed the deploy. Nothing was wrong
with the deployment: the check encoded an assumption that stopped being true
when the catalogue moved behind the sign-in gate, and nothing re-examined the
check when that happened. The identical wrong assumption appeared a second time,
independently, in the load tool's success metric.

**Decision.** Anonymous requests are asserted to be *refused* (401 on every
protected route), and anything needing real data signs in as a dedicated smoke
identity — `smoke-test@gamehub.example`, credentials in the repository secrets
`SMOKE_USER_EMAIL` / `SMOKE_USER_PASSWORD` — and then uses that token exactly as
a browser would. The check also covers `/learn/` and the PDF.

**Consequences.** The green tick means "a player can do what a player does":
edge, JWKS verification, database and docs, not merely "something answered". It
depends on one Cognito identity and two repository secrets; if they are missing
the job fails loudly, which is the right failure mode for a gate. A test that
cannot fail for the right reason is not a test.

**Rejected.** Making `/api/games` public again so the old assertion would pass
(letting the check reshape the product); asserting only that the routes answer
(a 401 and a 200 are both "answering" — the cheapest way to have a green check
that proves nothing).

---

## ADR-017

**Directory URLs are rewritten at the edge, not stored as folder objects**

**Context.** `/learn/` answered **200 with the game hub's landing page**. An S3
origin behind an Origin Access Control is a REST origin and has no index
document: a request for the `learn/` key is a 403, and the distribution's custom
error responses turn a 403 into `/index.html` with a 200. The deploy's smoke
test passed on that wrong page, because its only assertion (`GameHub`) is true
of both pages.

Something has to resolve `/learn/`. Three candidates: write `/learn/index.html`
in every link, store a real object under the key `learn/`, or rewrite the URI at
the edge.

**Decision.** A CloudFront Function on the viewer request of the static cache
behaviour appends `index.html` to a URI that ends in `/`, and treats an
extensionless final segment as a directory so `/learn` works too. It returns
`/api/*` unchanged, so the function is correct independently of which cache
behaviour it is attached to. Its ten-to-twelve URI cases are exercised locally
before it is published.

**Consequences.** `/learn/`, `/learn` and every deep link work; the bucket stays
dumb; the cost is nil at this size (the CloudFront Functions free tier is two
million requests a month against a few thousand here). The trade is one more
piece of logic between the user and the object, so it fails open — an unmatched
URI behaves exactly as it did before — and it is small enough to read in one
sitting.

**Rejected.** Uploading the landing page *also* as the key `learn/` (S3 permits
it, but `aws s3 sync --delete` does not know it is meant to exist, so it would be
deleted and restored on every deploy — a one-second outage per release in
exchange for saving twelve lines); linking to `/learn/index.html` everywhere
(works, and the docs' own links do use explicit `.html`, but `/learn/` is the
URL a person types or bookmarks, and a landing page that renders the wrong site
is a bug however it was linked).

---

## ADR-018

**The site answers on a custom domain — and the CloudFront name keeps working**

**Context.** The site was reachable only at `d2qf9zxehny6bk.cloudfront.net`. The
zone `worldofvpc.online` already existed with another project on the apex, so
`gamehub.worldofvpc.online` was the obvious subdomain. The expected cost was
breaking the CloudFront name: the distribution redirects HTTP to HTTPS, so if a
custom certificate replaced the default one, the old address would fail at the
TLS handshake and any link to it would simply break.

**Decision.** Serve `gamehub.worldofvpc.online`: an ACM certificate issued in
us-east-1 by a small dedicated stack (`infra/dns.yaml`) and validated over DNS,
an alias on the distribution, and IPv4/IPv6 alias records pointing at it. Prefer
the custom name wherever a URL is written down — README, docs, the load-test
commands and the deploy's smoke test — and treat the CloudFront name as an
implementation detail.

**Consequences.** The expectation was wrong in a pleasant way, and it was
measured rather than assumed: CloudFront chooses the certificate by SNI, so the
alias gets the certificate for `gamehub.worldofvpc.online` while the
distribution's own name keeps getting `*.cloudfront.net`. **Both names answer
200**, so no existing link breaks and the historical verification records stay
exactly as they were written. The real cost is a third stack (in us-east-1,
because CloudFront only accepts certificates from there), a hosted-zone id in
the site stack, and the standing obligation to rename *everywhere at once* — a
half-renamed project is worse than an unnamed one. Certificates are free; alias
records are not charged for.

**Rejected.** A second distribution for the custom name (a duplicate of the
whole configuration — cache behaviours, the directory-index function, the
origin access control — to avoid one alias); email-validated certificates (a
human has to click a link, and the failure mode is an expired certificate in
production); and rewriting the historical records that name the CloudFront
domain, which would have falsified evidence that was accurate when it was
captured.
