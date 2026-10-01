#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/contract-local.sh"
# Keep the normal developer server and its Care D database untouched.
contract_start
./node_modules/.bin/supabase migration up --local --workdir "$CONTRACT_WORKDIR" >/dev/null
./node_modules/.bin/supabase status --workdir "$CONTRACT_WORKDIR" -o json | node scripts/run-sandbox.mjs
