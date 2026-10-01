#!/usr/bin/env bash
set -euo pipefail

echo 'This legacy runner resets the Care D local database and is retired. Use yarn test:integration for the isolated project.' >&2
exit 1

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

# `supabase start` can return while Kong/Auth are still warming up.  Do not
# provision identities or launch Playwright until the endpoint used by login is
# reachable; otherwise the suite fails nondeterministically with "Failed to fetch".
for attempt in {1..45}; do
  if curl --fail --silent --show-error "$API_URL/auth/v1/health" >/dev/null; then
    break
  fi
  if [ "$attempt" -eq 45 ]; then
    echo "Supabase Auth did not become ready at $API_URL." >&2
    exit 1
  fi
  sleep 2
done
node scripts/provision-integration-users.mjs
yarn playwright test --config=playwright.integration.config.ts
# Restore the clean, representative One Day Surgery catalog after API tests
# deliberately add temporary sources and plan versions.
node scripts/provision-integration-users.mjs
