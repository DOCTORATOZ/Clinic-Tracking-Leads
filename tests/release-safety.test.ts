import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { processCalendarOutbox } from '../modules/calendar/worker';
import { migrationArguments } from '../scripts/dev-migration-target.mjs';

afterEach(() => vi.unstubAllEnvs());

describe('development migration safety', () => {
  const expectedRef = 'abcdefghijklmnopqrst';
  const base = { expectedRef, linkedRef: expectedRef, mode: 'dry-run' };
  it('defaults to a dry migration without seeds or vault changes', () => {
    expect(migrationArguments(base)).toEqual(['db', 'push', '--linked', '--skip-vault', '--dry-run']);
  });
  it('rejects missing approval and different linked targets', () => {
    expect(() => migrationArguments({ ...base, expectedRef: undefined })).toThrow();
    expect(() => migrationArguments({ ...base, linkedRef: 'zyxwvutsrqponmlkjihg' })).toThrow();
    expect(() => migrationArguments({ ...base, expectedRef: '127.0.0.1' })).toThrow();
  });
  it('requires explicit confirmation before apply and rejects extra modes', () => {
    expect(() => migrationArguments({ ...base, mode: 'apply' })).toThrow();
    expect(() => migrationArguments({ ...base, mode: '--include-seed' })).toThrow();
    expect(migrationArguments({ ...base, mode: 'apply', confirmedRef: expectedRef }))
      .toEqual(['db', 'push', '--linked', '--skip-vault']);
  });
});

describe('deferred calendar sync', () => {
  const client = createClient('http://127.0.0.1:55321', 'unit-test-key', { auth: { persistSession: false } });
  const adapter = { upsert: vi.fn(), cancel: vi.fn() };
  it('does not touch the database or Google when disabled', async () => {
    vi.stubEnv('CALENDAR_SYNC_ENABLED', 'false');
    const query = vi.spyOn(client, 'from');
    expect(await processCalendarOutbox(client, adapter)).toEqual({ processed: 0, disabled: true });
    expect(query).not.toHaveBeenCalled();
    query.mockRestore();
  });
  it('fails closed if live sync is accidentally enabled', async () => {
    vi.stubEnv('CALENDAR_SYNC_ENABLED', 'true');
    await expect(processCalendarOutbox(client, adapter)).rejects.toThrow('CALENDAR_SYNC_NOT_IMPLEMENTED');
    expect(adapter.upsert).not.toHaveBeenCalled();
    expect(adapter.cancel).not.toHaveBeenCalled();
  });
});
