# Step 6 — Local Kubernetes (kind) + Argo CD ✅ (2026-10-19)

> **Verified by:** a real single-node kind cluster (4 CPU / 6 GiB Colima VM) with
> the app running from the same images as the Compose stack — `scripts/smoke.sh`
> passing against the cluster's NodePort on `:8081` (12 games served from the
> StatefulSet through the nginx proxy, and the documentation landing page at
> `/learn/`, asserted by marker rather than by status) — and Argo CD reporting
> the `gamehub` Application as `Synced`/`Healthy` at the merged revision, with a
> manual `kubectl scale --replicas=1` reverted to the declared 2 replicas by
> `selfHeal` within one poll. Re-run in full after the dependency roll-up, which
> is how the stale-image trap in item 11 was found.

## What was built

The Compose stack answers "can you run this?"; this step answers "can you run it
on Kubernetes, and can a controller keep it that way?".

| Piece | Implementation | Why not the alternative |
|---|---|---|
| **Cluster** (`k8s/kind-config.yaml`) | kind, one node, node port 30080 published on host **8081** | *minikube* → a VM plus a driver argument on every laptop; *EKS* → real money and real waiting for a portfolio demo; *Docker Desktop's Kubernetes* → not available with Colima |
| **Workloads** (`k8s/*.yaml`) | `Deployment` for frontend (2 replicas) and backend (2 replicas, rolling update with `maxUnavailable: 0`), `StatefulSet` + PVC for MySQL | *A Deployment for MySQL* → two pods fighting over one data directory, and no stable identity for the client to resolve; *Helm* → a templating layer for three objects, and templating hides the fields this project exists to learn |
| **Images** | The **same** tags Compose builds (`gamehub-frontend:local`, `gamehub-backend:local`), side-loaded with `kind load docker-image`, referenced with `imagePullPolicy: Never` | *Pushing to ECR for a local cluster* → a registry round trip per change with nothing to show for it; *Building inside the cluster* → a Docker-in-Docker story nobody wants on a laptop |
| **Service names** | The backend Service is called `backend`, not `gamehub-backend` | The nginx config baked into the frontend image proxies to `http://backend:3000`. The image is identical in Compose and Kubernetes, so the Service name is part of the image's contract, not a naming preference |
| **Probes** | Liveness on `/api/health` (no DB), readiness on `/api/ready` (DB) | A liveness probe that checks the database turns a DB outage into a cluster-wide restart storm — the classic Kubernetes own-goal |
| **Seed data** | `db/init.sql` rendered into a ConfigMap by `scripts/build-k8s-dbinit.sh`, mounted at `/docker-entrypoint-initdb.d`, with a CI drift check | *Copying the SQL by hand* → two schemas that disagree the first time someone edits one; *an init Job* → more moving parts than the entrypoint contract MySQL already provides |
| **GitOps** (`k8s/argocd/application.yaml`) | Argo CD pulls `k8s/` from `main`, `automated` + `prune` + `selfHeal` | *`kubectl apply` in a pipeline* → the cluster state is whatever the last successful build left behind, with no answer to "what is deployed?" or "who edited this?" |
| **Verification** | The same `scripts/smoke.sh` as Compose, pointed at the NodePort | A separate "Kubernetes smoke test" → two definitions of working, which is how environments drift |

## Things that had to be got right

1. **`log_format` is an http-level directive.** The nginx config is a `server`
   block placed in `conf.d/`, so the structured log format had to move into its
   own file (`frontend/nginx-log-format.conf`, copied in as `00-log-format.conf`)
   or nginx exits with `"log_format" directive is not allowed here`. Found by the
   container restarting instead of serving — the failure was loud and immediate,
   which is the good kind.
2. **Ports belong to a machine, not to a plan.** kind's NodePort mapping wanted
   host 8080, which this Mac already uses (a Compose frontend *and* an unrelated
   SSH tunnel). The cluster now publishes on 8081, so Compose and Kubernetes can
   run at the same time — and the smoke test takes the URL as an argument.
3. **`prune` and `selfHeal` are the whole argument for GitOps.** Without them,
   Argo CD is an expensive `kubectl apply` that never re-reconciles. With them,
   scaling a Deployment by hand is a *bug that gets fixed within a minute* — which
   is exactly what the verification demonstrates.
4. **A PVC on kind is a PV on a container filesystem.** It works, it persists
   across pod restarts, and it dies with the cluster. That is the correct scope
   for a learning environment; the AWS stack keeps its data on an EBS-backed
   volume with a snapshot schedule, and the two are not the same promise.
5. **`imagePullPolicy: Never` is a deliberate local choice.** It fails fast and
   loudly if the image was not side-loaded, instead of silently pulling a stale
   `latest` from a public registry that has nothing to do with this project.
6. **The seed ConfigMap is generated, not hand-maintained.** `db/init.sql` stays
   the single source of truth, `scripts/build-k8s-dbinit.sh --check` runs in CI,
   and a change to the schema that skips the render fails the build.
