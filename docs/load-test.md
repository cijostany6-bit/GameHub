# Load test — what a single t3.micro actually does ✅ (2026-10-19)

> **Verified by:** two runs of [`scripts/load-test.js`](../scripts/load-test.js)
> against the live deployment on 2026-10-19 at 09:35–09:36 UTC (4,000 requests
> total), with the **origin-side** numbers read back from the app's own request
> log (`/gamehub/prod/app`) and nginx's access log (`/gamehub/prod/nginx-access`)
> in CloudWatch, and the instance's CPU, memory and all eight alarm states read
> back from CloudWatch for the same window.

## Why this exists, and what it is not

A load test is only useful if it is honest about what it measured. This one was
built to answer a narrow question — *does a two-vCPU burstable instance with a
containerised MySQL comfortably serve this application?* — and it deliberately
does **not** try to find the breaking point.

Three things make the result trustworthy rather than flattering:

1. **Three vantage points, not one.** The client measures end-to-end latency
   (which, from a home connection, is mostly *the network*). nginx's
   `request_time` measures what the origin spent. The backend logs its own
   `duration_ms` per request, which is the handler alone. Reporting only the
   first number would have said "180 ms per request" and meant almost nothing.
2. **The mix is weighted and declared.** 50 % static site (`/`, served by
   CloudFront), 30 % API list (`/api/games`, a database read), 20 % liveness
   (`/api/health`, no database). The weights are in the script.
3. **Each endpoint declares its expected status.** 401 from the gated catalogue
   route is the auth gate working, not an error — so the anonymous run scores
   401 as *expected*, and a 200 there would be the finding. Without that, the
   first run "failed" with a 70 % success rate while the system was perfect.

## The client's view

Run A is anonymous (the catalogue answers 401); Run B carries a real ID token,
so `/api/games` reaches MySQL. Both: 2,000 requests, concurrency 20,
keep-alive, one client.

### Run A — anonymous (the edge and the gate)

- **Target:** `https://d2qf9zxehny6bk.cloudfront.net` (the distribution's own
  name; the site's canonical name is `gamehub.worldofvpc.online`, and both are
  served — see ADR-018)
- **Duration:** 19.17 s · **Throughput:** 104.32 req/s
- **Responses as expected:** 100 % · **Unexpected:** 0 · **Connection errors:** 0

| Latency | ms |
|---|---|
| min | 161.19 |
| mean | 190.78 |
| p50 | 180.25 |
| p90 | 193.81 |
| p95 | 234.46 |
| p99 | 348.87 |
| max | 1103.22 |

| Endpoint | Requests | p50 (ms) | p95 (ms) | Expected | Unexpected |
|---|---|---|---|---|---|
| `/` | 1000 | 186.08 | 242.57 | 200 | 0 |
| `/api/games` | 600 | 174.52 | 193.52 | 401 | 0 |
| `/api/health` | 400 | 177.31 | 233.69 | 200 | 0 |

Status distribution: `{"200": 1400, "401": 600}`.

### Run B — authenticated (the database path is exercised)

- **Duration:** 19.19 s · **Throughput:** 104.23 req/s
- **Responses as expected:** 100 % · **Unexpected:** 0 · **Connection errors:** 0

| Latency | ms |
|---|---|
| min | 159.34 |
| mean | 190.73 |
| p50 | 181.47 |
| p90 | 195.34 |
| p95 | 234.48 |
| p99 | 265.04 |
| max | 932.88 |

| Endpoint | Requests | p50 (ms) | p95 (ms) | Expected | Unexpected |
|---|---|---|---|---|---|
| `/` | 1000 | 184.77 | 242.28 | 200 | 0 |
| `/api/games` | 600 | 178.04 | 230.18 | 200 | 0 |
| `/api/health` | 400 | 177.97 | 232.75 | 200 | 0 |

Status distribution: `{"200": 2000}`.

**Read these numbers carefully: they are dominated by one client's network.**
The distance from the test machine to the nearest CloudFront edge is ~175 ms, so
~180 ms of every request is travel time, not work. Comparing the two runs shows
this plainly: adding a **real database read** to 600 requests changed p50 by
1.2 ms and p95 not at all. The origin's own numbers below are the meaningful
ones.

## The origin's view

nginx logs `request_time` in **seconds** (the tables below are converted to
milliseconds), and the backend logs `duration_ms` per request.

### Run A — anonymous

| What | n | avg (ms) | p50 (ms) | p95 (ms) | p99 (ms) | max (ms) |
|---|---|---|---|---|---|---|
| nginx: `/api/games` → 401 | 599 | 1.00 | 1.00 | 2.00 | 7.00 | 14.00 |
| nginx: `/api/health` → 200 | 400 | 1.00 | 1.00 | 2.00 | 3.00 | 12.00 |
| backend: `/api/health` handler | 401 | 0.456 | 0.400 | 0.700 | 1.200 | 2.600 |
| nginx: `/` (static) | **0** | — | — | — | — | — |

### Run B — authenticated

