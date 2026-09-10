import type { CalendarItem, CalendarSyncState } from './types';

/**
 * Domain-facing calendar adapter contract. A future Google adapter must call
 * this service rather than update appointments or tasks directly.
 */
export function calendarItemSyncState(
  item: CalendarItem,
  connected: boolean,
): CalendarSyncState {
  if (!connected) return 'not_connected';
  return item.syncState;
}

export function isSyncEligible(item: CalendarItem) {
  return item.type === 'appointment' || item.type === 'follow_up_task';
}
