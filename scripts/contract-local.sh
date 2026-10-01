#!/usr/bin/env bash
# Shared by both test runners. No reset, stop, drop or linked-project commands.
CONTRACT_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly CONTRACT_CONTAINER='supabase_db_clinic_contract_workflow'

contract_start() {
  cd "$CONTRACT_REPO_ROOT"
  # Do not allow an accidental config edit to point this runner at Care D.
  node --input-type=module -e '
    import { readFileSync } from "node:fs";
    const config = readFileSync("supabase-test/config.toml", "utf8");
    if (!/^project_id = "clinic_contract_workflow"$/m.test(config)) {
      throw new Error("Unexpected contract project id; refusing to start.");
    }
  '
  CONTRACT_WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/clinic-contract.XXXXXX")"
  mkdir "$CONTRACT_WORKDIR/supabase"
  cp supabase-test/config.toml "$CONTRACT_WORKDIR/supabase/config.toml"
  cp -R supabase/migrations "$CONTRACT_WORKDIR/supabase/migrations"
  echo "Isolated Supabase test workspace: $CONTRACT_WORKDIR"
  ./node_modules/.bin/supabase start --workdir "$CONTRACT_WORKDIR" >/dev/null
}
