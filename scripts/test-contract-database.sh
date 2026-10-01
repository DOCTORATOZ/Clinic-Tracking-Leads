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
  if [[ "${CONTRACT_UPGRADE_REHEARSAL:-0}" == 1 && "$migration" == supabase/migrations/0010_* ]]; then
    # Exercise upgrade of an existing 0010 clinic, not just an empty schema.
    docker exec -i "$CONTRACT_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$CONTRACT_DB" < supabase/seed.sql
    docker exec -i "$CONTRACT_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$CONTRACT_DB" <<'SQL'
create schema rehearsal;
create table rehearsal.cases as select id, patient_id, case_number from public.cases;
create table rehearsal.tasks as select id, case_id, due_at, status from public.follow_up_tasks;
create table rehearsal.appointments as select id, case_id, starts_at, ends_at, status from public.appointments;
SQL
  fi
done
if [[ "${CONTRACT_UPGRADE_REHEARSAL:-0}" == 1 ]]; then
  docker exec -i "$CONTRACT_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$CONTRACT_DB" <<'SQL'
do $$ begin
  if exists(select * from rehearsal.cases except select id,patient_id,case_number from public.cases)
    or exists(select * from rehearsal.tasks except select id,case_id,due_at,status from public.follow_up_tasks)
    or exists(select * from rehearsal.appointments except select id,case_id,starts_at,ends_at,status from public.appointments)
    then raise exception 'Upgrade changed existing identities, schedules or status'; end if;
  if exists(select 1 from public.case_plan_cycles) then raise exception 'Upgrade must not invent plan anchors'; end if;
end $$;
select 'PASS: 0010 fixture identities, schedules and states preserved through upgrade; no inferred anchors' as result;
SQL
fi
docker exec -i "$CONTRACT_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$CONTRACT_DB" < tests/database/intake-contract.sql
echo "Contract database retained for inspection: $CONTRACT_DB (contains synthetic tests only)."
