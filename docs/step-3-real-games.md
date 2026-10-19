# Step 3 — Real Playable Games ✅ (2026-10-19)

> **Verified by:** 40 automated tests (19 backend + 21 frontend) · engine tests
> run the real game loops in Node · browser spot-checks on 4 engines + the 404
> path · catalogue→runner click-through · `make smoke` 5/5 · CI full-stack job

## What was built

**Every one of the 12 catalogue entries now opens an actual, playable game.**
No placeholders, no alerts — a `play.html?id=<n>` runner that fetches the title,
dispatches it to a real engine, and drives a READY → PLAYING → GAME OVER state
machine with HUD, per-title high scores (localStorage) and controls help.

| Piece | Implementation | Why not the alternative |
|---|---|---|
| **6 engines** (`engines.js`) | snake · breakout · dodge (survival racing) · memory · reflex · pong — all plain canvas 2D, zero dependencies | *12 bespoke games* → weeks of content work with no new DevOps signal; *one engine themed 12 ways* → dishonest ("every game is snake"); 6 engines × 2 titles is real variety at portfolio scale |
| **Title → engine mapping** | `ENGINE_MAP` in `play.js` keyed by game **name** (a uniqueness contract already enforced by a backend integration test) | *An `engine` DB column* → schema migration + `make db-reset` for a frontend concern; the name-uniqueness test already guards the invariant |
| **Coverage contract test** | `mapping.test.js` parses the DB seed and `play.js` and fails CI if any seeded title lacks an engine (or vice versa) | *Manual checking* → the promise "every game is playable" would silently rot the day someone adds a seed row |
| **Engine tests** | The real engines run in Node against a stubbed canvas/DOM (`vm` + Proxy ctx), driven frame-by-frame | *Browser automation* → a hidden window never fires `requestAnimationFrame`; headless pixels are not behaviour. Frame-driving asserts real terminal paths (snake hits the wall, breakout runs out of lives, pong reaches 5) |
| **`GET /api/games/:id`** | Single-title endpoint with 404 for unknown **and** non-numeric ids (no crash, no leak) | *Fetching the whole list* → the runner only needs one title; the endpoint is also the natural REST shape a reviewer looks for |

## The bugs we hit

1. **The engine tests found a real gameplay stall.** In breakout, a dead-centre
   paddle hit computes `vx = 0` → the ball bounces vertically forever on a
   stationary paddle and the game can never end. Fixed with a minimum horizontal
   component (`speed * 0.25`). A test that couldn't fail this way would have been
   a decoration.
2. **`413` was missing.** Oversized JSON bodies (body-parser's
   `entity.too.large`) fell through to the central 500 handler. Now: 413 with a
   clean body — and the fall-through path itself is covered by a test.
3. **The running container served the old API.** `/api/games/1` returned the
   404 handler because the backend container still ran the Phase 0 image;
   local `curl` against the *new* code hid it. Lesson: images are immutable —
   a route is not deployed until the image is rebuilt.

## Concepts to understand cold

- **Game loop fundamentals**: fixed-step update + render, why `dt` clamping
  matters, and why input should be queued (snake buffers direction changes so a
  fast double-tap can't reverse the snake into itself)
- **Testing graphics code without pixels**: stub the context, drive frames,
  assert *state transitions* (score, lives, game over) — behaviour over pixels
- **Contract tests as product promises**: "every catalogue entry is playable"
  converted into a failing build when violated
- **REST resource design**: list vs detail, idempotent reads, honest 404s for
  malformed identifiers

## Interview questions this unlocks

1. *"How do you test canvas game logic in CI without a browser?"*
2. *"Your test suite can't fail — how do you know it's actually testing
   anything?"* (the breakout stall is the answer)
3. *"Someone adds a 13th game to the seed — what stops the catalogue from
   shipping a dead entry?"*
4. *"Why did `curl` succeed while the browser got a 404?"* (immutable images)
