# Runbook — GameHub (prod)

> One section per alarm. Each one says what the alarm means, how to confirm the
> cause with a command, and what to do about it. Everything here is done over
> **SSM** — there is no SSH access to the host by design.

## 0. Ground rules

```bash
export AWS_REGION=eu-central-1
export INSTANCE_ID=$(aws ec2 describe-instances --region "$AWS_REGION" \
  --filters Name=tag:Name,Values=gamehub-prod* \
  --query "Reservations[].Instances[].InstanceId" --output text)
# The site's canonical name. The distribution's own domain name also still
# answers, with CloudFront's default certificate — see ADR-018.
export SITE_URL=https://gamehub.worldofvpc.online
```

Run a command on the host (no keys, no SSH — IAM decides who may do this):

```bash
aws ssm send-command --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["docker compose -f /opt/gamehub/docker-compose.yml ps"]' \
  --query Command.CommandId --output text
```

Check every alarm at once:

```bash
aws cloudwatch describe-alarms --region "$AWS_REGION" \
  --alarm-name-prefix gamehub-prod \
  --query "MetricAlarms[].[AlarmName,StateValue]" --output table
```

The general shape of the response is always the same:
**state → evidence → action**, and only ever through code, never the console.

## 1. `gamehub-prod-synthetic-check-failed`

**Means:** the external check could not get a `200` from the site or from
`/api/health` within 10 seconds. This is the closest thing to "users cannot use
the site".

**Confirm:**

```bash
curl -sS -o /dev/null -w '%{http_code} %{time_total}s\n' $SITE_URL/ 
curl -sS -o /dev/null -w '%{http_code} %{time_total}s\n' $SITE_URL/api/health
aws lambda invoke --region "$AWS_REGION" \
  --function-name gamehub-prod-canary --log-type Tail /dev/stdout | tail -5
```

**Act:**

| Evidence | Likely cause | Action |
|---|---|---|
| `/` fails, `/api/health` fine | CloudFront/S3 path | check the distribution status, then re-run the deploy workflow (`workflow_dispatch`) |
| both fail | the EC2 host is down | go to section 4 (instance status) |
| `/api/health` fails, `/` fine | the Express container is unhealthy | section 3, then `docker compose up -d` on the host |

## 2. `gamehub-prod-http-5xx`

**Means:** more than 5 responses with `status >= 500` in 5 minutes behind nginx.

**Confirm** — the log line is JSON, so this is a query rather than a grep:

```bash
# CloudWatch Logs Insights, /gamehub/prod/nginx-access
fields ts, uri, status, request_time, remote_addr
| filter status >= 500
| sort ts desc
| limit 20
```

Then, on the host:

```bash
docker compose -f /opt/gamehub/docker-compose.yml logs --tail=200 backend
```

**Act:** a 5xx caused by the last deploy → `git revert` on `main` and let the
pipeline republish. A 5xx from the database (`ER_...` in the log) → check
`docker compose ps db` and the MySQL healthcheck; the app returns 503, not a
crash, so the frontend stays up.

## 3. `gamehub-prod-api-latency-p99`

**Means:** p99 of `/api/*` above 1.5 s for 10 minutes.

**Confirm:**

```bash
# CloudWatch Logs Insights
fields ts, uri, request_time, upstream_time
| filter uri like /^\/api/
| stats pct(request_time, 99) as p99, avg(request_time) as avg, count(*) as n by uri
| sort p99 desc
```

The gap between `request_time` and `upstream_time` tells you who is slow:
nginx/TLS-side or Express.

**Act:**

| Cause | Action |
|---|---|
| One expensive endpoint | fix the query or add an index — the catalogue read and the scores read are the only DB paths |
| CPU saturation (see `cpu-high`) | the instance is the bottleneck: stop a concurrent `docker compose build` and confirm the credit balance is recovering |
| MySQL swapping | memory alarm follows; the host has 2 GB swap and 1 GB RAM, so a heavy query can push MySQL into swap |

## 4. `gamehub-prod-instance-status-check-failed`

**Means:** the hypervisor cannot reach the instance, or the OS is not
responding. Everything else is noise until this is clear.

**Confirm:**

```bash
aws ec2 describe-instance-status --region "$AWS_REGION" \
  --instance-ids "$INSTANCE_ID" --include-all-instances \
  --query "InstanceStatuses[].[InstanceStatus.Status,SystemStatus.Status]"
aws ec2 get-console-output --region "$AWS_REGION" \
  --instance-id "$INSTANCE_ID" --output text | tail -30
```

**Act:** a *system* status failure is AWS-side — stop and start the instance
(the elastic IP keeps the address stable) and let the user-data boot the stack
again. An *instance* status failure with an OOM message in the console output
means the stack ran out of memory: the container restart policies bring it back,
but the fix is a real one (see `cpu-credit-balance-low`).

