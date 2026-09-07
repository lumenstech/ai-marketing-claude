#!/bin/sh
set -eu

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

require_cmd npx

if ! npx wrangler whoami >/dev/null 2>&1; then
  echo "Wrangler is not authenticated in this environment." >&2
  echo "Authenticate the machine once with Wrangler, then rerun this script." >&2
  exit 2
fi

create_bucket() {
  bucket="$1"
  if npx wrangler r2 bucket list 2>/dev/null | grep -F "$bucket" >/dev/null 2>&1; then
    echo "R2 bucket exists: $bucket"
  else
    echo "Creating R2 bucket: $bucket"
    npx wrangler r2 bucket create "$bucket"
  fi
}

create_bucket lumens-ad-factory-assets
create_bucket lumens-ad-factory-assets-dev

put_secret_if_present() {
  name="$1"
  eval "value=\${$name-}"
  if [ -n "${value:-}" ]; then
    printf '%s' "$value" | npx wrangler secret put "$name"
    echo "Updated Worker secret from existing environment: $name"
  else
    echo "Environment variable not present, leaving Worker secret unchanged: $name"
  fi
}

put_secret_if_present DATABASE_URL
put_secret_if_present GEMINI_API_KEY
put_secret_if_present AD_FACTORY_TOKEN

if [ -n "${NANO_BANANA_MODEL:-}" ]; then
  printf '%s' "$NANO_BANANA_MODEL" | npx wrangler secret put NANO_BANANA_MODEL
fi

echo "Running deployment dry-run..."
npx wrangler deploy --dry-run

echo "Deploying lumens-ad-factory..."
npx wrangler deploy

echo "Ad Factory Worker deployment complete."
