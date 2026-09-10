import type { CalendarItem } from './types';

export type CalendarSyncCommand = {
  clinicId: string;
  calendarItem: CalendarItem;
  idempotencyKey: string;
  existingGoogleEventId?: string;
};

export type CalendarSyncResult = {
  googleEventId: string;
  etag?: string;
  operation: 'created' | 'updated' | 'cancelled';
};

/** Implement with Google OAuth/server-only credentials in the production adapter. */
export interface GoogleCalendarAdapter {
  upsert(command: CalendarSyncCommand): Promise<CalendarSyncResult>;
  cancel(command: CalendarSyncCommand): Promise<CalendarSyncResult>;
}

/**
 * Enqueued after the clinic transaction commits. Production uses Supabase
 * Queues/Cron so calendar delivery never depends on an open browser session.
 */
export type CalendarSyncJob = CalendarSyncCommand & {
  operation: 'upsert' | 'cancel';
  attempt: number;
};