| What | n | avg (ms) | p50 (ms) | p95 (ms) | p99 (ms) | max (ms) |
|---|---|---|---|---|---|---|
| nginx: `/api/games` (proxied, DB read) | 600 | 2.00 | 2.00 | 4.00 | 10.00 | 28.00 |
| nginx: `/api/health` | 400 | 1.00 | 1.00 | 2.00 | 6.00 | 13.00 |
| backend: `/api/games` handler (DB read) | 600 | 1.242 | 1.000 | 1.900 | 4.000 | 22.300 |
| backend: `/api/health` handler | 403 | 0.438 | 0.400 | 0.500 | 1.500 | 6.800 |
| nginx: `/` (static) | **0** | — | — | — | — | — |

Three things stand out:

- **The static half never touched the origin.** 2,000 of the 2,000 `/` requests
  across both runs were served from the CloudFront cache — no nginx entry exists
  for them. Half of the traffic mix cost the instance nothing.
- **A database read costs about a millisecond.** `SELECT id, name, category,
  description FROM games ORDER BY id` over 12 rows: p50 1.0 ms, p99 4.0 ms,
  max 22.3 ms across 600 requests. The proxy adds roughly another millisecond.
- **The client saw ~180 ms while the origin spent ~2 ms.** Roughly 99 % of the
  measured latency is the path between the test machine and the edge.

## The instance while it was being hit

| Metric | Baseline | During the runs |
|---|---|---|
| EC2 `CPUUtilization` (1-min max) | ~2.7 % | 4.55 %, peak **6.97 %** |
| `mem_used_percent` | ~41.6 % | 42.0 – 43.2 % |
| Instances with a state change | — | none |

CPU peaked at **7 %** while the origin absorbed ~52 requests per second
(1,000 origin-bound requests per run over 19 s) with DB-backed p95 at 2 ms.
The test does not find this instance's limit; it does not come close to it.

The write path was measured separately, during the Phase 7 verification, and is
the only place where the app talks to AWS:

| Request | n | avg (ms) | max (ms) | What dominates |
|---|---|---|---|---|
| `POST /api/scores` | 2 | 79.65 | 149.30 | MySQL upsert + round trip |
| `DELETE /api/me` | 1 | 239.30 | 239.30 | the SigV4 `AdminDeleteUser` call to Cognito |

That is the honest shape of the system: reads are ~1 ms, and anything that
crosses into a control-plane API costs hundreds of milliseconds.

## What the alarms did

**Nothing — and that is the correct result.** All eight alarms stayed `OK`, and
CloudWatch reports **no alarm state change in the 45 minutes around the runs**:

| Alarm | State during/after the runs |
|---|---|
| `gamehub-prod-synthetic-check-failed` | OK |
| `gamehub-prod-http-5xx` | OK |
| `gamehub-prod-api-latency-p99` | OK |
| `gamehub-prod-instance-status-check-failed` | OK |
| `gamehub-prod-cpu-high` | OK |
| `gamehub-prod-cpu-credit-balance-low` | OK |
| `gamehub-prod-memory-high` | OK |
| `gamehub-prod-disk-high` | OK |

Two successor questions follow from this, and both are answered elsewhere:
*would the alarms fire if the instance were actually struggling?* — the alarm
path was exercised and the thresholds verified separately in
[`docs/step-5-observability.md`](step-5-observability.md); and *is the latency
alarm measuring the right thing?* — it watches the origin's `request_time`
metric, not the client's end-to-end time, which is why a slow client link (this
test) does not page anyone.

## What this does NOT prove

- **One client, one location.** Concurrency 20 from a single machine is not
  distributed load; CDN edge performance for a user in another country is
  untested.
- **No saturation point.** Neither run pushed CPU past 7 %, so the numbers say
  "comfortable at this level", not "this is the ceiling".
- **A burstable instance is burstable.** The `t3.micro` earns CPU credits while
  idle and spends them under load. A 19-second burst is exactly what the family
  is designed for; a *sustained* load test is a different experiment, and the
  `gamehub-prod-cpu-credit-balance-low` alarm exists because of it.
- **A warm static cache.** The static half of the mix was a cache hit
  throughout. A cold-cache storm is a CloudFront capacity question, not an
  instance one, and is not covered here.
- **The write path is sampled, not load-tested.** Two `POST /api/scores` and one
  `DELETE /api/me` are enough to characterise one request, not to make a claim
  about write throughput.
- **No adversarial traffic.** No rate limiting, no abuse pattern, no large
  payloads — those belong to a security review, not a capacity one.

## Cost

4,000 requests from CloudFront plus ~2,000 origin-bound requests and a few
hundred kilobytes of transfer. CloudFront's free tier is 1 TB and 10 million
requests per month; the instance is billed whether it is busy or idle. The
marginal cost of this test was **effectively zero**, and nothing here approaches
a paid tier.

## Reproduce it

```bash
make load-test SITE_URL=https://gamehub.worldofvpc.online REQUESTS=2000 CONCURRENCY=20

# authenticated (the API then reaches MySQL); get an ID token first, e.g. with
# scripts/verify-gdpr.sh's sign-in steps, then:
node scripts/load-test.js --url "$SITE_URL" --requests 2000 --concurrency 20 --token "$ID_TOKEN"

# the origin's side of the same window:
aws logs filter-log-events --log-group-name /gamehub/prod/app \
  --filter-pattern '"duration_ms"' --start-time <epoch-ms> --end-time <epoch-ms>
aws logs filter-log-events --log-group-name /gamehub/prod/nginx-access \
  --start-time <epoch-ms> --end-time <epoch-ms>
```
