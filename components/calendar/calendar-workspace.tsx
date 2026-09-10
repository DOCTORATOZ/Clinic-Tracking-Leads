'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { calendarItemSyncState } from '@/modules/calendar/calendar-service';
import {
  mockCalendarItems,
  mockGoogleCalendarConnection,
} from '@/modules/calendar/mock-repository';
import { seedLeadCases } from '@/modules/leads/mock-repository';
import type { LeadCase } from '@/modules/leads/types';

export function CalendarWorkspace({
  choose,
}: {
  choose: (lead: LeadCase) => void;
}) {
  const connected = mockGoogleCalendarConnection.status === 'connected';
  const [mode, setMode] = useState<'month' | 'week' | 'day'>('month');
  const [selectedDay, setSelectedDay] = useState(11);
  const days = Array.from({ length: 30 }, (_, index) => index + 1);
  const eventsForDay = selectedDay === 11 ? mockCalendarItems : [];
  return (
    <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="rounded-2xl border border-[#dce6e0] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e8eeea] pb-4">
          <div>
            <h2 className="font-semibold">กันยายน 2026</h2>
            <p className="mt-1 text-xs text-[#71847b]">
              นัดหมายและงานติดตามในปฏิทินคลินิก
            </p>
          </div>
          <div className="flex rounded-lg bg-[#edf3ef] p-1 text-xs font-semibold">
            {(['month', 'week', 'day'] as const).map((value) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={`rounded-md px-2.5 py-1.5 ${mode === value ? 'bg-white text-[#17695d] shadow-sm' : 'text-[#71847b]'}`}
              >
                {value === 'month' ? 'เดือน' : value === 'week' ? 'สัปดาห์' : 'วัน'}
              </button>
            ))}
          </div>
        </div>
        {mode === 'month' && (
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-7 border-l border-t border-[#e1ebe5]">
                {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((day) => (
                  <div
                    key={day}
                    className="border-b border-r border-[#e1ebe5] bg-[#f6faf8] px-2 py-2 text-center text-xs font-semibold text-[#71847b]"
                  >
                    {day}
                  </div>
                ))}
                {Array.from({ length: 2 }).map((_, index) => (
                  <div
                    key={`blank-${index}`}
                    className="h-24 border-b border-r border-[#e1ebe5] bg-[#fbfcfb]"
                  />
                ))}
                {days.map((day) => (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`h-24 border-b border-r border-[#e1ebe5] p-2 text-left hover:bg-[#f5faf7] ${selectedDay === day ? 'bg-[#eff8f4]' : ''}`}
                  >
                    <span
                      className={`grid size-6 place-items-center rounded-full text-xs font-semibold ${day === 11 ? 'bg-[#197365] text-white' : 'text-[#52665e]'}`}
                    >
                      {day}
                    </span>
                    {day === 11 && (
                      <div className="mt-2 space-y-1">
                        <span className="block truncate rounded bg-[#dcefe8] px-1.5 py-0.5 text-[10px] font-semibold text-[#17695d]">
                          11:00 ติดตาม
                        </span>
                        <span className="block truncate rounded bg-[#e5edf9] px-1.5 py-0.5 text-[10px] font-semibold text-[#38639a]">
                          16:30 นัดหมาย
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {mode !== 'month' && (
          <div className="mt-4 rounded-xl border border-dashed border-[#cfe0d7] bg-[#f8fbf9] p-8 text-center text-sm text-[#71847b]">
            {mode === 'week' ? 'สัปดาห์ 6–12 ก.ย. 2026' : '11 ก.ย. 2026'} ·
            เลือกวันที่จากมุมมองเดือนเพื่อดูรายการ
          </div>
        )}
        <div className="mt-5 border-t border-[#e8eeea] pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              รายการวันที่ {selectedDay} ก.ย.
            </h3>
            <span className="rounded-full bg-[#e5f3ef] px-2 py-1 text-[11px] font-semibold text-[#17695d]">
              {connected ? 'Google Calendar เชื่อมต่อแล้ว' : 'ยังไม่เชื่อมต่อ'}
            </span>
          </div>
          <div className="mt-3 space-y-3">
            {eventsForDay.length ? (
              eventsForDay.map((item) => {
                const state = calendarItemSyncState(item, connected);
                const lead =
                  seedLeadCases.find(
                    (candidate) => candidate.id === item.linkedLeadId,
                  ) ?? seedLeadCases[0];
                return (
                  <button
                    key={item.id}
                    onClick={() => choose(lead)}
                    className="flex w-full items-center gap-4 rounded-xl border border-[#e0e9e4] p-3 text-left hover:bg-[#f7fbf9]"
                  >
                    <b className="w-12 text-[#197365]">{item.startsAt}</b>
                    <span
                      className={`size-2 rounded-full ${item.type === 'appointment' ? 'bg-[#197365]' : 'bg-[#c8872d]'}`}
                    />
                    <span className="min-w-0 flex-1">
                      <b className="block text-sm">{item.title}</b>
                      <span className="text-xs text-[#71847b]">
                        {item.type === 'appointment'
                          ? 'นัดหมาย'
                          : 'Follow-up task'}{' '}
                        · {item.owner}
                      </span>
                    </span>
                    <span
                      className={`text-xs font-semibold ${state === 'synced' ? 'text-[#197365]' : 'text-[#9a641b]'}`}
                    >
                      {state === 'synced' ? 'Synced to Google' : 'รอ sync'}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="rounded-lg bg-[#f8fbf9] p-4 text-sm text-[#71847b]">
                ไม่มีงานที่กำหนดในวันนี้
              </p>
            )}
          </div>
        </div>
      </section>
      <aside className="rounded-2xl border border-[#dce6e0] bg-white p-5">
        <CalendarDays className="text-[#197365]" />
        <h3 className="mt-3 font-semibold">Google Calendar sync</h3>
        <p className="mt-2 text-sm text-[#687b73]">
          {mockGoogleCalendarConnection.selectedCalendarName}
        </p>
        <p className="mt-1 text-xs text-[#71847b]">
          ล่าสุด: {mockGoogleCalendarConnection.lastSyncedAt}
        </p>
        <div className="mt-3 rounded-lg bg-[#eaf6f1] p-3 text-xs text-[#246656]">
          <b>Auto-sync เปิดอยู่</b>
          <br />
          ระบบส่งงานเข้า background queue ทุกครั้งที่มีการสร้าง แก้ไข หรือยกเลิก
        </div>
        <div className="mt-4 rounded-lg bg-[#f5faf7] p-3 text-xs text-[#52665e]">
          <b>Clinic เป็น source of truth</b>
          <br />
          worker จะ update Google event เดิมแบบ idempotent และ retry ได้โดยไม่ซ้ำ;
          การแก้จาก Google เข้าสู่ Needs review
        </div>
      </aside>
    </div>
  );
}
