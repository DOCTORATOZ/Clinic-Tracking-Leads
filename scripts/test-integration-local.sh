#!/usr/bin/env bash
set -euo pipefail

# Recreate Auth as well as Postgres. `db reset` alone does not reload auth
# provider configuration from config.toml.
supabase stop --no-backup >/dev/null 2>&1 || true
supabase start >/dev/null
supabase db reset --local
STATUS_ENV="$(supabase status -o env)" || { echo "Unable to read local Supabase status." >&2; exit 1; }
eval "$STATUS_ENV"
: "${API_URL:?Local Supabase did not return API_URL}"
: "${ANON_KEY:?Local Supabase did not return ANON_KEY}"
: "${SERVICE_ROLE_KEY:?Local Supabase did not return SERVICE_ROLE_KEY}"
export SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
node scripts/provision-integration-users.mjs
yarn playwright test --config=playwright.integration.config.ts
