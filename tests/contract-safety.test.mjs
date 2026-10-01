import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { assertContractTarget, insertMissingFixtures } from '../scripts/contract-safety.mjs';

test('accepts only the fixed isolated test API, not Care D or remote URLs', () => {
  assert.doesNotThrow(() => assertContractTarget('http://127.0.0.1:55321'));
  for (const url of [undefined, '', 'http://127.0.0.1:54321', 'https://example.supabase.co',
    'http://localhost:55321', 'http://127.0.0.1:55321/other',
    'http://127.0.0.1:55321@remote.example', 'http://127.0.0.1:55321?redirect=remote']) {
    assert.throws(() => assertContractTarget(url), /Refusing non-contract target/);
  }
});

test('standalone provisioning refuses an unsafe target before contacting Auth', () => {
  const result = spawnSync(process.execPath, ['scripts/provision-integration-users.mjs'], {
    encoding: 'utf8', timeout: 5000,
    env: { ...process.env, SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_SERVICE_ROLE_KEY: 'test-not-a-key' },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing non-contract target/);
  assert.doesNotMatch(result.stderr, /fetch failed/);
});

test('fixture re-runs use conflict-do-nothing, preserving changed/archived records', async () => {
  const stored = new Map([['old-plan', { id: 'old-plan', active: false, version: 2 }]]);
  const client = { from(table) {
    assert.equal(table, 'follow_up_plans');
    return { async upsert(rows, options) {
      assert.deepEqual(options, { onConflict: 'id', ignoreDuplicates: true });
      for (const row of rows) if (!stored.has(row.id)) stored.set(row.id, row);
      return { error: null };
    } };
  } };
  const rows = [{ id: 'old-plan', active: true, version: 1 }, { id: 'new-plan', active: true, version: 1 }];
  await insertMissingFixtures(client, 'follow_up_plans', rows);
  await insertMissingFixtures(client, 'follow_up_plans', rows);
  assert.equal(stored.size, 2);
  assert.deepEqual(stored.get('old-plan'), { id: 'old-plan', active: false, version: 2 });
});

test('composite fixture conflict keys are retained and database errors are not swallowed', async () => {
  const error = new Error('fixture failed');
  const client = { from() { return { async upsert(_rows, options) {
    assert.deepEqual(options, { onConflict: 'plan_id,sequence', ignoreDuplicates: true });
    return { error };
  } }; } };
  await assert.rejects(insertMissingFixtures(client, 'follow_up_plan_steps', [], 'plan_id,sequence'), error);
});
