#!/bin/bash
set -e

# Configuration
S3_BUCKET="${S3_BUCKET:-git-band-site}"
AWS_REGION="${AWS_REGION:-us-east-1}"
CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-}"
DRY_RUN="${DRY_RUN:-false}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
  echo -e "${GREEN}ℹ️  $1${NC}"
}

log_warn() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

# Verify AWS CLI is installed
if ! command -v aws &> /dev/null; then
  log_error "AWS CLI is not installed"
  exit 1
fi

# Verify S3 bucket exists
log_info "Verifying S3 bucket exists..."
if ! aws s3 ls "s3://${S3_BUCKET}" --region "${AWS_REGION}" &> /dev/null; then
  log_error "S3 bucket '${S3_BUCKET}' not found or not accessible"
  exit 1
fi

log_info "Deploying to S3 bucket: ${S3_BUCKET}"

# Files/directories to exclude from sync
EXCLUDE_PATTERNS=(
  "--exclude" ".git/*"
  "--exclude" ".claude/*"
  "--exclude" "node_modules/*"
  "--exclude" ".env*"
  "--exclude" "*.ts"
  "--exclude" "tsconfig.json"
  "--exclude" ".gitignore"
  "--exclude" "*.output"
  "--exclude" "dist/*"
  "--exclude" "scripts/*"
)

# Content type mappings
METADATA_DIRECTIVES=(
  "index.html:text/html;charset=utf-8:public,max-age=300"
  "*.html:text/html;charset=utf-8:public,max-age=300"
  "*.css:text/css;charset=utf-8:public,max-age=31536000"
  "*.js:application/javascript;charset=utf-8:public,max-age=31536000"
  "*.json:application/json;charset=utf-8:public,max-age=300"
  "*.jpg:image/jpeg:public,max-age=31536000"
  "*.png:image/png:public,max-age=31536000"
  "*.mp3:audio/mpeg:public,max-age=31536000"
  "*.woff2:font/woff2:public,max-age=31536000"
)

# Sync to S3
if [ "$DRY_RUN" = "true" ]; then
  log_warn "Running in DRY RUN mode (no changes will be made)"
  DRY_RUN_FLAG="--dryrun"
else
  DRY_RUN_FLAG=""
fi

log_info "Syncing files to S3..."
aws s3 sync . "s3://${S3_BUCKET}/" \
  --region "${AWS_REGION}" \
  --delete \
  "${EXCLUDE_PATTERNS[@]}" \
  --cache-control "public,max-age=300" \
  $DRY_RUN_FLAG

# Update cache control for specific file types
log_info "Updating cache control headers..."
aws s3 cp "s3://${S3_BUCKET}/" "s3://${S3_BUCKET}/" \
  --region "${AWS_REGION}" \
  --exclude "*" \
  --include "*.css" \
  --include "*.js" \
  --include "*.jpg" \
  --include "*.png" \
  --include "*.mp3" \
  --cache-control "public,max-age=31536000" \
  --metadata-directive REPLACE \
  --recursive \
  $DRY_RUN_FLAG

# Invalidate CloudFront if distribution ID is provided
if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ] && [ "$DRY_RUN" != "true" ]; then
  log_info "Invalidating CloudFront distribution: ${CLOUDFRONT_DISTRIBUTION_ID}"
  aws cloudfront create-invalidation \
    --distribution-id "${CLOUDFRONT_DISTRIBUTION_ID}" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text
  log_info "CloudFront invalidation created"
fi

log_info "✅ Deployment complete!"
