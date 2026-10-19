#!/usr/bin/env bash
# =========================================================
# GameHub — build the /learn site and render its print guide to PDF.
#
#   ./scripts/build-pdf.sh [output.pdf]
#
# Steps:
#   1. node scripts/build-learn.js   → regenerate learn/ (HTML + CSS + fonts)
#   2. headless Chrome/Chromium      → print learn/guide.html to the PDF
#
# No new dependencies: Node built-ins generate the site, and the
# PDF is produced by a browser the machine already has. The result
# (learn/gamehub-guide.pdf) sits next to the site it was made from.
# =========================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$ROOT/learn/gamehub-guide.pdf}"
GUIDE="$ROOT/learn/guide.html"

# ── 1. build the site (and the guide page) ────────────────────────────────
echo "▶ building /learn site"
node "$ROOT/scripts/build-learn.js"

if [ ! -f "$GUIDE" ]; then
  echo "✖ $GUIDE was not generated — is scripts/build-learn.js working?" >&2
  exit 1
fi

# ── 2. locate a headless browser ──────────────────────────────────────────
CHROME="${CHROME_BIN:-}"
if [ -z "$CHROME" ]; then
  for candidate in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium"; do
    if [ -x "$candidate" ]; then CHROME="$candidate"; break; fi
  done
fi
if [ -z "$CHROME" ]; then
  CHROME="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
fi
if [ -z "$CHROME" ] || [ ! -x "$CHROME" ]; then
  echo "✖ headless Chrome/Chromium not found." >&2
  echo "  Install Google Chrome, or point CHROME_BIN at the binary, e.g." >&2
  echo "    CHROME_BIN=/usr/bin/chromium ./scripts/build-pdf.sh" >&2
  exit 1
fi
echo "▶ rendering with: $CHROME"

# ── 3. render learn/guide.html → the PDF ──────────────────────────────────
mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"

# file:// with local-file access so the relative self-hosted woff2 fonts load.
"$CHROME" \
  --headless=new \
  --disable-gpu \
  --no-sandbox \
  --hide-scrollbars \
  --allow-file-access-from-files \
  --run-all-compositor-stages-before-draw \
  --virtual-time-budget=20000 \
  --no-pdf-header-footer \
  --print-to-pdf-no-header \
  --print-to-pdf="$OUT" \
  "file://$GUIDE" >/dev/null 2>&1

if [ ! -s "$OUT" ]; then
  echo "✖ PDF was not produced (or is empty): $OUT" >&2
  exit 1
fi

printf '✔ %s (%s)\n' "${OUT#"$ROOT"/}" "$(du -h "$OUT" | cut -f1)"
