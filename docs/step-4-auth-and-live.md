# Step 4 — Real Auth + Live on AWS ✅ (2026-10-19)

> **Verified by:** 64 automated tests (31 backend + 33 frontend) · Cognito
> signing key pair exercised with real RSA signatures · live site served from
> CloudFront · `/api/*` answering through the CloudFront origin · a confirmed
> test user signing in and calling `/api/me` with a real ID token

## What was built

Players now sign up and sign in before they reach the games, and the whole thing
runs on AWS as code — no console clicking, no SSH, no stored access keys.

| Piece | Implementation | Why not the alternative |
|---|---|---|
| **Sign-in gate** (`frontend/auth.js`) | Raw Cognito REST calls: `SignUp`, `ConfirmSignUp`, `InitiateAuth` (`USER_PASSWORD_AUTH`) | *Amplify or the AWS SDK* → hundreds of KB of JavaScript for three endpoints, plus a bundler this project intentionally does not have |
| **Token verification** (`backend/auth.js`) | RS256 checked against the pool JWKS with `node:crypto`; `iss`, `aud`/`client_id`, `exp`, `token_use` all validated | *`jsonwebtoken` + `jwks-rsa`* → two dependencies to do what `createPublicKey({format:"jwk"})` already does; *trusting the frontend* → not security |
| **Enforcement model** | Middleware on `/api/*` except `/api/health` and `/api/ready`, active only when the pool is configured | *Always-on* → local development and CI would break or need fake pools; *client-only guard* → trivially bypassed with `curl` |
| **Frontend hosting** (`infra/site.yaml`) | Private S3 bucket + CloudFront with Origin Access Control; `/api/*` behaviour with caching disabled | *Public bucket* → everyone can read and write objects; *caching the API* → stale data and cross-user cache confusion |
| **API host** (`infra/backend.yaml`) | One EC2 instance running the **same** `docker-compose.yml` as local development, with a 2 GB swap file | *ECS/Fargate + RDS* → more moving parts and cost for a portfolio demo; *Lambda* → the MySQL container would have to go, which is the opposite of "the deployed thing is the local thing" |
| **Access model** | No SSH. Ingress on 8080 only from the AWS-managed CloudFront origin-facing prefix list; admin via SSM; IMDSv2 required | *`0.0.0.0/0` on 22 + a key pair* → the most common way a portfolio EC2 becomes someone else's crypto miner |
| **Deploys** (`github-oidc.yaml` + `deploy.yml`) | GitHub OIDC → role scoped to this repo, bucket, distribution and instance; site published by `s3 sync`, API host rolled out by an SSM command | *Long-lived IAM keys in GitHub secrets* → a permanent credential to leak; *rebuilding the host per deploy* → slower, and the DB volume lives there |

## Things that had to be got right

1. **`AutoVerifiedAttributes` + email-only username.** New pools make MFA
   mandatory unless you opt out, and users sign in with an email address rather
   than a username. Both are explicit in the template.
2. **Cognito emits `client_id` on access tokens and `aud` on ID tokens.** The
   verifier accepts either, then rejects non-ID tokens outright — accepting an
   access token here would hand out a weaker identity contract.
3. **The probes must never 401.** `/api/health` and `/api/ready` are exempt from
   the gate; an orchestrator that cannot reach its own health endpoint kills a
   healthy service.
4. **CloudFront needs a domain name, not an IP, for a custom origin.** The
   backend stack outputs the instance's public DNS name while the elastic IP
   keeps it stable.
5. **A 1 GB instance running MySQL wants swap.** The user-data script creates a
   2 GB swap file before starting the stack — cheap insurance against the OOM
   killer during a `docker compose build`.
6. **The artifact carries its config, the repo does not.** `config.js` ships
   with `authEnabled:false` for local development; `scripts/build-frontend.sh`
   writes the real pool ids into a git-ignored `build/` directory at deploy time.
7. **An edge invalidation is not a browser invalidation.** After a deploy the
   browser still ran the previous `script.js` from its week-long cache, which
   made a fixed landing page look broken. The build now stamps every asset URL
   with the deploy version (`script.js?v=<sha>`) while HTML stays on a
   one-minute cache — the standard two-tier answer to "how do users get the new
   version without a hard refresh?"

## Concepts to understand cold

- **OIDC federation**: how a GitHub-issued JWT becomes temporary AWS credentials,
  and why the `sub` condition is what stops any other repository from assuming
  your deploy role
- **JWKS and key rotation**: why the verifier fetches public keys instead of a
  shared secret, and why the result is cached
- **Edge vs origin caching**: why static assets get a week and HTML gets a
  minute, and why `/api/*` must not be cached at all
- **Origin Access Control**: keeping an S3 bucket private while still serving it
  through a CDN
- **Blast-radius reduction**: no SSH, SSM-only admin, prefix-list ingress, IMDSv2

## Interview questions this unlocks

1. *"How does your API know a request comes from a signed-in user?"* (signature,
   issuer, audience, expiry — and why client-side checks are not the boundary)
2. *"How do your CI pipelines authenticate to AWS, and what happens if the repo
   is compromised?"* (no keys; role scoped to repo, bucket, distribution,
   instance)
3. *"Why is the S3 bucket private, and how does the CDN still read it?"* (OAC +
   bucket policy condition on the distribution ARN)
4. *"What is your EC2 host's attack surface?"* (no SSH, one port, one prefix
   list, SSM only, IMDSv2)
5. *"How do you deploy config that differs per environment without committing
   it?"* (generate at build time into a git-ignored directory)