7. **`readOnlyRootFilesystem` was left off on purpose.** The nginx image writes
   its PID file and cache at startup and Node may use `/tmp`. Turning it on needs
   emptyDir mounts and an unprivileged nginx image — a change worth making, but
   only alongside the evidence that it still serves, which is why the manifests
   say so in a comment rather than pretending.
8. **`drop: ALL` is the wrong answer for the stock nginx image.** The root master
   process legitimately needs `CHOWN`, `DAC_OVERRIDE`, `SETUID`, `SETGID` and
   `NET_BIND_SERVICE` before it hands off to the unprivileged worker. Dropping
   everything produced `CrashLoopBackOff` in both replicas and the error
   `chown("/var/cache/nginx/client_temp", 101) failed (1: Operation not
   permitted)` in the container log — the pod was hardened straight into a
   crash, which is exactly why the capability list is now written down with its
   justification.
9. **The Argo CD install needs `--server-side`.** `kubectl apply` of the release
   manifest failed with `The CustomResourceDefinition "applicationsets.argoproj.io"
   is invalid: metadata.annotations: Too long: may not be more than 262144
   bytes` — client-side apply stores the previous configuration in an
   annotation, and this CRD's own annotations blow past the limit. Server-side
   apply stores nothing in the object.
10. **`read` plus `set -e` is a trap in a wait loop.** `read -r a b < <(cmd)`
   returns non-zero when `cmd` produces no output, and under `set -eu` that ends
   the whole script — silently, on the first poll, while the Application has no
   status yet. The wait loop now collects the output first and parses it
   defensively, which is why the script prints its progress lines instead of
   exiting after "waiting for the first sync".
11. **A mutable image tag plus `imagePullPolicy: Never` means the cluster can
   serve yesterday's bytes.** Re-verifying this phase after the dependency
   upgrade exposed it: `kind load` had pushed the new image into the node, the
   image on disk plainly contained the documentation, and yet `/learn/` in the
   cluster answered with the SPA home page. Nothing had restarted the Pods — the
   tag (`:local`) had not changed, so `kubectl apply` saw no spec difference and
   did nothing. `scripts/kind-up.sh` now restarts the workloads after loading
   them, which is the step that actually swaps the code in. The lasting lesson is
   about the *check*, though: the old smoke test only looked at status codes, and
   nginx's `try_files … /index.html` fallback answers **200 with the wrong page**
   — the same failure mode as the CloudFront directory-URL bug (ADR-017), caught
   the same way the second time only because the assertion became a marker
   (`readme.html`) instead of a status. `scripts/smoke.sh` now asserts it, so
   both the Compose and the Kubernetes path would fail loudly on a stale image.
12. **The image carries the whole site, so local equals production.** The
   deployed artifact is `frontend/` plus `learn/` in one bucket; the frontend
   image now `COPY`s both, `.dockerignore` no longer excludes `learn/`, and the
   app's footer links to `/learn/`. nginx resolves a directory to `index.html` on
   its own, so the same URL works in Compose and in kind without the edge
   function that CloudFront needs — a difference worth knowing when a link works
   locally and 404s in production, or the reverse.

## Concepts to understand cold

- **Declarative reconciliation** — the desired state lives in Git, the
  controller compares it to the cluster and acts; nobody "deploys" anything
- **Probes and their consequences** — why liveness must not depend on a
  downstream service, and what `maxUnavailable: 0` buys during a rollout
- **Stateless vs stateful workloads** — which is why one of the three objects in
  this cluster is a StatefulSet and the other two are Deployments
- **Side-loading images** — how a node gets an image without a registry, and why
  a local cluster is the one place that is the right answer
- **Service DNS as an interface** — `backend:3000` as a contract an immutable
  image depends on
- **Drift** — what `selfHeal` actually detects and reverts, and what it cannot
  see (a changed ConfigMap value is drift; a changed image *inside* a tag is not)

## Interview questions this unlocks

1. *"How would you deploy this to Kubernetes, and what breaks first?"* (image
   availability — hence `imagePullPolicy: Never` and side-loading; then the DB
   identity; then the probe that would otherwise restart every pod during a DB
   incident)
2. *"What is the difference between a Deployment and a StatefulSet, and when did
   you actually need one?"* (stable identity + stable storage; the MySQL pod)
3. *"Your pipeline says the deploy succeeded but the cluster is wrong. Why?"*
   (because `kubectl apply` is a moment, not a state — Argo CD with `prune` and
   `selfHeal` is the answer, and it is observable)
4. *"How do you keep two environments' manifests from diverging?"* (one source
   of truth — the same image tags, the same ConfigMap source, and a CI check that
   fails when a generated file drifts)
5. *"What would you change for production?"* (an unprivileged nginx image with a
   read-only root filesystem, a real registry with digests instead of tags, a
   managed database, and resource limits sized from measurements rather than
   guesses)
