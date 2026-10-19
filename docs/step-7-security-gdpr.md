# Step 7 — Security hardening & GDPR ✅ (2026-10-19)

> **Verified by:** the CI job on this commit (51 backend tests, including a real
> RSA-signed JWT verified against a live JWKS and a hand-rolled SigV4
> `AdminDeleteUser` call captured and asserted field by field against a local
> admin endpoint), a migration runner executing for real against MySQL 8.4, and a
> live end-to-end erasure on production: sign up → submit a score → confirm the
> row exists → `DELETE /api/me` → confirm the row is gone **and** the user no
> longer exists in the Cognito pool.

## What was built

Security is not a feature you add at the end; it is a set of claims that are
either true or false. This step is about making each claim checkable in the
repository.

| Piece | Implementation | Why not the alternative |
|---|---|---|
| **No AWS SDK on the host** (`backend/cognito.js`) | ~120 lines: IMDSv2 credential fetch + SigV4 request signing for the single API call the app makes to AWS (`AdminDeleteUser`) | *Pulling in `@aws-sdk/client-cognito-identity-provider`* → tens of megabytes and a credential-provider chain to debug, to send one `POST`; the signing algorithm is the thing worth understanding |
| **Credentials** | IMDSv2 only: `PUT /latest/api/token`, then every metadata `GET` carries `X-aws-ec2-metadata-token` | *IMDSv1* → any SSRF in any container on the host becomes an instance-role theft; *long-lived access keys in `.env`* → a key on disk to rotate, leak and explain |
| **Permission** | An inline IAM policy on the instance role, scoped to **one** user-pool ARN (`infra/backend.yaml`) | *`CognitoPowerUser`, or a `*` resource* → the app could delete users in any pool of any account it can reach; least privilege here is one ARN |
| **Score storage** | One row per `(user_sub, game)` with `score = GREATEST(score, VALUES(score))`, keyed by the Cognito `sub` | *A row per play* → a behavioural history the app never needs and therefore should not hold; *keying by email* → copying a personal identifier into a second system for no reason |
| **Erasure** (`DELETE /api/me`) | Delete the DB rows **first**, then `AdminDeleteUser`; a Cognito failure answers `502` with a truthful message | *Delete the identity first* → the user can no longer authenticate, so a failed row deletion is unretryable and the data is orphaned forever |
| **Rights built into the app** (`frontend/profile.html`) | The account page *is* the access/portability answer (identity + every row, copyable as JSON) and the erasure control | *An email address in a README* → a GDPR right you have to be asked for is a right you have implemented on paper only |
| **Notice** (`frontend/privacy.html`) | Bilingual EN/DE notice: data inventory, purpose, legal basis, retention, processors, rights | *A link to AWS's privacy page* → answers the wrong question; the notice must say what **this** service does |
| **Open mode** | `/api/*` signed-in routes answer `501` when no Cognito pool is configured | *Returning `200` with an empty dataset* → local development silently exercises a path production never takes; *`401` everywhere* → a contributor cannot tell "not configured" from "not allowed" |
| **CI/CD** (`.github/workflows/`) | Deploy runs only on a **successful CI run for the exact commit**, then smoke-tests the public URL; SBOM (syft), image scanning (Trivy), `npm audit`, Dependabot | *Deploy on `push`* → production can receive a commit that CI has not finished judging; *deploy and hope* → a deploy is not done when the command exits 0 |
| **Schema** (`db/migrations/`, `scripts/migrate.sh`) | A ledger (`schema_migrations`) with a checksum per file; a rewritten migration is refused | *`init.sql` alone* → it runs once, on an empty volume, and never again — which is fine locally and wrong in production |

## Things that had to be got right

1. **`AdminDeleteUser` is an admin API, and an admin API does not accept a
   user's token.** The player's JWT proves *who is asking*; it cannot authorize
   a pool-wide operation. The backend therefore has to sign its own AWS request —
   which is why this step contains a SigV4 implementation, and why the test
   suite asserts the signature rather than trusting it.
2. **SigV4 signs almost everything except the two things you expect.** The
   canonical request covers the method, the URI, the query string, the canonical
   headers, the *signed headers list* and the payload hash. Miss the payload hash
   and the signature is still "valid" to a naive check while binding nothing —
   the test that changes the request body and asserts the signature changes is
   the one that caught this class of mistake.
3. **Temporary credentials must be signed.** When the credentials come from
   IMDS, the session token is a *header that is part of the signature*
   (`x-amz-security-token`). Adding it after signing produces an error that reads
   like a permissions problem and is not one.
