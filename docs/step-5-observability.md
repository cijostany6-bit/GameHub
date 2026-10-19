# Step 5 — Observability ✅ (2026-10-19)

> **Verified by:** the CloudWatch agent running on the live host, structured
> JSON nginx access logs arriving in `/gamehub/prod/nginx-access`, container
> stdout arriving in `/gamehub/prod/app`, `CWAgent` host metrics with the
> dimensions read back from `list-metrics`, all eight alarms reporting a real
> state (including the memory and disk alarms built from those dimensions), the
> synthetic canary invoked by hand and by schedule, and one dashboard
> (`gamehub-prod`) whose log widgets return rows.

## What was built

A deployment you cannot see is a deployment you cannot run. This step makes the
live system observable from the outside in and the inside out.

| Piece | Implementation | Why not the alternative |
|---|---|---|
| **Structured access logs** (`frontend/nginx.conf`) | `log_format … escape=json` with `status`, `uri`, `request_time`, `upstream_time` | *Parsing the default combined log with regexes in a metric filter* → every rule becomes a cubicle joke; JSON metric filters are a first-class CloudWatch feature |
| **Shipping logs + host metrics** (`infra/backend.yaml`) | CloudWatch agent installed by user-data, config file written inline, logs → CloudWatch Logs, `mem`/`disk`/`swap` → the `CWAgent` namespace | *Container Insights / an APM vendor* → an agent you must pay per host for, when four metrics and two log files answer every question this project has |
| **Retention** (`observability.yaml`) | Log groups created by template with 7-day retention | *Letting the agent create them* → groups that never expire and quietly bill forever is the classic first-week-of-AWS mistake |
| **Metrics from logs** (`AWS::Logs::MetricFilter`) | `Requests`, `ServerErrors`, `RequestTimeSeconds`, `ApiRequestTimeSeconds` derived from the JSON log lines | *Instrumenting the app with an EMF library* → more code in the request path for numbers nginx already knows |
| **External availability check** | EventBridge `rate(5 minutes)` → a 20-line Lambda that fetches `/` and `/api/health` and prints one JSON line per check; a metric filter turns that line into `SyntheticSuccess` | *CloudWatch Synthetics* → the managed canary costs about $10/month at a 5-minute interval, more than the whole project; printing a line and filtering it is free |
| **Alarms** (`observability.yaml`) | 8 alarms: availability (synthetic), 5xx count, API p99 latency, instance status, CPU, CPU credits, memory, disk — all publishing to one SNS topic | *A single "something is wrong" alarm* → an alert nobody can act on is an alert everybody mutes |
| **One dashboard** | Availability, requests vs errors, latency percentiles, host pressure, and two live log tables (recent 5xx, backend log tail) | *Per-service dashboards* → this service has one host; the dashboard fits on a screen |
| **Written response** (`docs/slo.md`, `docs/runbook.md`) | Objectives with error budgets, measurement, and one runbook section per alarm containing the exact commands | *"Investigate and fix"* → the runbook's value is that it was written before the incident, by someone who was not panicking |

## Things that had to be got right

1. **`TreatMissingData` is a decision, not a default.** For the host metrics,
   missing data is `notBreaching` — a stopped agent should not page anyone. For
   the synthetic check it is `breaching`: no data means the checker itself is
   broken, and an availability monitor that fails silently is worse than none.
2. **The agent must not create the log groups.** If the agent starts first, the
   groups exist without retention and CloudFormation's `AWS::Logs::LogGroup`
   fails with `AlreadyExists` on the next deploy. The template owns the groups;
   the agent only writes into them.
3. **A metric filter is not a log parser you can debug in place.** Pattern
   syntax errors produce an alarm that never fires — no warning, no log entry.
   The check that matters is a **manual canary invocation followed by
   `get-metric-statistics`**, proving a data point exists, not that the template
   was accepted.
4. **Metric *dimensions* must match exactly.** `CWAgent` attaches `InstanceId`,
   and the disk plugin adds `path`, `device` and `fstype` on top. An alarm whose
   dimension set is one key short sits in `INSUFFICIENT_DATA` forever. The
   dimensions in this stack were read back from `list-metrics` on the running
   host, then written into the template — verified, not guessed.
