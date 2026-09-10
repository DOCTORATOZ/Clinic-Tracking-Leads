export type CalendarItemType =
  | 'appointment'
  | 'follow_up_task'
  | 'external_calendar';
export type CalendarSyncState =
  | 'not_connected'
  | 'pending'
  | 'synced'
  | 'needs_review'
  | 'failed';

export type CalendarItem = {
  id: string;
  type: CalendarItemType;
  title: string;
  startsAt: string;
  endsAt?: string;
  owner: string;
  linkedLeadId: string;
  syncState: CalendarSyncState;
};

export type GoogleCalendarConnection = {
  provider: 'google_calendar';
  selectedCalendarName: string;
  status: 'connected' | 'not_connected';
  syncMode: 'automatic' | 'manual';
  lastSyncedAt?: string;
};
