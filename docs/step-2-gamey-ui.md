# Step 2 — Game-y UI: Live Background + Self-Hosted Arcade Fonts ✅ (2026-10-18)

> **Verified by:** browser inspection (0 third-party requests, all three font
> faces active, canvas layer present) · `bg.js` render logic executed against a
> stubbed DOM (118 draw calls/frame; zero frames under `prefers-reduced-motion`)
> · `make smoke` 5/5 · CI full-stack job rebuilds the immutable frontend image

## What was built

| Layer | Implementation | Why this and not the alternative |
|---|---|---|
| **Fonts** | Press Start 2P (arcade accents) + Chakra Petch (headings/body), **self-hosted woff2** with OFL licenses in-repo | *Google Fonts CDN* (what existed — an `@import` in `style.css`) → every visitor's IP is disclosed to Google on page load; German courts ruled this unlawful without consent (GDPR/§25 TTDSG). Kills Lighthouse third-party requests too |
| **Live background** | One `<canvas>`: 3-layer parallax starfield (pixel squares), rising neon pixel particles, rare shooting stars — ~118 draw calls/frame, zero dependencies | *CSS-only gradients* (what existed — static) → user explicitly asked for a moving, "games time" background; *a particle library* → supply-chain weight for 150 lines of canvas we control |
| **Always-moving layers** | Grid scrolls upward (CSS `background-position` keyframes), one blurred neon orb drifts (`body::after`, fixed layer) | Cheap GPU-friendly transforms; content stays above (negative z-index layers) |
| **Accessibility** | `prefers-reduced-motion`: canvas never created, grid/orb animations off | A moving background must not violate user motion preferences |
| **Arcade controls** | Press Start 2P on buttons/filters/logo/badges (kept ≤10px — the font is wide), Chakra Petch 700 on headings | Full-page Press Start 2P would destroy readability and overflow cards |

## The bugs we hit

1. **The edited CSS never appeared in the browser while `curl` showed it
   served.** Root cause: `Last-Modified: Sep 16` on the old file gave the
   browser *heuristic freshness* (10% of file age ≈ 3 days) — it never
   revalidated. Lesson (and production truth): the frontend ships as an
   **immutable Docker image**, so any UI change requires `docker-compose build
   frontend` — bind-mounting for "quick edits" would fork local behaviour away
   from production.
2. **Canvas "wasn't animating" in tooling.** Root cause: `requestAnimationFrame`
   is paused in hidden windows. The render loop was verified by executing
   `bg.js` against a stubbed DOM in Node instead — an executable proof that
   doesn't depend on a visible desktop.

## Concepts to understand cold

- **GDPR and third-party assets**: why self-hosting fonts is a legal requirement
  in Germany, not a preference — and why `font-display: swap` keeps LCP intact
- **Heuristic caching**: no `Cache-Control` header → browser derives freshness
  from `Last-Modified` age; the debugging workflow when "my change isn't there"
- **Immutable artifacts**: same image in dev, CI, and prod — changes mean a
  rebuild, and that's the point
- **Canvas vs CSS** for continuous animation: when `requestAnimationFrame` wins
  (many moving objects) and when transforms/keyframes win (few large shapes)

## Interview questions this unlocks

1. *"A style change works in curl but not in the browser — walk me through
   how you'd diagnose it."*
2. *"Your Lighthouse audit flags fonts.googleapis.com — is that a performance
   or a compliance problem in Germany? How do you fix both?"*
3. *"How do you make a continuously animated background accessible and
   battery-friendly?"*
4. *"Why can't developers just edit files inside the running container?"*
