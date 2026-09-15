#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env ]]; then
  echo "Missing .env. Set NEXT_PUBLIC_SUPABASE_URL first."
  exit 1
fi

PROJECT_REF="$(node -e '
const fs = require("fs");
const line = fs.readFileSync(".env", "utf8").split(/\r?\n/).find((item) => item.startsWith("NEXT_PUBLIC_SUPABASE_URL="));
if (!line) process.exit(1);
console.log(new URL(line.slice(line.indexOf("=") + 1).trim()).hostname.split(".")[0]);
')"

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  read -r -s -p "Supabase database password: " SUPABASE_DB_PASSWORD
  echo
fi

yarn supabase link --project-ref "$PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"
unset SUPABASE_DB_PASSWORD
