'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import { CalendarWorkspace } from '@/components/calendar/calendar-workspace';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { IntakeWizard, type DirectoryPerson } from './intake-wizard';
import { PersonDirectory } from './person-directory';
import { CaseWorkflow } from './case-workflow';
import { OperationalDashboard } from './operational-dashboard';

type Role = 'clinic_admin' | 'care_coordinator' | 'nurse' | 'viewer';
type View =
  | 'queue'
  | 'patients'
  | 'cases'
  | 'appointments'
  | 'calendar'
  | 'dashboard';
type Patient = {
  full_name: string;
  phone_normalized?: string | null;
  hn?: string | null;
};
type CaseRow = {
  id: string;
  case_number: string;
  state: string;
  priority: string;
  source_received_at: string;
  patients?: Patient[];
  sources?: { label: string }[];
  full_name?: string;
  phone_normalized?: string;
  source_label?: string;
  service_name?: string;
  assigned_to?: string | null;
};
type TaskRow = {
  id: string;
  case_id: string;
  due_at: string;
  status: string;
  step_snapshot?: { label?: string } | null;
  cases?: { case_number: string; patients?: Patient[] }[];
  case_number?: string;
  full_name?: string;
};
type AppointmentRow = {
  id: string;
  case_id: string;
  starts_at: string;
  appointment_type: string;
  status: string;
  branch?: string | null;
  provider_name?: string | null;
  cases?: { case_number: string; patients?: Patient[] }[];
};
type ReferenceData = {
  sources: { id: string; label: string }[];
  services: {
    id: string;
    name: string;
    default_follow_up_plan_id?: string | null;
  }[];
  plans: { id: string; name: string }[];
  nurses: { user_id: string; display_name: string }[];
  staff: {user_id:string;display_name:string;role:string}[];
};
type Session = {
  systemAdmin: boolean;
  memberships: { clinic_id: string; clinic_name: string; role: Role }[];
  activeClinic: { id: string; name: string; role: Role } | null;
};

const nav: {
  id: View;
  label: string;
  icon: typeof ClipboardList;
  roles?: Role[];
}[] = [
  { id: 'queue', label: 'คิวงานติดตาม', icon: ClipboardList },
  { id: 'patients', label: 'ลีด / ผู้ป่วย', icon: Users },
  {
    id: 'appointments',
    label: 'นัดหมาย',
    icon: CalendarDays,
    roles: ['clinic_admin', 'care_coordinator'],
  },
  { id: 'calendar', label: 'ปฏิทินงาน', icon: CalendarDays },
  { id: 'dashboard', label: 'ภาพรวม', icon: LayoutDashboard },
];
const displayDate = (value: string) =>
  new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
const first = <T,>(value: T | T[] | null | undefined): T | undefined =>
  Array.isArray(value) ? value[0] : (value ?? undefined);
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase() || '-';
const patientName = (item: CaseRow) =>
  item.full_name ?? first(item.patients)?.full_name ?? 'ไม่ระบุชื่อ';
const patientPhone = (item: CaseRow) =>
  item.phone_normalized ?? first(item.patients)?.phone_normalized ?? '';
const sourceLabel = (item: CaseRow) =>
  item.source_label ?? first(item.sources)?.label ?? 'ไม่ระบุ';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  const response = await fetch(url, { ...init, headers });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'ไม่สามารถดำเนินการได้');
  return body as T;
}

