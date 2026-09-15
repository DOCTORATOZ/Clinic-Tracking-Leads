#!/usr/bin/env bash
set -euo pipefail

# Applies schema + development seed data to the Supabase project previously
# linked with `yarn db:link`. The CLI prompts for authentication/database
# password when required; passwords are never stored in this repository.

yarn db:push:dry
read -r -p "Apply pending migrations and development seed data? [y/N] " CONFIRMATION
if [[ "$CONFIRMATION" != "y" && "$CONFIRMATION" != "Y" ]]; then
  echo "Cancelled before making database changes."
  exit 0
fi
yarn db:push:dev