5. **The synthetic check measures the path a user takes.** It calls the
   CloudFront URL, not localhost — otherwise it proves the host is alive while
   the CDN is broken, which is exactly the failure it is meant to catch.
6. **Alarms without a subscriber are half a feature.** The topic is created and
   exported; subscribing is one `aws sns subscribe` because the account's own
   contact address cannot be read by an alarm template. Documented in
   `docs/runbook.md` §8 rather than pretended away.
7. **Latency is measured where the user waits.** `$request_time` includes the
   upstream Express call; `$upstream_time` alone would hide the time nginx
   spends. Having both on the log line is what lets the runbook split "slow
   app" from "slow edge" with one query.
8. **A metric filter publishes its default value for every event that does not
   match.** The canary alarm was built on `Average` of a metric emitted from a
   Lambda log group, and it sat in `ALARM` with an average of `0.4` while every
   check was passing: the group also contains `START`, `END` and `REPORT`
   lines, each of which contributed a zero. The fix is not a different
   threshold, it is a different *statistic* — one JSON line per run, summed, so
   the zeros add nothing. The same trap is why numeric-extraction filters
   (`$.request_time`) must only be pointed at log groups where every event
   matches; the nginx group qualifies because only `/api/*` traffic reaches the
   origin, and the S3-served page requests never enter it.
9. **The agent has to be root to read Docker's container logs.** `/var/lib/docker/containers/*/*-json.log` is `0640 root:root` inside a `0710` directory.
   Running the agent as its own `cwagent` user collected host metrics perfectly
   and shipped *nothing* from the containers — a silent half-failure, because
   the metrics half looked healthy. The log group stayed empty until
   `run_as_user` was set to `root`, with the reason written next to it.
10. **A policy that is only in the template does not exist on a running host.**
   The instance role gained `CloudWatchAgentServerPolicy` in the template, but
   the live host was created before that, so the agent started and was
   immediately refused with `AccessDeniedException: ... not authorized to
   perform: logs:PutLogEvents`. IaC is a description of the desired state; the
   running instance remains the old state until it is redeployed or the change
   is applied. (Attaching the policy by hand made reality match the template
   again — the template was already correct.)

## Concepts to understand cold

- **The four golden signals** — latency, traffic, errors, saturation — and why
  this dashboard is organised as exactly those four plus availability
- **Metric filters and JSON patterns** — how a log line becomes a time series,
  including extracting a *numeric value* from a field (`$.request_time`)
- **Extended statistics** — why the `p99` alarm exists next to the average, and
  why an average latency is the metric that hides the outage
- **Error budgets** — the shift from "uptime is good" to "the budget decides
  what we work on next", and what burning 3 h 39 m of a 30-day window means
- **Pull vs push monitoring** — why the synthetic check lives outside the
  system it watches, in a different service, in a different failure domain
- **Retention and cost of observability** — log ingestion is the subscription
  trap of cloud monitoring; retention is an architectural choice

## Interview questions this unlocks

1. *"How do you know your service is up right now?"* (external synthetic check
   on the public URL, every 5 minutes, with `TreatMissingData: breaching` — and
   what that costs, which is nothing)
2. *"Walk me through an incident: the p99 latency alarm fired. What do you do?"*
   (runbook §3: split `request_time` vs `upstream_time`, then CPU credits, then
   MySQL swap)
3. *"How do you get metrics out of a system you did not instrument?"* (structured
   JSON logs → metric filters, versus adding an SDK or an EMF library)
4. *"Your alarm fired at 03:00. Was it a false positive, and how would you
   know?"* (dimension sets, `TreatMissingData`, evaluation periods — and the
   manual canary invocation that proves the wiring)
5. *"What does your error budget buy you, and who decided the target?"*
   (99.5 % on a single-AZ t3.micro is the honest ceiling; the budget decides
   whether the next sprint is features or reliability)
