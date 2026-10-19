# Service level objectives — GameHub

> These are the numbers the project holds itself to, how each one is measured,
> and what happens when one is missed. They are deliberately modest: this is a
> single t3.micro instance in one availability zone, and an SLO that claims
> more than the architecture can deliver is a lie in a markdown file.

## 1. Objectives

| # | Objective | Target (rolling 30 days) | Measured by | Alarm |
|---|---|---|---|---|
| SLO-1 | **Availability** — the public site answers `200` | ≥ 99.5 % | Synthetic check every 5 min from the Lambda canary (`SyntheticSuccess`) | `gamehub-prod-synthetic-check-failed` |
| SLO-2 | **API availability** — `/api/*` answers without a 5xx | ≥ 99.5 % | nginx access log → metric filter (`ServerErrors` vs `Requests`) | `gamehub-prod-http-5xx` |
| SLO-3 | **API latency** — p99 of `/api/*` request time | ≤ 1.5 s | nginx access log `request_time` → metric filter (`ApiRequestTimeSeconds`) | `gamehub-prod-api-latency-p99` |
| SLO-4 | **Host health** — instance status checks pass | no failing check for 2 min | EC2 `StatusCheckFailed` | `gamehub-prod-instance-status-check-failed` |
| SLO-5 | **Host capacity** — CPU, memory and disk stay off the ceiling | CPU < 85 % · memory < 90 % · disk < 85 % | EC2 metrics + CloudWatch agent (`CWAgent`) | `gamehub-prod-cpu-high`, `gamehub-prod-memory-high`, `gamehub-prod-disk-high`, `gamehub-prod-cpu-credit-balance-low` |

Two things are intentionally **not** SLOs:

- **Game frame rate** and client-side errors — browser-only metrics, not
  observable from the server, so claiming a number for them would be theatre.
- **Write durability of scores** — the MySQL volume lives on the instance's EBS
  root volume. A single-instance topology cannot honestly promise more than
  "the snapshot schedule in `infra/backend.yaml`".

## 2. Error budgets

| Objective | Budget per 30 days | What "burning" it means |
|---|---|---|
| SLO-1 / SLO-2 availability ≥ 99.5 % | 3 h 39 m of degraded service | One failed 5-minute synthetic check costs 0.03 % of the budget — 36 consecutive failures exhaust it |
| SLO-3 latency p99 ≤ 1.5 s | 3 h 39 m of p99 above target | The alarm needs 2 consecutive 5-minute windows, so a single slow render is not a page |

The budget is not a dashboard number to admire; it decides **priority**. While
the budget is intact, new features ship. Once an alarm page is unexplained, the
availability work comes first — which for this project means the next roadmap
item is postponed, not parallelised.

## 3. How the numbers are actually produced

```
browser ──▶ CloudFront ──▶ S3 (static site)
                     └───▶ EC2 nginx ──▶ Express /api/*
                              │
                              ├─ JSON access log  ──▶ CloudWatch Logs ──▶ metric filters
                              │            (status, request_time)          │
                              │                                    CloudWatch metrics
                              └─ CloudWatch agent ──▶ CWAgent            │
                                     (mem, disk, swap)                  ▼
EventBridge ──5 min──▶ Lambda ──▶ CloudWatch Logs ──▶ synthetic metrics ──▶ Alarms ──▶ SNS
```

- Availability and latency come from **measured traffic and a synthetic check**,
  never from the alarm configuration.
- `Requests` counts every log line, `ServerErrors` counts `status >= 500`; the
  error ratio is a CloudWatch **metric math** expression on the dashboard
  (`ServerErrors / Requests`), not a metric filter, so neither side can drift.
- Latency is the nginx `$request_time`, which includes the upstream Express
  call — the number a user actually feels, not just the time spent in Node.
- `TreatMissingData` is `breaching` only for the two availability alarms. For
  the synthetic check, silence means the checker itself died, which is a page.

## 4. When an objective is missed

1. The alarm fires to the `gamehub-prod-alarms` SNS topic (email subscription).
2. The on-call response is written down in [`runbook.md`](runbook.md) — one
   section per alarm, with the exact commands to look at, not advice to
   "investigate".
3. If the miss was caused by a deploy, the rollback is `git revert` on `main`,
   which re-triggers the pipeline and republishes the previous commit. The
   container images are pinned to commits, so the previous version is one
   revert away.
4. If the miss was not caused by a deploy, the fix is a code or infra change on
   a branch, reviewed and merged like any other change — no hand-editing in the
   AWS console.
