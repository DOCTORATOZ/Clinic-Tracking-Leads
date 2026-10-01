import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { assertContractTarget } from './contract-safety.mjs';

// Read status as data, never eval shell output or print credentials.
const status = JSON.parse(readFileSync(0, 'utf8'));
assertContractTarget(status.API_URL);
if (!status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw new Error('Missing local test credentials.');
const env = {
  ...process.env,
  SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
};
for (const [command, args] of [
  [process.execPath, ['scripts/provision-integration-users.mjs']],
  ['yarn', ['playwright', 'test', '--config=playwright.contract.config.ts']],
]) {
  const result = spawnSync(command, args, { env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