export function OperationsWorkspace() {
  const router = useRouter();
  const [view, setView] = useState<View>('queue');
  const [drawer, setDrawer] = useState(false);
  const [session, setSession] = useState<Session>();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [reference, setReference] = useState<ReferenceData>({
    sources: [],
    services: [],
    plans: [],
    nurses: [],
    staff: [],
  });
  const [selectedCaseId, setSelectedCaseId] = useState<string>();
  const [intakePerson, setIntakePerson] = useState<DirectoryPerson>();
  const [focusedPatient, setFocusedPatient] = useState<string>();
  const [modal, setModal] = useState<
    'new' | 'result' | 'appointment' | 'manage' | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const nextSession = await api<Session>('/api/session');
      setSession(nextSession);
      if (!nextSession.activeClinic) return;
      const [nextCases, nextTasks, nextAppointments, nextReference] =
        await Promise.all([
          api<CaseRow[]>('/api/cases'),
          api<TaskRow[]>('/api/follow-up-tasks'),
          api<AppointmentRow[]>('/api/appointments'),
          api<ReferenceData>('/api/reference-data'),
        ]);
      setCases(nextCases);
      setTasks(nextTasks);
      setAppointments(nextAppointments);
      setReference(nextReference);
      setSelectedCaseId((current) =>
        current && nextCases.some((item) => item.id === current)
          ? current
          : nextCases[0]?.id,
      );
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const requestId = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(requestId);
  }, [refresh]);
  useEffect(() => {
    if (!loading && session?.systemAdmin && !session.activeClinic)
      router.replace('/system');
  }, [loading, router, session]);

  const save = async (work: () => Promise<unknown>) => {
    try {
      await work();
      setNotice('บันทึกข้อมูลแล้ว');
      setModal(null);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ไม่สามารถบันทึกข้อมูลได้');
    }
  };
  if (!loading && !session?.activeClinic)
    return <AccessPending session={session} />;
  const role = session?.activeClinic?.role;
  const canIntake = role === 'clinic_admin' || role === 'care_coordinator';
  const canAppointment = canIntake;
  const selected = cases.find((item) => item.id === selectedCaseId);
  const chooseCase = (id: string) => {
    setSelectedCaseId(id);
    setView('cases');
    setDrawer(false);
  };

  return (
    <main className="min-h-screen bg-[#f4f7f5] text-[#19312c]">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#dbe5df] bg-white/95 px-4 md:px-7">
        <div className="flex items-center gap-3">
          <button
            className="p-2 md:hidden"
            onClick={() => setDrawer(true)}
            aria-label="เปิดเมนู"
          >
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
            <b className="block text-sm">
              {session?.activeClinic?.name ?? 'Care D Clinic'}
            </b>
            <span className="text-[10px] text-[#6a7d75]">
              ระบบประสานการดูแลผู้ป่วย
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session && session.memberships.length > 1 && (
            <select
              aria-label="เลือกคลินิก"
              value={session.activeClinic?.id}
              onChange={(event) =>
                void save(() =>
                  api('/api/active-clinic', {
                    method: 'POST',
                    body: JSON.stringify({ clinicId: event.target.value }),
                  }),
                )
              }
              className="hidden rounded-lg border border-[#d6e2dc] bg-white px-2 py-1.5 text-xs font-semibold text-[#17695d] sm:block"
            >
              {session.memberships.map((membership) => (
                <option key={membership.clinic_id} value={membership.clinic_id}>
                  {membership.clinic_name}
                </option>
              ))}
            </select>
          )}
          {role === 'clinic_admin' && (
            <Link
              href="/admin"
              className="rounded-lg border border-[#d6e2dc] px-2 py-1.5 text-xs font-semibold text-[#17695d]"
            >
              จัดการคลินิก
            </Link>
          )}
          <span className="hidden rounded-full bg-[#e2eeea] px-2 py-1 text-[11px] font-semibold text-[#197365] sm:block">
            {roleLabel(role)}
          </span>
          <SignOutButton />
        </div>
      </header>
      <div className="mx-auto flex max-w-[1500px]">
        <Sidebar active={view} role={role} select={setView} />
        {drawer && (
          <div className="fixed inset-0 z-50 bg-[#19312c]/20 md:hidden">
            <aside className="h-full w-72 bg-[#f8faf8] p-4 shadow-xl">
              <button
                className="float-right p-2"
                onClick={() => setDrawer(false)}
                aria-label="ปิดเมนู"
              >
                <X size={18} />
              </button>
              <Sidebar
                mobile
                active={view}
                role={role}
                select={(next) => {
                  setView(next);
                  setDrawer(false);
                }}
              />
            </aside>
          </div>
        )}
        <section className="min-w-0 flex-1 p-5 lg:p-8">
          <Heading
            view={view}
            role={role}
            add={canIntake ? () => setModal('new') : undefined}
          />
          {error && (
            <p
              role="alert"
              className="mt-5 rounded-xl bg-[#fff4e5] p-3 text-sm text-[#9a641b]"
            >
              {error}
            </p>
          )}
          {notice && (
            <p className="mt-5 rounded-xl bg-[#eaf6f1] p-3 text-sm text-[#17695d]">
              {notice}
            </p>
          )}
          {loading ? (
            <LoadingShell />
          ) : (
            <>
              {view === 'queue' && (
                <Queue cases={cases} tasks={tasks} choose={chooseCase} />
              )}
              {view === 'patients' && (
                <PersonDirectory
                  staff={reference.staff}
                  focusId={focusedPatient}
                  chooseCase={chooseCase}
                  createCase={
                    canIntake
                      ? (person) => {
                          setIntakePerson(person);
                          setModal('new');
                        }
                      : undefined
                  }
                />
              )}
              {view === 'cases' && (
                <CaseWorkflow
                  id={selectedCaseId}
                  role={role}
                  nurses={reference.nurses}
                  plans={reference.plans}
                  refreshWorkspace={refresh}
                />
              )}
              {view === 'appointments' && (
                <Appointments
                  appointments={appointments}
                  cases={cases}
                  choose={chooseCase}
                  add={
                    canAppointment ? () => setModal('appointment') : undefined
                  }
                />
              )}
              {view === 'calendar' && (
                <CalendarWorkspace onOpenCase={chooseCase} staff={reference.staff} />
              )}
              {view === 'dashboard' && <OperationalDashboard />}
            </>
          )}
        </section>
      </div>
      {modal === 'new' && (
        <IntakeWizard
          reference={reference}
          person={intakePerson}
          close={() => {
            setModal(null);
            setIntakePerson(undefined);
          }}
          openCase={chooseCase}
          saved={async (result) => {
            setModal(null);
            setIntakePerson(undefined);
            setNotice(
              result.case
                ? 'สร้างเคส ' + result.case.case_number + ' แล้ว'
                : 'บันทึกลีดแล้ว',
            );
            await refresh();
            if (result.case) chooseCase(result.case.id);
            else {
              setFocusedPatient(result.patientId);
              setView('patients');
            }
          }}
        />
      )}
      {modal === 'result' && (
        <RecordResult
          tasks={tasks.filter((task) => task.case_id === selectedCaseId)}
          close={() => setModal(null)}
          save={save}
        />
      )}
      {modal === 'appointment' && (
        <NewAppointment
          cases={selected ? [selected] : cases}
          close={() => setModal(null)}
          save={save}
        />
      )}
    </main>
  );
}