## 5. `gamehub-prod-cpu-high` / `cpu-credit-balance-low`

**Means:** the burstable instance is out of headroom. `CPUUtilization` above
85 % for 15 minutes, or fewer than 20 CPU credits left.

**Confirm:**

```bash
aws cloudwatch get-metric-statistics --region "$AWS_REGION" \
  --namespace AWS/EC2 --metric-name CPUCreditBalance \
  --dimensions Name=InstanceId,Value="$INSTANCE_ID" \
  --start-time "$(date -u -v-1H +%FT%TZ)" --end-time "$(date -u +%FT%TZ)" \
  --period 300 --statistics Average

# who is eating the CPU
aws ssm send-command --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["docker stats --no-stream","uptime"]' \
  --query Command.CommandId --output text
```

**Act:** if a build is running, wait — a `docker compose build` on 2 vCPU is the
expected cause. If it is sustained traffic, that is the signal to move the
workload off the burstable class (see the roadmap), not to silence the alarm.

## 6. `gamehub-prod-memory-high` / `gamehub-prod-disk-high`

**Means:** memory above 90 % (a 1 GB instance running MySQL, Node and nginx) or
the root filesystem above 85 % (Docker images and logs live there).

**Confirm:**

```bash
aws ssm send-command --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["free -m","df -h /","du -sh /var/lib/docker /var/log/gamehub"]' \
  --query Command.CommandId --output text
```

**Act:**

| Cause | Action |
|---|---|
| Memory | the swap file in the user-data is the buffer, not the fix: add a MySQL config file (mounted at `/etc/mysql/conf.d/`) with a smaller `innodb_buffer_pool_size`, or move the database off the box. The image's default is the right size for a real server and too greedy for a 1 GB host |
| Disk from Docker | `docker system prune -af --volumes` removes old layers (it will NOT touch the named volumes — verify with `docker volume ls` first) |
| Disk from logs | the agent ships logs with 7-day retention in CloudWatch; the local copies are rotated by Docker's `json-file` driver, so a runaway log is a code smell |

## 7. Rollback

The pipeline is the only way changes reach the host, so the rollback is also a
pipeline operation:

```bash
git revert <bad-sha>          # or: git revert --mainline 1 <merge-sha>
git push origin main
```

`deploy.yml` publishes the site and rolls the host to the reverted commit. The
frontend image is built on the host from the checked-out commit, so "the
previous version" is exactly the previous commit — no image registry needed.
Database changes are the one thing a revert does not undo: the schema is
additive (see `backend/schema.sql`), which is why it can be.

## 8. Escalation and evidence

- **Alarms:** `gamehub-prod-alarms` (SNS). Subscribe with
  `aws sns subscribe --topic-arn <arn> --protocol email --notification-endpoint <you@example.com>`
  and confirm the mail.
- **Dashboard:** `gamehub-prod` (CloudWatch) — availability, error count,
  latency percentiles, host pressure, live log tables.
- **Logs:** `/gamehub/prod/nginx-access` (structured JSON, every request) and
  `/gamehub/prod/app` (container stdout/stderr, JSON from Express).
- **Audit:** CloudTrail records every `ssm:SendCommand`, so "who restarted the
  host at 03:00" has an answer.
- **Post-deploy check:** the `verify` job in `deploy.yml` asserts the *public*
  edge: the shell, `/learn/` and the PDF, the auth gate (401 without a token on
  every protected route), and — signing in as `smoke-test@gamehub.example` — a
  12-entry catalogue and an identified user. Its credentials are the repository
  secrets `SMOKE_USER_EMAIL` / `SMOKE_USER_PASSWORD`; to rotate, run
  `aws cognito-idp admin-set-user-password --user-pool-id "$COGNITO_USER_POOL_ID"
  --username smoke-test@gamehub.example --password '<new>' --permanent` and
  update both secrets. If a rotated credential is not uploaded, the job fails —
  by design (see ADR-016).
- **Alarm notifications:** the topic has **one subscribed address** — the project
  owner's, passed to the observability stack as the `AlarmEmail` parameter, so
  CloudFormation owns the subscription and a manual `aws sns subscribe` would be
  drift. To change the recipient, re-deploy the stack with a different
  `AlarmEmail` and accept the confirmation mail: until it is accepted the
  subscription sits in `PendingConfirmation` and delivers nothing, which looks
  exactly like "the alarms are quiet tonight". Check it with
  `aws sns list-subscriptions-by-topic --topic-arn <AlarmTopicArn output>`.
  A subscription that was created and never confirmed is the failure mode to
  look for first when someone says alerts are not arriving.
