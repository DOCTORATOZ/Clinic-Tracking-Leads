import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { assertContractTarget } from './contract-safety.mjs';

const status = JSON.parse(readFileSync(0, 'utf8'));
assertContractTarget(status.API_URL);
if (!status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw new Error('Missing isolated local credentials.');
const env = {
  ...process.env,
  NEXT_DIST_DIR: '.next-sandbox',
  SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  CALENDAR_SYNC_ENABLED: 'false',
};
const provision = spawnSync(process.execPath, ['scripts/provision-integration-users.mjs'], {env, stdio: 'inherit'});
if (provision.error) throw provision.error;
if (provision.status !== 0) process.exit(provision.status ?? 1);
console.log('Frontend sandbox: http://127.0.0.1:3102/login — synthetic data only; Care D on 3001 is unchanged.');
console.log('This shares the isolated integration dataset. Avoid running integration tests during manual testing.');
const server = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3102'], {env, stdio: 'inherit'});
if (server.error) throw server.error;
process.exit(server.status ?? 1);