function Sidebar({
  active,
  role,
  select,
  mobile = false,
}: {
  active: View;
  role?: Role;
  select: (view: View) => void;
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
        .filter((item) => !item.roles || (role && item.roles.includes(role)))
        .map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => select(id)}
            className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${active === id ? 'bg-[#e5f3ef] font-semibold text-[#17695d]' : 'text-[#52665e] hover:bg-[#edf2ef]'}`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      <div className="mx-3 mt-12 rounded-xl border border-[#d9e6df] bg-white p-3 text-xs leading-relaxed text-[#688078]">
        <b className="text-[#197365]">ข้อมูลจริง · Supabase</b>
        <br />
        งานและสิทธิ์ถูกจำกัดตามคลินิกที่เลือก
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
  role?: Role;
  add?: () => void;
}) {
  const copy: Record<View, [string, string]> = {
    queue: ['คิวงานประสานการดูแล', 'งานเกินกำหนด วันนี้ และงานที่กำลังจะมาถึง'],
    patients: ['ลีด / ผู้ป่วย', 'ค้นหาผู้ป่วยก่อน แล้วเปิดหรือสร้างเคสที่เกี่ยวข้อง'],
    cases: ['รายละเอียดเคส', 'ข้อมูลผู้ป่วย ประวัติการติดตาม และการดำเนินการ'],
    appointments: ['นัดหมาย', 'ประเมินและหัตถการแยกสถานะออกจากเคส'],
    calendar: ['ปฏิทินงาน', 'นัดหมายและงานติดตามในมุมมองเดียวกัน'],
    dashboard: ['ภาพรวมการประสานการดูแล', 'ข้อมูลสรุปไม่แสดงข้อมูลอ่อนไหว'],
  };
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-[#197365]">{roleLabel(role)}</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
          {copy[view][0]}
        </h1>
        <p className="mt-1 text-sm text-[#61746c]">{copy[view][1]}</p>
      </div>
      {add && (
        <button
          onClick={add}
          className="flex items-center gap-2 rounded-xl bg-[#197365] px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus size={17} />
          เพิ่มลีด / สร้างเคส
        </button>
      )}
    </div>
  );
}
function Queue({
  cases,
  tasks,
  choose,
}: {
  cases: CaseRow[];
  tasks: TaskRow[];
  choose: (id: string) => void;
}) {
  const [filter, setFilter] = useState<
    'all' | 'overdue' | 'today' | 'upcoming'
  >('all');
  const [query, setQuery] = useState('');
  const [now] = useState(() => Date.now());
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const rows = tasks
    .map((task) => ({
      task,
      case: cases.find((item) => item.id === task.case_id),
    }))
    .filter((row) => row.case)
    .filter(({ task, case: item }) => {
      const due = new Date(task.due_at).getTime();
      const bucket =
        due < now ? 'overdue' : due < end.getTime() ? 'today' : 'upcoming';
      const search =
        `${patientName(item!)} ${item!.case_number} ${patientPhone(item!)} ${sourceLabel(item!)}`
          .toLowerCase()
          .includes(query.toLowerCase());
      return search && (filter === 'all' || bucket === filter);
    });
  const overdue = tasks.filter(
    (task) => new Date(task.due_at).getTime() < now,
  ).length;
  const today = tasks.filter(
    (task) =>
      new Date(task.due_at).getTime() >= start.getTime() &&
      new Date(task.due_at).getTime() < end.getTime(),
  ).length;
  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Metric
          label="งานเกินกำหนด"
          value={String(overdue)}
          alert={overdue > 0}
        />
        <Metric label="ต้องติดต่อวันนี้" value={String(today)} />
        <Metric label="งานติดตามทั้งหมด" value={String(tasks.length)} />
        <Metric label="เคสที่เปิดอยู่" value={String(cases.length)} />
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
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`rounded-lg px-3 py-1.5 ${filter === id ? 'bg-white text-[#17695d] shadow-sm' : 'text-[#6a7d75]'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex min-w-[240px] items-center gap-2 rounded-lg border border-[#d5e2db] px-3 py-2">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ชื่อ, HN, โทรศัพท์, case no."
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-[#e0e9e4]">
          {rows.map(({ task, case: item }) => (
            <button
              key={task.id}
              onClick={() => choose(item!.id)}
              className="grid w-full gap-3 border-b border-[#e8eeea] px-4 py-4 text-left last:border-0 hover:bg-[#f7fbf9] md:grid-cols-[1.2fr_.8fr_.8fr_.4fr]"
            >
              <span>
                <b className="block text-sm">{patientName(item!)}</b>
                <span className="text-xs text-[#697c74]">
                  {item!.case_number} · {sourceLabel(item!)}
                </span>
              </span>
              <span>
                <b className="block text-xs">
                  {task.step_snapshot?.label ?? 'งานติดตาม'}
                </b>
                <span
                  className={`text-xs ${new Date(task.due_at).getTime() < now ? 'text-[#b44b54]' : 'text-[#71847b]'}`}
                >
                  {displayDate(task.due_at)}
                </span>
              </span>
              <Badge>{task.status}</Badge>
              <Priority value={item!.priority} />
            </button>
          ))}
          {!rows.length && (
            <p className="p-10 text-center text-sm text-[#71847b]">
              ไม่พบงานตามตัวกรองนี้
            </p>
          )}
        </div>
      </div>
    </>
  );
}
function Appointments({
  appointments,
  cases,
  choose,
  add,
}: {
  appointments: AppointmentRow[];
  cases: CaseRow[];
  choose: (id: string) => void;
  add?: () => void;
}) {
  return (
    <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_300px]">
      <section className="rounded-2xl border border-[#dce6e0] bg-white p-5">
        <div className="flex justify-between border-b border-[#e8eeea] pb-4">
          <div>
            <h2 className="font-semibold">รายการนัดหมาย</h2>
            <p className="mt-1 text-xs text-[#6b7f76]">
              สถานะนัดไม่ยกเลิก follow-up ที่เหลือ
            </p>
          </div>
          {add && <Action onClick={add}>เพิ่มนัด</Action>}
        </div>
        {appointments.map((appointment) => {
          const item = cases.find(
            (caseRow) => caseRow.id === appointment.case_id,
          );
          return (
            <button
              key={appointment.id}
              onClick={() => choose(appointment.case_id)}
              className="flex w-full items-center gap-4 border-b border-[#e8eeea] py-4 text-left"
            >
              <b className="w-20 text-xs text-[#197365]">
                {displayDate(appointment.starts_at)}
              </b>
              <span className="grid size-10 place-items-center rounded-full bg-[#e5f3ef] text-xs font-semibold text-[#197365]">
                {initials(item ? patientName(item) : '')}
              </span>
              <span className="flex-1">
                <b className="block text-sm">
                  {item
                    ? patientName(item)
                    : (appointment.cases?.[0]?.patients?.[0]?.full_name ?? '-')}
                </b>
                <span className="text-xs text-[#71847b]">
                  {appointment.appointment_type} ·{' '}
                  {item?.case_number ??
                    appointment.cases?.[0]?.case_number ??
                    '-'}
                </span>
              </span>
              <Badge>{appointment.status}</Badge>
              <ChevronRight size={16} />
            </button>
          );
        })}
        {!appointments.length && (
          <p className="py-12 text-center text-sm text-[#71847b]">
            ยังไม่มีนัดหมาย
          </p>
        )}
      </section>
      <aside className="rounded-2xl border border-[#dce6e0] bg-white p-5">
        <CalendarDays className="text-[#197365]" />
        <h3 className="mt-3 font-semibold">Calendar / list view</h3>
        <p className="mt-2 text-sm text-[#687b73]">
          รองรับการดูนัดหมายและงานติดตามในปฏิทินเดียวกัน
        </p>
      </aside>
    </div>
  );
}

function RecordResult({
  tasks,
  close,
  save,
}: {
  tasks: TaskRow[];
  close: () => void;
  save: (work: () => Promise<unknown>) => void;
}) {
  const [taskId, setTaskId] = useState('');
  const [summary, setSummary] = useState('');
  return (
    <Modal title="บันทึกผลติดตาม" close={close}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save(() =>
            api('/api/follow-up-results', {
              method: 'POST',
              body: JSON.stringify({
                taskId,
                occurredAt: new Date().toISOString(),
                contactChannel: 'phone',
                contactStatus: 'contacted',
                outcome: 'ติดตามแล้ว',
                summary,
              }),
            }),
          );
        }}
      >
        <Field label="งานติดตาม">
          <select
            required
            value={taskId}
            onChange={(event) => setTaskId(event.target.value)}
          >
            <option value="">เลือกงาน</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.step_snapshot?.label ?? 'งานติดตาม'} ·{' '}
                {displayDate(task.due_at)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="สรุปเพื่อประสานงาน">
          <textarea
            required
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
        </Field>
        <button className="mt-5 w-full rounded-lg bg-[#197365] py-2 text-sm font-semibold text-white">
          บันทึกผล
        </button>
      </form>
    </Modal>
  );
}
function NewAppointment({
  cases,
  close,
  save,
}: {
  cases: CaseRow[];
  close: () => void;
  save: (work: () => Promise<unknown>) => void;
}) {
  const [caseId, setCaseId] = useState(cases[0]?.id ?? '');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [appointmentType, setAppointmentType] = useState('');
  return (
    <Modal title="สร้างนัดหมาย" close={close}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save(() =>
            api('/api/appointments', {
              method: 'POST',
              body: JSON.stringify({
                caseId,
                requestId: crypto.randomUUID(),
                startsAt: new Date(startsAt + ':00+07:00').toISOString(),
                endsAt: new Date(endsAt + ':00+07:00').toISOString(),
                appointmentType,
              }),
            }),
          );
        }}
      >
        <Field label="เคส">
          <select
            required
            value={caseId}
            onChange={(event) => setCaseId(event.target.value)}
          >
            {cases.map((item) => (
              <option key={item.id} value={item.id}>
                {item.case_number} · {patientName(item)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="วันและเวลา">
          <input
            required
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
        </Field>
        <Field label="สิ้นสุด (เวลาไทย)">
          <input
            required
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
          />
        </Field>
        <Field label="ประเภทนัด">
          <input
            required
            value={appointmentType}
            onChange={(event) => setAppointmentType(event.target.value)}
          />
        </Field>
        <button className="mt-5 w-full rounded-lg bg-[#197365] py-2 text-sm font-semibold text-white">
          บันทึกนัดหมาย
        </button>
      </form>
    </Modal>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  return (
    <div
      className="fixed inset-0 z-50 bg-[#19312c]/35"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <dialog
        open
        aria-label={title}
        className="fixed left-1/2 top-1/2 m-0 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={close} className="rounded p-1" aria-label="ปิด">
            <X size={18} />
          </button>
        </div>
        {children}
      </dialog>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-3 block text-sm">
      {label}
      <span className="mt-1 block [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:p-2 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:p-2 [&_textarea]:min-h-24 [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:p-2">
        {children}
      </span>
    </label>
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
      <p className="text-xs text-[#71847b]">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold ${alert ? 'text-[#b44b54]' : 'text-[#197365]'}`}
      >
        {value}
      </p>
    </div>
  );
}
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-[#e5f3ef] px-2 py-1 text-[11px] font-semibold text-[#17695d]">
      {children}
    </span>
  );
}
function Priority({ value }: { value: string }) {
  const style =
    value === 'urgent'
      ? 'bg-[#fde7e9] text-[#ad3844]'
      : value === 'high'
        ? 'bg-[#fff0d7] text-[#9a641b]'
        : 'bg-[#e5f3ef] text-[#17695d]';
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${style}`}
    >
      {value}
    </span>
  );
}
function Action({
  children,
  onClick,
  icon,
  secondary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
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
function LoadingShell() {
  return (
    <div className="mt-6 grid gap-4">
      <div className="h-24 animate-pulse rounded-2xl bg-white" />
      <div className="h-64 animate-pulse rounded-2xl bg-white" />
    </div>
  );
}
function AccessPending({ session }: { session?: Session }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7f5] p-6 text-[#19312c]">
      <section className="max-w-md rounded-2xl border border-[#dce6e0] bg-white p-6">
        <h1 className="text-lg font-semibold">รอสิทธิ์เข้าใช้งานคลินิก</h1>
        <p className="mt-2 text-sm text-[#52665e]">
          บัญชีนี้ยังไม่มี clinic membership ที่ active กรุณาติดต่อผู้ดูแลคลินิกเพื่อส่งคำเชิญ
        </p>
        {session?.systemAdmin && (
          <Link
            href="/system"
            className="mt-4 inline-block rounded-lg bg-[#197365] px-3 py-2 text-sm text-white"
          >
            ไปที่ Platform Admin
          </Link>
        )}
        <div className="mt-4">
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
function roleLabel(role?: Role) {
  return (
    {
      clinic_admin: 'Clinic Admin',
      care_coordinator: 'Care Coordinator',
      nurse: 'Nurse',
      viewer: 'Viewer',
    } as Record<Role, string>
  )[role ?? 'viewer'];
}
