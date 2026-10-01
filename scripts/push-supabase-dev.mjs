import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { migrationArguments } from './dev-migration-target.mjs';

try {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const args = migrationArguments({
    expectedRef: process.env.SUPABASE_DEV_PROJECT_REF,
    linkedRef: readFileSync(new URL('../supabase/.temp/project-ref', import.meta.url), 'utf8').trim(),
    mode: process.argv[2] ?? 'dry-run',
    confirmedRef: process.env.CONFIRM_SUPABASE_DEV_PROJECT_REF,
  });
  if (process.argv.length > 3) throw new Error('Additional flags are not permitted.');
  const result = spawnSync(`${root}node_modules/.bin/supabase`, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Migration refused.');
  process.exitCode = 1;
}
