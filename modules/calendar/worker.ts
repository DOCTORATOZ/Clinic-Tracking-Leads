import type { SupabaseClient } from '@supabase/supabase-js';
import type { GoogleCalendarAdapter } from './google-calendar-adapter';

/** Live sync is outside this release. Never consume jobs with placeholder event data. */
export async function processCalendarOutbox(_client: SupabaseClient, _adapter: GoogleCalendarAdapter) {
  if (process.env.CALENDAR_SYNC_ENABLED === 'true') {
    throw new Error('CALENDAR_SYNC_NOT_IMPLEMENTED');
  }
  return { processed: 0, disabled: true };
}
