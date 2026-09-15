'use client';
import { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Clock3,
  History,
  LayoutDashboard,
  Menu,
  Phone,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { CalendarWorkspace } from '@/components/calendar/calendar-workspace';
import { PatientDirectory } from '@/components/patients/patient-directory';
import { seedLeadCases } from '@/modules/leads/mock-repository';
import { serviceCatalog } from '@/modules/services/catalog';
import type {
  FollowUpDueState as Due,
  LeadCase as Case,
  LeadPriority as Priority,
} from '@/modules/leads/types';

type Role = 'admin' | 'manager';
type View =
  | 'queue'
  | 'patients'
  | 'cases'
  | 'appointments'
  | 'calendar'
  | 'dashboard'
  | 'settings'
  | 'audit';
const field =
  'mt-1 w-full rounded-lg border border-[#cfded7] bg-white px-3 py-2 text-sm outline-none focus:border-[#197365]';
const nav: [View, string, typeof Users, boolean?][] = [
  ['queue', 'คิวงานติดตาม', ClipboardList],
  ['patients', 'ลีด / ผู้ป่วย', Users],
  ['appointments', 'นัดหมาย', CalendarDays],
  ['calendar', 'ปฏิทินงาน', CalendarDays],
  ['dashboard', 'ภาพรวม', LayoutDashboard],
  ['settings', 'ตั้งค่า', Settings2, true],
  ['audit', 'ประวัติการตรวจสอบ', ShieldCheck, true],
];

export default function Home() {
  const [role, setRole] = useState<Role>('admin'),
    [view, setView] = useState<View>('queue'),
    [items, setItems] = useState(seedLeadCases),
    [selected, setSelected] = useState(seedLeadCases[0]),
    [filter, setFilter] = useState<'all' | Due>('all'),
    [query, setQuery] = useState(''),
    [drawer, setDrawer] = useState(false),
    [modal, setModal] = useState<
      'new' | 'result' | 'appointment' | 'reason' | null
    >(null),
    [action, setAction] = useState<'pause' | 'close' | 'reopen'>('pause'),
    [events, setEvents] = useState<string[]>([]);
  const visible = useMemo(
    () =>
      items
        .filter(
          (x) =>
            (filter === 'all' || x.dueState === filter) &&
            `${x.name} ${x.hn ?? ''} ${x.phone} ${x.id} ${x.source}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort(
          (a, b) =>
            ({ overdue: 0, today: 1, upcoming: 2 })[a.dueState] -
            { overdue: 0, today: 1, upcoming: 2 }[b.dueState],
        ),
    [items, filter, query],
  );
  const nextMockCaseNumber = useMemo(() => {
    const latest = items.reduce((highest, item) => {
      const sequence = Number(item.id.match(/(\d+)$/)?.[1] ?? 0);
      return Math.max(highest, sequence);
    }, 24090);
    return `CD-${String(latest + 1).padStart(5, '0')}`;
  }, [items]);
  const choose = (x: Case) => {
    setSelected(x);
    setView('cases');
    setDrawer(false);
  };
  const update = (change: Partial<Case>) => {
    const next = { ...selected, ...change };
    setSelected(next);
    setItems((xs) => xs.map((x) => (x.id === next.id ? next : x)));
  };
  const log = (s: string) =>
    setEvents((xs) => [`11 ก.ย. 2026 10:15 · ${s}`, ...xs]);
  return (
    <main className="min-h-screen bg-[#f4f7f5] text-[#19312c]">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#dbe5df] bg-white/95 px-4 md:px-7">
        <div className="flex items-center gap-3">
          <button className="p-2 md:hidden" onClick={() => setDrawer(true)}>
            <Menu size={20} />
          </button>
          <Image
            src="/brand/care-d-clinic-logo.png"
            alt="Care D Clinic"
            width={44}
            height={44}
            className="size-11 rounded-xl object-contain"
            priority
          />
          <div>
            <b className="block text-sm">Care D Clinic</b>
            <span className="text-[10px] text-[#6a7d75]">
              ศูนย์หลอดเลือดฟอกไต · One Day Surgery
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={role}
            onChange={(e) => {
              const r = e.target.value as Role;
              setRole(r);
              if (r === 'admin' && (view === 'settings' || view === 'audit'))
                setView('queue');
            }}
            className="rounded-lg border border-[#d6e2dc] bg-white px-2 py-1.5 text-xs font-semibold text-[#17695d]"
          >
            <option value="admin">Admin / Coordinator</option>
            <option value="manager">Manager / Owner</option>
          </select>
          <span className="grid size-8 place-items-center rounded-full bg-[#e2eeea] text-xs font-semibold text-[#197365]">
            MY
          </span>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1500px]">
        <Nav active={view} role={role} setView={setView} />
        {drawer && (
          <div className="fixed inset-0 z-50 bg-[#19312c]/20 md:hidden">
            <aside className="h-full w-72 bg-[#f8faf8] p-4 shadow-xl">
              <button
                className="float-right p-2"
                onClick={() => setDrawer(false)}
              >
                <X size={18} />
              </button>
              <Nav
                active={view}
                role={role}
                setView={(x) => {
                  setView(x);
                  setDrawer(false);
                }}
                mobile
              />
            </aside>
          </div>
        )}
        <section className="min-w-0 flex-1 p-5 lg:p-8">
          <Heading view={view} role={role} add={() => setModal('new')} />
          {view === 'queue' && (
            <Queue
              items={visible}
              filter={filter}
              setFilter={setFilter}
              query={query}
              setQuery={setQuery}
              choose={choose}
            />
          )}{' '}
          {view === 'patients' && (
            <PatientDirectory cases={items} onOpenCase={choose} />
          )}
          {view === 'cases' && (
            <Detail
              item={selected}
              role={role}
              events={events}
              result={() => setModal('result')}
              appointment={() => setModal('appointment')}
              reassign={() => {
                update({
                  nurse: selected.nurse === 'พยาบาลวิภา' ? 'พยาบาลณิชา' : 'พยาบาลวิภา',
                  status: 'Awaiting nurse call',
                });
                log('มุก มอบหมายพยาบาลใหม่');
              }}
              reason={(x) => {
                setAction(x);
                setModal('reason');
              }}
            />
          )}
          {view === 'appointments' && (
            <Appointments
              items={items.filter((x) => x.status === 'Appointment scheduled')}
              choose={choose}
            />
          )}{' '}
          {view === 'calendar' && <CalendarWorkspace choose={choose} />}{' '}
          {view === 'dashboard' && <Dashboard />}
          {view === 'settings' && role === 'manager' && <Settings />}
          {view === 'audit' && role === 'manager' && <Audit />}
        </section>
      </div>
      {modal === 'new' && (
        <NewLead
          caseNumber={nextMockCaseNumber}
          close={() => setModal(null)}
          save={(x) => {
            setItems((xs) => [x, ...xs]);
            setSelected(x);
            log(`มายด์ สร้างเคส ${x.id} จาก ${x.source}`);
            setModal(null);
            setView('cases');
          }}
        />
      )}
      {modal === 'result' && (
        <Result
          item={selected}
          close={() => setModal(null)}
          save={(a) => {
            update({
              status: a ? 'Appointment scheduled' : 'Follow-up active',
              task: a ? 'Day 1 · ยืนยันหลังหัตถการ' : 'Day 7 · โทรติดตามแผล',
              due: '18 ก.ย. 2026 10:00',
              dueState: 'upcoming',
            });
            log('มายด์ บันทึกผลแทน พยาบาลวิภา · ติดต่อทาง Phone');
            setModal(a ? 'appointment' : null);
          }}
        />
      )}
      {modal === 'appointment' && (
        <Appointment
          item={selected}
          close={() => setModal(null)}
          save={() => {
            update({ status: 'Appointment scheduled' });
            log('มายด์ สร้างนัดหมายจาก Follow-up result FR-882');
            setModal(null);
          }}
        />
      )}
      {modal === 'reason' && (
        <Reason
          action={action}
          close={() => setModal(null)}
          save={(r) => {
            if (action === 'close')
              update({ closed: true, status: 'Closed - converted' });
            if (action === 'reopen')
              update({ closed: false, status: 'Follow-up active' });
            log(
              `มายด์ ${action === 'close' ? 'ปิดเคส' : action === 'reopen' ? 'เปิดเคสอีกครั้ง' : 'พักงานติดตาม'} · เหตุผล: ${r}`,
            );
            setModal(null);
          }}
        />
      )}
    </main>
  );
}
function Nav({
  active,
  role,
  setView,
  mobile = false,
}: {
  active: View;
  role: Role;
  setView: (x: View) => void;
  mobile?: boolean;
}) {
  return (
    <aside
      className={
        mobile
          ? 'pt-12'
          : 'sticky top-16 hidden h-[calc(100vh-64px)] w-60 shrink-0 border-r border-[#dbe5df] bg-[#f8faf8] p-4 md:block'
      }
    >
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[.12em] text-[#789087]">
        พื้นที่ทำงาน
      </p>
      {nav
        .filter((x) => !x[3] || role === 'manager')
        .map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${active === id ? 'bg-[#e5f3ef] font-semibold text-[#17695d]' : 'text-[#52665e] hover:bg-[#edf2ef]'}`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      <div className="mx-3 mt-12 rounded-xl border border-[#d9e6df] bg-white p-3 text-xs leading-relaxed text-[#688078]">
        <b className="text-[#197365]">Phase 1 · Manual-first</b>
        <br />
        ไม่มี live integration, messaging หรือ auto-merge
      </div>
    </aside>
  );
}
function Heading({
  view,
  role,
  add,
}: {
  view: View;
  role: Role;
  add: () => void;
}) {
  const t: Record<View, [string, string]> = {
    queue: ['คิวงานประสานการดูแล', 'งานเกินกำหนด วันนี้ และงานที่กำลังจะมาถึง'],
    patients: ['ลีด / ผู้ป่วย', 'ค้นหาผู้ป่วยก่อน แล้วเปิดหรือสร้างเคสที่เกี่ยวข้อง'],
    cases: ['รายละเอียดเคส', 'ข้อมูลผู้ป่วย ประวัติการติดตาม และการดำเนินการ'],
    appointments: ['นัดหมาย', 'ประเมินและหัตถการแยกสถานะออกจากเคส'],
    calendar: ['ปฏิทินงาน', 'นัดหมายและงานติดตามในมุมมองเดียวกัน'],
    dashboard: ['ภาพรวมการประสานการดูแล', 'ข้อมูลสรุปไม่แสดงข้อมูลอ่อนไหว'],
    settings: ['ตั้งค่า Phase 1', 'ตั้งค่าเฉพาะงานในอนาคต'],
    audit: ['ประวัติการตรวจสอบ', 'กิจกรรมสำคัญและ privileged corrections'],
  };
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-[#197365]">
          {role === 'manager' ? 'Manager view' : 'Admin workspace'}
        </p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
          {t[view][0]}
        </h1>
        <p className="mt-1 text-sm text-[#61746c]">{t[view][1]}</p>
      </div>
      {(view === 'queue' || view === 'patients' || view === 'cases') && (
        <button
          onClick={add}
          className="flex items-center gap-2 rounded-xl bg-[#197365] px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus size={17} />
          เพิ่มลีด
        </button>
      )}
    </div>
  );
}
function Queue({
  items,
  filter,
  setFilter,
  query,
  setQuery,
  choose,
}: {
  items: Case[];
  filter: 'all' | Due;
  setFilter: (x: 'all' | Due) => void;
  query: string;
  setQuery: (x: string) => void;
  choose: (x: Case) => void;
}) {
  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Metric label="งานเกินกำหนด" value="3" alert />
        <Metric label="ต้องติดต่อวันนี้" value="12" />
        <Metric label="ผลติดต่อสำเร็จ" value="21" />
        <Metric label="นัดหมายวันนี้" value="7" />
      </div>
      <div className="mt-7 rounded-2xl border border-[#dce6e0] bg-white p-4">
        <div className="flex flex-wrap justify-between gap-3">
          <div className="flex rounded-xl bg-[#eaf0ed] p-1 text-xs font-medium">
            {(
              [
                ['all', 'ทั้งหมด'],
                ['overdue', 'เกินกำหนด'],
                ['today', 'วันนี้'],
                ['upcoming', 'ถัดไป'],
              ] as const
            ).map(([id, l]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`rounded-lg px-3 py-1.5 ${filter === id ? 'bg-white text-[#17695d] shadow-sm' : 'text-[#6a7d75]'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <label className="flex min-w-[240px] items-center gap-2 rounded-lg border border-[#d5e2db] px-3 py-2">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ชื่อ, HN, โทรศัพท์, case no."
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-[#e0e9e4]">
          {items.map((x, index) => (
            <button
              key={`${x.id}-${index}`}
              onClick={() => choose(x)}
              className="grid w-full gap-3 border-b border-[#e8eeea] px-4 py-4 text-left last:border-0 hover:bg-[#f7fbf9] md:grid-cols-[1.2fr_.8fr_.7fr_.8fr_.4fr]"
            >
              <span>
                <b className="block text-sm">{x.name}</b>
                <span className="text-xs text-[#697c74]">
                  {x.id} · {x.service} · {x.source}
                </span>
              </span>
              <span>
                <b className="block text-xs">{x.task}</b>
                <span
                  className={`text-xs ${x.dueState === 'overdue' ? 'text-[#b44b54]' : 'text-[#71847b]'}`}
                >
                  {x.due}
                </span>
              </span>
              <span className="text-xs">
                {x.owner} · {x.nurse}
              </span>
              <Badge>{x.status}</Badge>
              <Priority p={x.priority} />
            </button>
          ))}
          {!items.length && (
            <p className="p-10 text-center text-sm text-[#71847b]">
              ไม่พบงานตามตัวกรองนี้
            </p>
          )}
        </div>
        <p className="mt-3 text-xs text-[#71847b]">
          ตัวอย่าง filter: owner, status, source, plan, due range และ priority
        </p>
      </div>
    </>
  );
}
function Detail({
  item,
  role,
  events,
  result,
  appointment,
  reassign,
  reason,
}: {
  item: Case;
  role: Role;
  events: string[];
  result: () => void;
  appointment: () => void;
  reassign: () => void;
  reason: (x: 'pause' | 'close' | 'reopen') => void;
}) {
  const base = [
    `10 ก.ย. 2026 14:10 · มุก มอบหมาย ${item.nurse} · Awaiting nurse call`,
    `10 ก.ย. 2026 14:05 · มุก สร้างเคสจาก ${item.source} · ${item.id}`,
  ];
  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-[#dce6e0] bg-white p-5">
          <div className="flex flex-wrap justify-between gap-4">
            <div className="flex gap-3">
              <span className="grid size-12 place-items-center rounded-full bg-[#e5f3ef] font-semibold text-[#197365]">
                {item.initials}
              </span>
              <div>
                <div className="flex flex-wrap gap-2">
                  <h2 className="font-semibold">{item.name}</h2>
                  <Badge>{item.status}</Badge>
                  {item.closed && <Badge warn>ปิดเคส · read-only</Badge>}
                </div>
                <p className="mt-1 text-xs text-[#687b73]">
                  {item.id} · {item.hn ?? 'ยังไม่มี HN'} · {item.phone}
                </p>
                <p className="mt-1 text-xs text-[#687b73]">
                  แหล่งที่มา: <b>{item.source}</b> (แก้ไขผ่าน auditable correction
                  เท่านั้น)
                </p>
              </div>
            </div>
            <Priority p={item.priority} />
          </div>
          <div className="mt-5 grid gap-3 border-t border-[#e8eeea] pt-4 sm:grid-cols-3">
            <Info l="บริการ / ความสนใจ" v={item.service} />
            <Info l="พยาบาล / Owner" v={`${item.nurse} · ${item.owner}`} />
            <Info l="แผน / Anchor" v={`${item.plan} · ${item.anchor}`} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {!item.closed ? (
              <>
                <Action onClick={result} icon={<Phone size={15} />}>
                  บันทึกผลติดตาม
                </Action>
                <Action
                  onClick={appointment}
                  secondary
                  icon={<CalendarDays size={15} />}
                >
                  สร้างนัดหมาย
                </Action>
                <Action onClick={reassign} secondary>
                  มอบหมายใหม่
                </Action>
                <Action onClick={() => reason('pause')} secondary>
                  พัก/ยกเลิกงาน
                </Action>
                <Action onClick={() => reason('close')} secondary>
                  ปิดเคส
                </Action>
              </>
            ) : (
              <Action
                onClick={() => reason('reopen')}
                icon={<History size={15} />}
              >
                เปิดเคสอีกครั้ง
              </Action>
            )}
          </div>
        </section>
        <section className="rounded-2xl border border-[#dce6e0] bg-white p-5">
          <div className="flex justify-between">
            <h2 className="font-semibold">Timeline ของเคส</h2>
            <span className="text-xs text-[#71847b]">ประวัติไม่ถูกลบ</span>
          </div>
          <div className="mt-4 space-y-3">
            {[...events, ...base].map((e, i) => (
              <div
                key={e + i}
                className="flex gap-3 border-l-2 border-[#cae5db] pl-4 text-sm"
              >
                <Activity
                  className="mt-0.5 shrink-0 text-[#197365]"
                  size={15}
                />
                <p>{e}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
      <aside className="space-y-4">
        <section className="rounded-2xl border border-[#cfe5dc] bg-[#f5fbf8] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6b8077]">
            งานถัดไป
          </p>
          <b className="mt-2 block text-sm">{item.task}</b>
          <p className="mt-1 text-xs text-[#9a641b]">
            <Clock3 className="mr-1 inline" size={13} />
            {item.due}
          </p>
          <p className="mt-3 text-sm text-[#40574e]">{item.note}</p>
        </section>
        <section className="rounded-2xl border border-[#dce6e0] bg-white p-4">
          <h3 className="text-sm font-semibold">แผนติดตาม (snapshot)</h3>
          {[
            ['Day 1', 'เสร็จแล้ว'],
            ['Day 3', 'รอดำเนินการ'],
            ['Day 7', 'กำหนดการ'],
            ['Day 14', 'กำหนดการ'],
            ['Day 30', 'กำหนดการ'],
          ].map(([d, s]) => (
            <div key={d} className="mt-3 flex justify-between text-xs">
              <span>
                <b>{d}</b>
              </span>
              <span className="text-[#71847b]">{s}</span>
            </div>
          ))}
          <p className="mt-4 text-[11px] text-[#71847b]">
            แก้แผนภายหลังไม่เปลี่ยน task ที่สร้างแล้ว
          </p>
        </section>
        {role === 'manager' && (
          <section className="rounded-2xl border border-[#dce6e0] bg-white p-4 text-xs text-[#71847b]">
            <b className="block text-sm text-[#19312c]">Privileged actions</b>
            <p className="mt-2">
              Correction/change plan/reopen ต้องระบุเหตุผลและมี audit
            </p>
          </section>
        )}
      </aside>
    </div>
  );
}
function Appointments({
  items,
  choose,
}: {
  items: Case[];
  choose: (x: Case) => void;
}) {
  return (
    <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_300px]">
      <section className="rounded-2xl border border-[#dce6e0] bg-white p-5">
        <div className="flex justify-between border-b border-[#e8eeea] pb-4">
          <div>
            <h2 className="font-semibold">นัดวันที่ 11 ก.ย. 2026</h2>
            <p className="mt-1 text-xs text-[#6b7f76]">
              สถานะนัดไม่ยกเลิก follow-up ที่เหลือ
            </p>
          </div>
          <Badge>3 นัดหมาย</Badge>
        </div>
        {items.map((x, i) => (
          <button
            key={x.id}
            onClick={() => choose(x)}
            className="flex w-full items-center gap-4 border-b border-[#e8eeea] py-4 text-left"
          >
            <b className="w-12 text-[#197365]">
              {['16:30', '17:00', '18:00'][i] ?? '10:00'}
            </b>
            <span className="grid size-10 place-items-center rounded-full bg-[#e5f3ef] text-xs font-semibold text-[#197365]">
              {x.initials}
            </span>
            <span className="flex-1">
              <b className="block text-sm">{x.name}</b>
              <span className="text-xs text-[#71847b]">
                {x.service} · source result FR-882
              </span>
            </span>
            <Badge>Confirmed</Badge>
            <ChevronRight size={16} />
          </button>
        ))}
        {!items.length && (
          <p className="py-12 text-center text-sm text-[#71847b]">
            ยังไม่มีนัดหมายในข้อมูลจำลอง
          </p>
        )}
      </section>
      <aside className="rounded-2xl border border-[#dce6e0] bg-white p-5">
        <CalendarDays className="text-[#197365]" />
        <h3 className="mt-3 font-semibold">Calendar / list view</h3>
        <p className="mt-2 text-sm text-[#687b73]">
          รองรับ Confirmed, Completed, Cancelled, No-show และ Rescheduled
          พร้อมประวัติ และเปิด source case ได้
        </p>
      </aside>
    </div>
  );
}
function Dashboard() {
  return (
    <>
      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="เคสใหม่ (7 วัน)" value="28" />
        <Metric label="ติดต่อสำเร็จ" value="21" />
        <Metric label="Due / Overdue" value="12 / 3" alert />
        <Metric label="นัดตามสถานะ" value="12" />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#dce6e0] bg-white p-5">
          <h2 className="font-semibold">เส้นทางลีดสัปดาห์นี้</h2>
          <div className="mt-6 grid grid-cols-4 gap-2 text-center text-xs">
            {[
              ['28', 'ใหม่'],
              ['21', 'ติดต่อ'],
              ['12', 'นัด'],
              ['6', 'Converted'],
            ].map(([n, l]) => (
              <div key={l}>
                <b className="block text-xl text-[#197365]">{n}</b>
                <span className="mt-2 block text-[#71847b]">{l}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-[#dce6e0] bg-white p-5">
          <h2 className="font-semibold">ข้อยกเว้นที่ต้องดูแล</h2>
          <p className="mt-3 text-sm text-[#62766d]">
            มี 3 follow-up เกินกำหนด และ 2 เคสรอ nurse call
          </p>
          <p className="mt-3 text-xs text-[#71847b]">
            ตัวเลขกรองตามช่วงเวลา, clinic, owner ได้ และไม่แสดง symptoms/note อ่อนไหว
          </p>
        </section>
      </div>
      <section className="mt-5 rounded-2xl border border-[#dce6e0] bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">แจ้งเตือนภายในทีม</h2>
            <p className="mt-1 text-xs text-[#71847b]">
              สำหรับติดตามงานและข้อยกเว้นเท่านั้น — ไม่ส่งข้อความถึงผู้ป่วย
            </p>
          </div>
          <Badge>3 รายการ</Badge>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {[
            ['งานติดตามเกินกำหนด', 'CD-24091 · โทรติดตามแผลหลังผ่าตัด'],
            ['นัดหมายวันนี้', 'CD-24093 · ประเมินเส้นฟอกไต 16:30'],
            ['Calendar ต้องตรวจสอบ', 'Google Calendar มีการแก้ไขจากภายนอก'],
          ].map(([title, detail]) => (
            <div key={title} className="rounded-xl bg-[#f5faf7] p-3">
              <b className="block text-sm text-[#19312c]">{title}</b>
              <span className="mt-1 block text-xs text-[#71847b]">{detail}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
function Settings() {
  return (
    <div className="mt-7 grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-[#dce6e0] bg-white p-5">
        <div className="flex justify-between">
          <div>
            <h2 className="font-semibold">Follow-up plans</h2>
            <p className="text-xs text-[#71847b]">เปลี่ยนได้เฉพาะงานอนาคต</p>
          </div>
          <Action icon={<Plus size={14} />}>เพิ่ม step</Action>
        </div>
        <div className="mt-5 space-y-2">
          {[
            ['1', 'Day 1'],
            ['3', 'Day 3'],
            ['7', 'Day 7'],
            ['14', 'Day 14'],
            ['30', 'Day 30'],
          ].map(([d, l]) => (
            <div
              key={d}
              className="flex justify-between rounded-lg bg-[#f5faf7] px-3 py-2 text-sm"
            >
              <span>
                <b>{l}</b> · Offset {d} วัน
              </span>
              <button className="text-xs text-[#197365]">
                แก้ไขสำหรับงานใหม่
              </button>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-lg bg-[#fff4e1] p-3 text-xs text-[#8a5a19]">
          <AlertTriangle className="mr-1 inline" size={14} />
          แผนมาตรฐานเป็น snapshot: task เดิมไม่เปลี่ยน
        </p>
      </section>
      <section className="rounded-2xl border border-[#dce6e0] bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">บริการทางคลินิกและแผนติดตาม</h2>
            <p className="mt-1 text-xs text-[#71847b]">
              แต่ละบริการมี default plan ของตนเอง; เปลี่ยนได้เฉพาะเคสใหม่
            </p>
          </div>
          <Action icon={<Plus size={14} />}>เพิ่มบริการ</Action>
        </div>
        <div className="mt-4 space-y-2">
          {serviceCatalog.map((service) => (
            <div key={service.id} className="rounded-lg bg-[#f5faf7] px-3 py-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <b>{service.name}</b>
                <button className="text-xs text-[#197365]">แก้ไข</button>
              </div>
              <p className="mt-1 text-xs text-[#71847b]">
                Default plan: {service.defaultPlan}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-[#dce6e0] bg-white p-5">
        <h2 className="font-semibold">Channels, staff & case numbering</h2>
        <div className="mt-4 space-y-3 text-sm">
          <Info
            l="Source channels"
            v="Facebook · LINE OA · TikTok · Phone · Other"
          />
          <Info l="บทบาท" v="Admin, Nurse, Manager, System administrator" />
          <Info
            l="รูปแบบเลขเคส"
            v="CD-{sequence} · ระบบสร้างอัตโนมัติ · แก้ไขเลขที่สร้างแล้วไม่ได้"
          />
          <Info
            l="Integration readiness"
            v="Restricted event list only — ไม่มี credential / webhook"
          />
        </div>
      </section>
    </div>
  );
}
function Audit() {
  const rows = [
    'มายด์ · สร้างเคส CD-24092 จาก LINE OA',
    'มุก · บันทึกผลแทน พยาบาลวิภา · performed_at 10:05',
    'มุก · เปลี่ยน nurse assignment พร้อมเหตุผล',
    'เจ้าของคลินิก · แก้ Standard plan สำหรับเคสใหม่',
  ];
  return (
    <section className="mt-7 rounded-2xl border border-[#dce6e0] bg-white p-5">
      <h2 className="font-semibold">Audit history</h2>
      <p className="mt-1 text-xs text-[#71847b]">
        Append-only activity สำหรับ creation, state change และ privileged
        correction
      </p>
      <div className="mt-5 divide-y divide-[#e8eeea]">
        {rows.map((r, i) => (
          <div key={r} className="flex gap-3 py-4 text-sm">
            <ShieldCheck className="text-[#197365]" size={17} />
            <span className="flex-1">{r}</span>
            <span className="text-xs text-[#71847b]">
              11 ก.ย. 2026 0{9 + i}:20
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
function NewLead({
  caseNumber,
  close,
  save,
}: {
  caseNumber: string;
  close: () => void;
  save: (x: Case) => void;
}) {
  const [step, setStep] = useState(1),
    [name, setName] = useState(''),
    [phone, setPhone] = useState('081-555-0192'),
    [source, setSource] = useState('Facebook'),
    [service, setService] = useState(serviceCatalog[0].name),
    [careContactConsent, setCareContactConsent] = useState(false);
  const dup = phone.replace(/\D/g, '') === '0815550192';
  const selectedService =
    serviceCatalog.find((item) => item.name === service) ?? serviceCatalog[0];
  const done = () =>
    save({
      id: caseNumber,
      initials: (name || 'ลส').slice(0, 2),
      name: name || 'ลูกค้าตัวอย่าง',
      phone,
      service,
      source,
      status: 'Awaiting nurse call',
      priority: 'Normal',
      nurse: 'พยาบาลวิภา',
      owner: 'มายด์',
      task: 'โทรประเมินเบื้องต้น',
      due: 'วันนี้ ก่อน 17:00',
      dueState: 'today',
      note: 'เคสที่สร้างด้วย manual intake',
      plan: selectedService.defaultPlan,
      anchor: '11 ก.ย. 2026',
    });
  return (
    <Modal
      title="เพิ่มลีด / สร้างเคส"
      sub={`ขั้นตอน ${step} จาก 3 · ค้นหาผู้ป่วย → รายละเอียดเคส → ยืนยันแผน`}
      close={close}
    >
      {step === 1 ? (
        <div className="space-y-4">
          <label className="block text-sm font-medium">
            ค้นหาหรือชื่อผู้ป่วย
            <input
              className={field}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ชื่อ-นามสกุล"
            />
          </label>
          <label className="block text-sm font-medium">
            โทรศัพท์
            <input
              className={field}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          {dup && (
            <div className="rounded-xl border border-[#efca8c] bg-[#fff7e8] p-3 text-sm">
              <b className="text-[#9a641b]">
                <AlertTriangle className="mr-1 inline" size={15} />
                พบข้อมูลซ้ำที่เป็นไปได้
              </b>
              <p className="mt-1 text-xs">
                ตรงกับ นลินี ศรีสุข (CD-24091) — ระบบไม่ merge อัตโนมัติ
              </p>
              <div className="mt-3 flex gap-2">
                <button className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-[#197365]">
                  เชื่อมผู้ป่วยเดิม
                </button>
                <button className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-[#197365]">
                  สร้างใหม่พร้อมเหตุผล
                </button>
              </div>
            </div>
          )}
          <p className="text-xs text-[#71847b]">
            HN ไม่บังคับ และมี warning ก่อนบันทึก
          </p>
          <label className="flex gap-2 rounded-lg bg-[#f5faf7] p-3 text-xs text-[#52665e]">
            <input
              type="checkbox"
              checked={careContactConsent}
              onChange={(event) => setCareContactConsent(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              บันทึกความยินยอมให้คลินิกติดต่อเพื่อประสานการดูแล
              <br />
              ไม่ใช่ความยินยอมรับการตลาด และผู้ป่วยสามารถขอไม่ให้ติดต่อได้
            </span>
          </label>
        </div>
      ) : step === 2 ? (
        <div className="space-y-3">
          <Select
            l="ช่องทางต้นทาง"
            values={['Facebook', 'LINE OA', 'TikTok', 'Phone', 'Other']}
            value={source}
            change={setSource}
          />
          <Select
            l="บริการ / โปรแกรม"
            values={serviceCatalog.map((item) => item.name)}
            value={service}
            change={setService}
          />
          <div className="rounded-lg bg-[#f5faf7] p-3 text-xs text-[#52665e]">
            <b>แผนติดตามเริ่มต้น: {selectedService.defaultPlan}</b>
            <br />
            {selectedService.description} · ปรับเปลี่ยนในเคสได้โดยบันทึก audit
          </div>
          <label className="block text-sm font-medium">
            อาการหรือความกังวล
            <textarea
              className={field}
              defaultValue="ข้อมูลคัดกรองที่จำเป็นต่อการติดตามเท่านั้น"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Select l="Priority" values={['Normal', 'High', 'Urgent']} />
            <Select l="พยาบาล" values={['พยาบาลวิภา', 'พยาบาลณิชา']} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl bg-[#f5faf7] p-4 text-sm">
            <b>{selectedService.defaultPlan} · Anchor 11 ก.ย. 2026</b>
            <p className="mt-2 text-xs">
              สร้าง task: Day 1, 3, 7, 14, 30 ใน Asia/Bangkok
            </p>
          </div>
          <label className="block text-sm font-medium">
            เหตุผล หากเลือกสร้างผู้ป่วยใหม่ที่ซ้ำ
            <input className={field} placeholder="เช่น ยืนยันว่าเป็นคนละบุคคล" />
          </label>
          <p className="text-xs text-[#71847b]">
            due time และ weekend policy เป็นค่าที่ตั้งได้ตามคลินิก
          </p>
        </div>
      )}
      <div className="mt-6 flex justify-between">
        <button
          onClick={() => (step === 1 ? close() : setStep(step - 1))}
          className="rounded-lg px-3 py-2 text-sm"
        >
          {step === 1 ? 'ยกเลิก' : 'ย้อนกลับ'}
        </button>
        <button
          onClick={() => (step === 3 ? done() : setStep(step + 1))}
          className="rounded-lg bg-[#197365] px-4 py-2 text-sm font-semibold text-white"
        >
          {step === 3 ? 'สร้างเคสและมอบหมาย' : 'ถัดไป'}
        </button>
      </div>
    </Modal>
  );
}
function Result({
  item,
  close,
  save,
}: {
  item: Case;
  close: () => void;
  save: (a: boolean) => void;
}) {
  const [a, setA] = useState(false);
  return (
    <Modal
      title="บันทึกผลติดตาม"
      sub={`${item.id} · ${item.task} · บันทึกแทนพยาบาลได้`}
      close={close}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Select l="Contact channel" values={['Phone', 'LINE OA', 'Facebook']} />
        <Select
          l="Contact status"
          values={['Reached', 'No answer', 'Requested callback']}
        />
        <Select
          l="Outcome"
          values={['Interested', 'Appointment requested', 'Needs information']}
        />
        <Select
          l="Symptom status"
          values={['Not assessed', 'Improved', 'Same', 'Worse']}
        />
        <label className="text-sm font-medium">
          เวลาที่ติดต่อจริง
          <input className={field} defaultValue="11 ก.ย. 2026 10:05" />
        </label>
        <Select l="ผู้ปฏิบัติ/ผู้รายงาน" values={['พยาบาลวิภา', 'พยาบาลณิชา']} />
      </div>
      <label className="mt-3 block text-sm font-medium">
        สรุปผล
        <textarea
          className={field}
          defaultValue="สนใจเข้ารับคำปรึกษา ขอจองช่วงเย็น"
        />
      </label>
      <div className="mt-3 rounded-lg bg-[#eaf6f1] p-3 text-xs text-[#246656]">
        <b>บันทึกแทนพยาบาล:</b> performed/reported by พยาบาลวิภา · recorded by มายด์ ·
        recorded at 11 ก.ย. 2026 10:15
      </div>
      <label className="mt-3 flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={a}
          onChange={(e) => setA(e.target.checked)}
        />
        บันทึกผลและสร้างนัดหมายต่อทันที
      </label>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={close} className="rounded-lg px-3 py-2 text-sm">
          ยกเลิก
        </button>
        <button
          onClick={() => save(a)}
          className="rounded-lg bg-[#197365] px-4 py-2 text-sm font-semibold text-white"
        >
          บันทึกผล{a ? 'และสร้างนัด' : ''}
        </button>
      </div>
    </Modal>
  );
}
function Appointment({
  item,
  close,
  save,
}: {
  item: Case;
  close: () => void;
  save: () => void;
}) {
  return (
    <Modal
      title="สร้างนัดหมาย"
      sub={`ผู้ป่วยและเคสถูกเชื่อมไว้แล้ว · ${item.id} · source result FR-882`}
      close={close}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          วันและเวลาเริ่ม
          <input className={field} defaultValue="18 ก.ย. 2026 16:30" />
        </label>
        <label className="text-sm font-medium">
          วันและเวลาสิ้นสุด
          <input className={field} defaultValue="18 ก.ย. 2026 17:00" />
        </label>
        <Select
          l="ประเภทนัด"
          values={[
            'Doctor consultation',
            'Treatment consultation',
            'Follow-up visit',
          ]}
        />
        <Select
          l="สาขา / Provider"
          values={['Care D Clinic · พยาบาลวิภา', 'Care D Clinic · พยาบาลณิชา']}
        />
      </div>
      <div className="mt-4 rounded-lg bg-[#f5faf7] p-3 text-xs">
        <b>Appointment status: Pending confirmation</b>
        <br />
        Confirmed, Completed, Cancelled, No-show, Rescheduled จะไม่ยกเลิก
        follow-up ที่เหลือ
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={close} className="rounded-lg px-3 py-2 text-sm">
          ยกเลิก
        </button>
        <button
          onClick={save}
          className="rounded-lg bg-[#197365] px-4 py-2 text-sm font-semibold text-white"
        >
          บันทึกนัดหมาย
        </button>
      </div>
    </Modal>
  );
}
function Reason({
  action,
  close,
  save,
}: {
  action: 'pause' | 'close' | 'reopen';
  close: () => void;
  save: (r: string) => void;
}) {
  const [r, setR] = useState('');
  const title =
    action === 'close'
      ? 'ปิดเคส'
      : action === 'reopen'
        ? 'เปิดเคสอีกครั้ง'
        : 'พักหรือยกเลิกงาน';
  return (
    <Modal
      title={title}
      sub="การดำเนินการนี้ต้องเก็บเหตุผลใน audit history"
      close={close}
    >
      <label className="block text-sm font-medium">
        เหตุผล
        <textarea
          className={field}
          value={r}
          onChange={(e) => setR(e.target.value)}
          placeholder="ระบุเหตุผลสำหรับการตรวจสอบ"
        />
      </label>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={close} className="rounded-lg px-3 py-2 text-sm">
          ยกเลิก
        </button>
        <button
          disabled={!r.trim()}
          onClick={() => save(r)}
          className="rounded-lg bg-[#197365] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          ยืนยันและบันทึก audit
        </button>
      </div>
    </Modal>
  );
}
function Modal({
  title,
  sub,
  close,
  children,
}: {
  title: string;
  sub: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#19312c]/30 p-4">
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex justify-between gap-4">
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-xs text-[#71847b]">{sub}</p>
          </div>
          <button onClick={close} className="p-1">
            <X size={18} />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </section>
    </div>
  );
}
function Metric({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#dce6e0] bg-white p-4">
      <p className="text-xs text-[#6b7f76]">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold ${alert ? 'text-[#b44b54]' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}
function Badge({
  children,
  warn = false,
}: {
  children: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${warn ? 'bg-[#fff0d7] text-[#9a641b]' : 'bg-[#e5f3ef] text-[#17695d]'}`}
    >
      {children}
    </span>
  );
}
function Priority({ p }: { p: Priority }) {
  const c: Record<Priority, string> = {
    Urgent: 'bg-[#fde7e9] text-[#ad3844]',
    High: 'bg-[#fff0d7] text-[#9a641b]',
    Normal: 'bg-[#e5f3ef] text-[#17695d]',
    Low: 'bg-[#eff3f1] text-[#71847b]',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${c[p]}`}
    >
      {p}
    </span>
  );
}
function Info({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#84968e]">
        {l}
      </p>
      <p className="mt-1 text-sm text-[#40574e]">{v}</p>
    </div>
  );
}
function Action({
  children,
  onClick,
  icon,
  secondary = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
  secondary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${secondary ? 'border border-[#cbd9d2] text-[#40574e]' : 'bg-[#197365] text-white'}`}
    >
      {icon}
      {children}
    </button>
  );
}
function Select({
  l,
  values,
  value,
  change,
}: {
  l: string;
  values: string[];
  value?: string;
  change?: (x: string) => void;
}) {
  return (
    <label className="text-sm font-medium">
      {l}
      <select
        value={value}
        onChange={(e) => change?.(e.target.value)}
        className={field}
      >
        {values.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    </label>
  );
}
