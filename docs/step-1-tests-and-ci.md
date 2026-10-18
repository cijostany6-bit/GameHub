# Step 1 — Automated Tests + GitHub Actions CI ✅ (2026-10-18)

> **Verified by:** 14/14 tests green · coverage gate (95% lines / 81% branches /
> 90% functions, gate at 80) · lint clean · CI badge on `main`

## What was built

| Layer | Tooling | Scope |
|---|---|---|
| Unit suite | `node:test` (built-in — **zero test dependencies**) | Liveness, 404 JSON, CORS allow/deny, header hardening, malformed JSON → 400, **DB-outage behaviour** |
| Integration suite | `node:test` + real MySQL | Readiness, catalogue shape/ordering/uniqueness, category contract with the UI |
| Gate | `--test-coverage-lines/branches/functions=80` | CI **fails** under 80% — the number is enforced, not decorative |
| Lint | ESLint 9 flat config | `eslint .` is a CI step, not advice |
| CI | GitHub Actions, **3 jobs** | ① lint+test+coverage vs a MySQL **service container** ② real-image **stack smoke test** ③ **security**: gitleaks / Trivy / npm audit |

### Design decisions

- **Integration skips loudly instead of failing** when MySQL is unreachable —
  a fresh clone with Docker off still gets green unit tests, and the console
  says exactly why integration was skipped.
- **`/api/health` survives a database outage by test**, not by claim: the suite
  loads the app pointed at a *closed port* and asserts liveness=200,
  readiness=503. This is the test that prevents the crash-loop anti-pattern
  from regressing.
- **No supertest/jest**: `node:test` + built-in `fetch` covers everything here —
  fewer dependencies is itself a supply-chain decision (npm audit stays 0).
- MySQL published on **`127.0.0.1` only** so host-run integration tests work;
  CI uses a service container instead of the developer's database.

## The bugs we hit

1. **Test process hung forever** after passing — the MySQL pool kept the event
   loop alive. Fix: `after()` now closes keep-alive sockets
   (`server.closeAllConnections()`) **and** `await pool.end()`.
2. **Coverage gate failed at 78.6% branches** — the honest fix was *new tests*
  (DB-error 500 path, TLS config branch, JSON parse failure), not a lower
   threshold. The gate also exposed a real defect: malformed JSON returned 500;
   it now returns 400 (client error).

## Concepts to understand cold

- **Service containers** in GitHub Actions vs local Docker — same MySQL image,
  different wiring
- What a **coverage gate** does and why coverage ≠ correctness (we test
  *behaviour*: CORS refusal, outage semantics, error non-leakage)
- **Test isolation**: `node --test` runs each file in its own process — why
  that matters when tests mutate `process.env` and `require.cache`

## Interview questions this unlocks

1. *"Your CI coverage gate fails at 78% — do you lower the threshold?"*
2. *"How would you test that your app behaves correctly during a database outage?"*
3. *"What's the difference between a unit test and an integration test in your
   repo, and when does each run?"*
4. *"Name two things your security job would catch before a human reviews the PR."*
