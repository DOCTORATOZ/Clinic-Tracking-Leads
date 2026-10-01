#!/usr/bin/env bash
set -euo pipefail
# A NEW database in the isolated test container; never accesses Care D.
source "$(dirname "${BASH_SOURCE[0]}")/contract-local.sh"
CONTRACT_DB="${CONTRACT_DB:-clinic_contract_test_$(date +%Y%m%d%H%M%S)_$RANDOM}"
if [[ ! "$CONTRACT_DB" =~ ^clinic_contract_test_[a-z0-9_]+$ ]]; then
  echo 'Use a fresh clinic_contract_test_* database name.' >&2
  exit 1
fi
contract_start
docker exec "$CONTRACT_CONTAINER" createdb -U postgres "$CONTRACT_DB"
docker exec -i "$CONTRACT_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$CONTRACT_DB" <<'SQL'
create schema auth;
create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
SQL
for migration in supabase/migrations/*.sql; do
  echo "Rehearsing $migration"
  docker exec -i "$CONTRACT_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$CONTRACT_DB" < "$migration"
done
docker exec -i "$CONTRACT_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$CONTRACT_DB" < tests/database/intake-contract.sql
echo "Contract database retained for inspection: $CONTRACT_DB (contains synthetic tests only)."
