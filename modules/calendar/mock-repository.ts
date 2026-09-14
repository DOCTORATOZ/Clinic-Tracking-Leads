import type { CalendarItem, GoogleCalendarConnection } from './types';

export const mockGoogleCalendarConnection: GoogleCalendarConnection = {
  provider: 'google_calendar',
  selectedCalendarName: 'Care D Clinic Operations',
  status: 'connected',
  syncMode: 'automatic',
  lastSyncedAt: '11 ก.ย. 2026 09:55',
};

export const mockCalendarItems: CalendarItem[] = [
  {
    id: 'task-24091',
    type: 'follow_up_task',
    title: 'ติดตามแผล นลินี ศรีสุข · Day 3',
    startsAt: '11:00',
    owner: 'พยาบาลวิภา',
    linkedLeadId: 'CD-24091',
    syncState: 'synced',
  },
  {
    id: 'appointment-24093',
    type: 'appointment',
    title: 'ธนวัฒน์ วงศ์ดี · ประเมินเส้นฟอกไต',
    startsAt: '16:30',
    endsAt: '17:00',
    owner: 'พยาบาลณิชา',
    linkedLeadId: 'CD-24093',
    syncState: 'synced',
  },
  {
    id: 'task-24094',
    type: 'follow_up_task',
    title: 'โทรกลับ อรพรรณ พูลผล',
    startsAt: '17:00',
    owner: 'พยาบาลวิภา',
    linkedLeadId: 'CD-24094',
    syncState: 'pending',
  },
];
