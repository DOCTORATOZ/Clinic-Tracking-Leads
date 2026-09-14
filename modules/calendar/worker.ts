import type { SupabaseClient } from '@supabase/supabase-js';
import type { GoogleCalendarAdapter } from './google-calendar-adapter';

/** Called by Vercel Cron/Supabase queue. It has no UI dependency and retries safely. */
export async function processCalendarOutbox(client: SupabaseClient, adapter: GoogleCalendarAdapter) {
  if (process.env.CALENDAR_SYNC_ENABLED !== 'true') return { processed: 0, disabled: true };
  const { data: jobs, error } = await client.from('calendar_sync_outbox').select('*').eq('status', 'pending').lte('available_at', new Date().toISOString()).order('created_at').limit(25);
  if (error) throw error;
  for (const job of jobs ?? []) {
    try {
      await client.from('calendar_sync_outbox').update({ status: 'processing', attempts: job.attempts + 1 }).eq('id', job.id).eq('status', 'pending');
      const command = { clinicId: job.clinic_id, calendarItem: { id: job.entity_id, title: '', startsAt: '', kind: job.entity_type } as any, idempotencyKey: job.idempotency_key };
      const result = job.operation === 'cancel' ? await adapter.cancel(command) : await adapter.upsert(command);
      await client.from('calendar_sync_outbox').update({ status: 'succeeded', last_error: null }).eq('id', job.id);
      await client.from('calendar_sync_logs').insert({ clinic_id: job.clinic_id, outbox_id: job.id, direction: 'outbound', outcome: result.operation, detail: result });
    } catch (error) {
      const delayMinutes = Math.min(60, 2 ** Math.min(job.attempts, 6));
      await client.from('calendar_sync_outbox').update({ status: job.attempts >= 5 ? 'failed' : 'pending', available_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(), last_error: error instanceof Error ? error.message : 'Unknown sync error' }).eq('id', job.id);
    }
  }
  return { processed: jobs?.length ?? 0, disabled: false };
}
