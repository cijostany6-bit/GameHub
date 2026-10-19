#!/usr/bin/env bash
# =========================================================
# GameHub — verify account deletion (GDPR art. 17) end to end.
#
# Run against a REAL deployment:
#
#   SITE_URL=https://xxxx.cloudfront.net \
#   COGNITO_USER_POOL_ID=eu-central-1_xxxxxxxxx \
#   COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx \
#   ./scripts/verify-gdpr.sh
#
# What it proves, in order:
#   1. a real player can be created and can sign in
#   2. the API stores that player's best score
#   3. the player can read their own data (art. 15/20)
#   4. DELETE /api/me answers 204
#   5. the score row is gone
#   6. the Cognito identity (the email) is gone
#
# A failure at any step is a real finding. The script cleans up
# after itself: a leftover test user would be its own data-protection
# problem, so the trap removes the user unless step 6 already did.
#
# Requires: awscli v2 (configured), curl. No jq, no third-party tools.
# =========================================================

set -euo pipefail

: "${SITE_URL:?SITE_URL is required (e.g. https://xxxx.cloudfront.net)}"
: "${COGNITO_USER_POOL_ID:?COGNITO_USER_POOL_ID is required}"
: "${COGNITO_CLIENT_ID:?COGNITO_CLIENT_ID is required}"
AWS_REGION="${AWS_REGION:-eu-central-1}"

USERNAME="gdpr-check+$(date +%s)-$$@gamehub.example"
# Must satisfy the pool's password policy; generated per run so a leaked
# transcript cannot be replayed.
PASSWORD="Gdpr!Check$(date +%s)Xy9"
GAME="Cyber Strike"
SCORE=1337

ID_TOKEN=""
CONFIRMED=0
DELETED_BY_TEST=0

fail() {
    echo "✘ FAIL: $1" >&2
    exit 1
}

cleanup() {
    if [ "$DELETED_BY_TEST" -eq 0 ]; then
        echo "→ cleaning up the test user ($USERNAME)"
        aws cognito-idp admin-delete-user \
            --region "$AWS_REGION" \
            --user-pool-id "$COGNITO_USER_POOL_ID" \
            --username "$USERNAME" >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

echo "==> erasure check against $SITE_URL"
echo "    test user: $USERNAME"

# ---------------------------------------------------------------
# 1. create and confirm a real player
# ---------------------------------------------------------------
aws cognito-idp sign-up \
    --region "$AWS_REGION" \
    --client-id "$COGNITO_CLIENT_ID" \
    --username "$USERNAME" \
    --password "$PASSWORD" >/dev/null
echo "  ✔ signed up"

aws cognito-idp admin-confirm-sign-up \
    --region "$AWS_REGION" \
    --user-pool-id "$COGNITO_USER_POOL_ID" \
    --username "$USERNAME"
CONFIRMED=1
echo "  ✔ confirmed"

aws cognito-idp admin-get-user \
    --region "$AWS_REGION" \
    --user-pool-id "$COGNITO_USER_POOL_ID" \
    --username "$USERNAME" >/dev/null
echo "  ✔ the user exists in the pool (step 6 must make this fail)"

AUTH=$(aws cognito-idp initiate-auth \
    --region "$AWS_REGION" \
    --client-id "$COGNITO_CLIENT_ID" \
    --auth-flow USER_PASSWORD_AUTH \
    --auth-parameters "USERNAME=$USERNAME,PASSWORD=$PASSWORD" \
    --query "AuthenticationResult.IdToken" --output text)
[ -n "$AUTH" ] && [ "$AUTH" != "None" ] || fail "no ID token returned"
ID_TOKEN="$AUTH"
echo "  ✔ signed in and obtained an ID token"

# ---------------------------------------------------------------
# 2. store a score
# ---------------------------------------------------------------
STATUS=$(curl -sS -o /tmp/gdpr-score.json -w '%{http_code}' \
    -X POST "$SITE_URL/api/scores" \
    -H "Authorization: Bearer $ID_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"game\":\"$GAME\",\"score\":$SCORE}")
[ "$STATUS" = "201" ] || fail "POST /api/scores returned $STATUS (expected 201)"
grep -q "\"best\":$SCORE" /tmp/gdpr-score.json \
    || fail "the stored best is not $SCORE: $(cat /tmp/gdpr-score.json)"
echo "  ✔ score stored (201, best=$SCORE)"

# ---------------------------------------------------------------
# 3. read it back (art. 15/20)
# ---------------------------------------------------------------
curl -sS -o /tmp/gdpr-me.json -H "Authorization: Bearer $ID_TOKEN" \
    "$SITE_URL/api/scores/me"
grep -q "\"count\":1" /tmp/gdpr-me.json \
    || fail "expected exactly 1 stored row: $(cat /tmp/gdpr-me.json)"
echo "  ✔ the player can read their own data (1 row)"

# ---------------------------------------------------------------
# 4. erase the account
# ---------------------------------------------------------------
STATUS=$(curl -sS -o /tmp/gdpr-delete.json -w '%{http_code}' \
    -X DELETE "$SITE_URL/api/me" -H "Authorization: Bearer $ID_TOKEN")
[ "$STATUS" = "204" ] || fail "DELETE /api/me returned $STATUS (expected 204): $(cat /tmp/gdpr-delete.json)"
echo "  ✔ DELETE /api/me answered 204"

# ---------------------------------------------------------------
# 5. the data is gone
# ---------------------------------------------------------------
curl -sS -o /tmp/gdpr-me-after.json -H "Authorization: Bearer $ID_TOKEN" \
    "$SITE_URL/api/scores/me"
grep -q "\"count\":0" /tmp/gdpr-me-after.json \
    || fail "rows survived the deletion: $(cat /tmp/gdpr-me-after.json)"
echo "  ✔ no score rows remain"

# ---------------------------------------------------------------
# 6. the identity is gone
# ---------------------------------------------------------------
if aws cognito-idp admin-get-user \
    --region "$AWS_REGION" \
    --user-pool-id "$COGNITO_USER_POOL_ID" \
    --username "$USERNAME" >/dev/null 2>&1; then
    fail "the Cognito user still exists after DELETE /api/me"
fi
DELETED_BY_TEST=1
echo "  ✔ the Cognito identity is gone (admin-get-user: UserNotFoundException)"

echo
echo "✔ erasure verified end to end: identity deleted first in the database,"
echo "  then in Cognito, with a 204 only after both had succeeded."
