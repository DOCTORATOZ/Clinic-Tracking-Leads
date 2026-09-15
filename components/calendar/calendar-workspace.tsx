'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type {
  CalendarConnectionSummary,
  CalendarReadItem,
} from '@/modules/calendar/service';

const monthNames = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];
const weekDays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const dateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const bangkokTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const bangkokDate = (timestamp: string) =>
  new Date(new Date(timestamp).getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

type CalendarDisplayItem = CalendarReadItem & {
  date: string;
  time: string;
};

type CalendarResponse = {
  items: CalendarReadItem[];
  connection: CalendarConnectionSummary;
};

export function CalendarWorkspace({
  onOpenCase,
}: {
  onOpenCase?: (caseId: string) => void;
}) {
  const [mode, setMode] = useState<'month' | 'week' | 'day'>('month');
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const [items, setItems] = useState<CalendarReadItem[]>([]);
  const [connection, setConnection] = useState<CalendarConnectionSummary>({
    status: 'disabled',
    destinationCalendarId: null,
  });
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    const start = new Date(Date.UTC(visibleMonth.year, visibleMonth.month, 1, -7));
    const end = new Date(Date.UTC(visibleMonth.year, visibleMonth.month + 1, 1, -7));

    fetch(`/api/calendar?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'ไม่สามารถโหลดปฏิทินได้');
        return body as CalendarResponse;
      })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setConnection(data.connection);
        setLoadError(undefined);
        setSelectedItemId((current) =>
          current && data.items.some((item) => item.id === current)
            ? current
            : data.items[0]?.id,
        );
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'ไม่สามารถโหลดปฏิทินได้');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [visibleMonth.year, visibleMonth.month]);

  const calendarItems = useMemo<CalendarDisplayItem[]>(
    () =>
      items.map((item) => ({
        ...item,
        date: bangkokDate(item.startsAt),
        time: bangkokTime.format(new Date(item.startsAt)),
      })),
    [items],
  );
  const connected = connection.status !== 'disabled' && connection.status !== 'failed';

  const daysInMonth = new Date(
    visibleMonth.year,
    visibleMonth.month + 1,
    0,
  ).getDate();
  const firstDayOffset = new Date(
    visibleMonth.year,
    visibleMonth.month,
    1,
  ).getDay();
  const [selectedYear, selectedMonth, selectedDay] = selectedDate
    .split('-')
    .map(Number);
  const eventsForDay = calendarItems
    .filter((item) => item.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));
  const selectedItem =
    eventsForDay.find((item) => item.id === selectedItemId) ?? eventsForDay[0];
  const eventLabel = (item: CalendarDisplayItem) =>
    item.entityType === 'appointment' ? 'นัดหมาย' : 'งานติดตาม';
  const showDate = (year: number, month: number, day: number) => {
    const nextDate = dateKey(year, month, day);
    setSelectedDate(nextDate);
    setSelectedItemId(
      calendarItems.find((item) => item.date === nextDate)?.id,
    );
  };
  const moveMonth = (offset: number) => {
    const next = new Date(visibleMonth.year, visibleMonth.month + offset, 1);
    setVisibleMonth({ year: next.getFullYear(), month: next.getMonth() });
    showDate(next.getFullYear(), next.getMonth(), 1);
  };

  return (
    <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="rounded-2xl border border-[#dce6e0] bg-white p-5">
        {loadError && (
          <p role="alert" className="mb-3 rounded-lg bg-[#fff4e5] p-3 text-sm text-[#9a641b]">
            {loadError}
          </p>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e8eeea] pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => moveMonth(-1)}
              className="rounded-lg p-1.5 text-[#52665e] hover:bg-[#edf3ef]"
              aria-label="เดือนก่อนหน้า"
            >
              <ChevronLeft size={18} />
            </button>
            <div>
              <h2 className="font-semibold">
                {monthNames[visibleMonth.month]} {visibleMonth.year}
              </h2>
              <p className="mt-1 text-xs text-[#71847b]">
                นัดหมายและงานติดตามในปฏิทินคลินิก
              </p>
            </div>
            <button
              onClick={() => moveMonth(1)}
              className="rounded-lg p-1.5 text-[#52665e] hover:bg-[#edf3ef]"
              aria-label="เดือนถัดไป"
            >
              <ChevronRight size={18} />
            </button>
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
        {mode === 'month' ? (
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-7 border-l border-t border-[#e1ebe5]">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="border-b border-r border-[#e1ebe5] bg-[#f6faf8] px-2 py-2 text-center text-xs font-semibold text-[#71847b]"
                  >
                    {day}
                  </div>
                ))}
                {Array.from({ length: firstDayOffset }).map((_, index) => (
                  <div
                    key={`blank-${index}`}
                    className="h-24 border-b border-r border-[#e1ebe5] bg-[#fbfcfb]"
                  />
                ))}
                {Array.from(
                  { length: daysInMonth },
                  (_, index) => index + 1,
                ).map((day) => {
                  const currentDate = dateKey(
                    visibleMonth.year,
                    visibleMonth.month,
                    day,
                  );
                  const dayEvents = calendarItems
                    .filter((item) => item.date === currentDate)
                    .sort((a, b) => a.time.localeCompare(b.time));
                  const isSelected = selectedDate === currentDate;
                  return (
                    <button
                      key={day}
                      onClick={() =>
                        showDate(visibleMonth.year, visibleMonth.month, day)
                      }
                      className={`h-24 border-b border-r border-[#e1ebe5] p-2 text-left hover:bg-[#f5faf7] ${isSelected ? 'bg-[#eff8f4]' : ''}`}
                    >
                      <span
                        className={`grid size-6 place-items-center rounded-full text-xs font-semibold ${isSelected ? 'bg-[#197365] text-white' : 'text-[#52665e]'}`}
                      >
                        {day}
                      </span>
                      <div className="mt-2 space-y-1">
                        {dayEvents.slice(0, 2).map((item) => (
                          <span
                            key={item.id}
                            className={`block truncate rounded px-1.5 py-0.5 text-[10px] font-semibold ${item.entityType === 'appointment' ? 'bg-[#e5edf9] text-[#38639a]' : 'bg-[#dcefe8] text-[#17695d]'}`}
                          >
                            {item.time} {eventLabel(item)}
                          </span>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="block text-[10px] font-medium text-[#71847b]">
                            +{dayEvents.length - 2} งาน
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-[#cfe0d7] bg-[#f8fbf9] p-8 text-center text-sm text-[#71847b]">
            {mode === 'week'
              ? 'เลือกวันที่เพื่อดูรายการงานในสัปดาห์'
              : 'เลือกวันที่เพื่อดูรายการงาน'}
          </div>
        )}
      </section>
      <aside className="h-fit rounded-2xl border border-[#dce6e0] bg-white p-5 lg:sticky lg:top-24">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.1em] text-[#71847b]">
              รายละเอียดงาน
            </p>
            <h3 className="mt-1 font-semibold">
              {selectedDay} {monthNames[selectedMonth - 1]} {selectedYear}
            </h3>
          </div>
          <CalendarDays className="text-[#197365]" />
        </div>
        {eventsForDay.length && selectedItem ? (
          <>
            <div className="mt-4 space-y-2 border-y border-[#e8eeea] py-4">
              {eventsForDay.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg p-2.5 text-left ${selectedItem.id === item.id ? 'bg-[#eaf6f1]' : 'hover:bg-[#f7fbf9]'}`}
                >
                  <b className="w-11 text-sm text-[#197365]">{item.time}</b>
                  <span
                    className={`size-2 shrink-0 rounded-full ${item.entityType === 'appointment' ? 'bg-[#197365]' : 'bg-[#c8872d]'}`}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {item.title}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <span
                  className={`size-2 rounded-full ${selectedItem.entityType === 'appointment' ? 'bg-[#197365]' : 'bg-[#c8872d]'}`}
                />
                <span className="text-xs font-semibold text-[#52665e]">
                  {eventLabel(selectedItem)}
                </span>
              </div>
              <h4 className="mt-2 text-sm font-semibold leading-6">
                {selectedItem.title}
              </h4>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-[#71847b]">เวลา</dt>
                  <dd className="font-medium">
                    {selectedItem.time} น.
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#71847b]">Google Calendar</dt>
                  <dd
                    className={`font-medium ${selectedItem.syncStatus === 'synced' ? 'text-[#197365]' : 'text-[#9a641b]'}`}
                  >
                    {selectedItem.syncStatus === 'synced'
                      ? 'Synced แล้ว'
                      : connected ? 'รอ sync' : 'ยังไม่เชื่อมต่อ'}
                  </dd>
                </div>
              </dl>
              {onOpenCase && (
                <button
                  onClick={() => onOpenCase(selectedItem.caseId)}
                  className="mt-5 w-full rounded-lg bg-[#197365] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#145d52]"
                >
                  ดูรายละเอียดเคส
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="mt-5 rounded-lg bg-[#f8fbf9] p-4 text-sm text-[#71847b]">
            ไม่มีงานที่กำหนดในวันนี้
          </p>
        )}
        <div className="mt-5 border-t border-[#e8eeea] pt-4">
          <p className="text-xs font-semibold text-[#52665e]">
            Google Calendar sync
          </p>
          <p className="mt-1 text-xs text-[#71847b]">
            {connection.destinationCalendarId ?? 'ยังไม่ได้เชื่อมต่อ'} ·{' '}
            {connected ? 'พร้อมซิงก์' : 'ยังไม่เชื่อมต่อ'}
          </p>
        </div>
      </aside>
    </div>
  );
}
