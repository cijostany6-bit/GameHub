#!/usr/bin/env bash
# =========================================================
# GameHub — smoke test against the RUNNING stack.
# Exits non-zero on the first failure so it can gate CI.
#
#   ./scripts/smoke.sh
# =========================================================
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
FAILURES=0

check() {
    local name="$1" expected="$2" actual="$3"
    if [ "$expected" = "$actual" ]; then
        echo "  ✔ ${name}"
    else
        echo "  ✘ ${name} (expected HTTP ${expected}, got ${actual})"
        FAILURES=$((FAILURES + 1))
    fi
}

echo "Smoke testing ${BASE_URL} ..."

# 1. Frontend serves the UI
status=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/")
check "frontend /" "200" "$status"

# 2. Liveness (no DB dependency)
status=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health")
check "liveness /api/health" "200" "$status"

# 3. Readiness (DB reachable)
status=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/ready")
check "readiness /api/ready" "200" "$status"

# 4. Games catalogue is non-empty
game_count=$(curl -s "${BASE_URL}/api/games" | grep -o '"id"' | wc -l | tr -d ' ')
if [ "$game_count" -ge 1 ]; then
    echo "  ✔ catalogue /api/games (${game_count} games)"
else
    echo "  ✘ catalogue /api/games returned ${game_count} rows"
    FAILURES=$((FAILURES + 1))
fi

# 5. Unknown route is a clean 404 JSON, not an HTML stack trace
status=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/nope")
check "404 handler /api/nope" "404" "$status"

if [ "$FAILURES" -gt 0 ]; then
    echo "✘ ${FAILURES} check(s) failed"
    exit 1
fi

echo "✔ All smoke checks passed"