4. **IMDSv2 is a two-step protocol, and that is the point.** `PUT` for a token,
   then attach it to every `GET`. The token is what makes an SSRF from inside a
   container useless — which is why the host is configured for token-required
   metadata and why the tests run the whole dance against a local stand-in
   server rather than a mock.
5. **The order of deletion is the design.** Data rows first, identity second.
   Delete the identity first and a failure leaves data that no one — including
   the user — can ever delete, because the user no longer exists to authenticate.
   The `502` message is deliberately blunt: *"Your game data was deleted, but the
   sign-in account could not be removed."* A half-finished erasure must never be
   reported as a completed one.
6. **A `sub` is pseudonymous, not anonymous.** The database holds no email
   address, but `sub` is still personal data under the GDPR. That is why the
   privacy notice lists it, and why it is deleted along with everything else.
7. **Request logs are personal data.** The nginx/CloudWatch access logs contain
   IP addresses, so the 7-day retention is a data-protection decision with a
   legal basis (legitimate interest), not just a cost setting. It is written down
   in the notice, in the same table as the email address.
8. **Self-hosted fonts are a German legal requirement in practice.** Loading
   `fonts.googleapis.com` transmits every visitor's IP to Google; German courts
   have held that this needs consent. The fonts here are self-hosted OFL files
   in `frontend/fonts/`, so the page makes no third-party request at all.
9. **`db/init.sql` only runs on an empty data volume.** That is a real property
   of the official MySQL image, and it means the file that documents the schema
   is not the file that updates a live one. Hence the migration runner — with
   checksums, because a migration that silently changed after being applied is
   worse than no migration ledger at all.
10. **A deploy is finished when the public URL says so.** The `verify` job runs
    after both deploys and checks the *edge* (CloudFront), not the host: real
    homepage markup, all 12 catalogue entries from the API, game details by id,
    and — the security assertion — that an unauthenticated `/api/me` returns
    `401`. A crashed container, a stale origin or a bad certificate fails this
    job.
11. **The security scans are in CI, so they are not optional.** Gitleaks over
    the full git history (not just the diff — a secret that was committed and
    removed is still leaked), Trivy against the *filesystem* and the *built
    image* (a package can be added by the base image), `npm audit`, an SPDX SBOM
    kept as a build artifact, and Dependabot for npm, Actions and base images.
12. **Branch protection makes the gate real.** The deploy is CI-gated, but CI is
    only a gate if the merge itself is gated. On `main`: the four CI jobs are
    required status checks with *strict* mode (the branch must be up to date),
    administrators are **not** exempt, force-pushes and deletion are disabled,
    and unresolved review conversations block the merge. A required human
    approval is deliberately absent — this is a one-person repository, and a
    rule that GitHub refuses to satisfy (you cannot approve your own pull
    request) is a rule that gets disabled the first time it is inconvenient.

## Concepts to understand cold

- **SigV4**: canonical request → string to sign → derived signing key
  (`kSecret → kDate → kRegion → kService → kSigning`) → `HMAC-SHA256`. Why the
  key is derived per region and per service.
- **IMDSv2**: the token `PUT`, the one-hour default TTL, why link-local
  `169.254.169.254` is reachable from the instance and nothing else, and why
  `HttpTokens: required` is a hardening control.
- **GDPR as engineering**: controller vs. processor, legal basis (contract vs.
  legitimate interest), data minimisation, storage limitation, and the four
  rights that have code behind them here (access, portability, erasure,
  objection).
- **Least privilege**: an IAM permission scoped to a resource ARN
  (`userpool/eu-central-1_…`) instead of an action wildcard.
- **Supply chain**: SBOM ≠ vulnerability scan ≠ dependency update. Three
  different questions, three different tools, all running on every change.

## Interview questions this unlocks

1. *Where does the authorisation decision actually happen when a user deletes
   their account, and what would break if the token were the only credential?*
2. *What is the failure mode of deleting the identity before the data, and how
   does your API report a partial erasure?*
3. *How would an SSRF in the frontend container escalate, and what stops it?*
4. *Your database is pseudonymous, not anonymous. Is that enough for the GDPR?
   Justify it.*
5. *Why is a migration checksum worth the complexity?*
6. *What does the deploy pipeline prove before traffic reaches a user?*
7. *Which of the four GDPR rights would you implement first in a product, and
   why is that a business decision as much as a legal one?*
