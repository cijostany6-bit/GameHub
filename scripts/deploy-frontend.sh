#!/bin/bash
# =========================================================
# GameHub — publish the static frontend to S3 + invalidate CloudFront.
#
# Used by CI (.github/workflows/deploy.yml) and usable locally:
#
#   STACK_NAME=gamehub-site AWS_REGION=eu-central-1 ./scripts/deploy-frontend.sh
#
# Stack outputs supply the bucket, distribution id and Cognito ids,
# so there is a single source of truth for the deployment.
# =========================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACK_NAME="${STACK_NAME:-gamehub-site}"
AWS_REGION="${AWS_REGION:-eu-central-1}"

output() {
    aws cloudformation describe-stacks \
        --region "$AWS_REGION" \
        --stack-name "$STACK_NAME" \
        --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
        --output text
}

export COGNITO_REGION="${COGNITO_REGION:-$AWS_REGION}"
export COGNITO_USER_POOL_ID="${COGNITO_USER_POOL_ID:-$(aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name gamehub-cognito --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)}"
export COGNITO_CLIENT_ID="${COGNITO_CLIENT_ID:-$(aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name gamehub-cognito --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text)}"

BUCKET="${SITE_BUCKET:-$(output BucketName)}"
DISTRIBUTION_ID="${DISTRIBUTION_ID:-$(output DistributionId)}"

"$ROOT/scripts/build-frontend.sh"

echo "Syncing static assets → s3://$BUCKET"
# Long cache for versioned-everything-but-HTML.

# shellcheck disable=SC2086
aws s3 sync "$ROOT/build/frontend/" "s3://$BUCKET/" \
    --region "$AWS_REGION" \
    --delete \
    --exclude "*.html" \
    --exclude ".DS_Store" \
    --cache-control "public, max-age=604800"

# shellcheck disable=SC2086
aws s3 sync "$ROOT/build/frontend/" "s3://$BUCKET/" \
    --region "$AWS_REGION" \
    --exclude "*" \
    --include "*.html" \
    --cache-control "public, max-age=60, must-revalidate"

echo "Invalidating CloudFront $DISTRIBUTION_ID"
INVALIDATION_ID="$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*" \
    --query "Invalidation.Id" --output text)"

aws cloudfront wait invalidation-completed \
    --distribution-id "$DISTRIBUTION_ID" \
    --id "$INVALIDATION_ID"

echo "Published → $(output SiteUrl)"
