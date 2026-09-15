'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarWorkspace } from '@/components/calendar/calendar-workspace';
import { SignOutButton } from '@/components/auth/sign-out-button';

type View = 'cases' | 'tasks' | 'appointments' | 'calendar';
type CaseRow = { id: string; case_number: string; state: string; source_received_at: string; patients: { full_name: string }[] };
type TaskRow = { id: string; case_id: string; due_at: string; status: string; cases: { case_number: string; patients: { full_name: string }[] }[] };
type AppointmentRow = { id: string; case_id: string; starts_at: string; appointment_type: string; status: string; cases: { case_number: string; patients: { full_name: string }[] }[] };
type ReferenceData = { sources: { id: string; label: string }[]; plans: { id: string; name: string }[] };

const first = <T,>(items: T[] | null | undefined) => items?.[0];
const display = (value: string) => new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value));
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  const response = await fetch(url, { ...init, headers });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'ไม่สามารถดำเนินการได้');
  return body as T;
}

export function LiveWorkspace() {
  const [view, setView] = useState<View>('cases');
  const [cases, setCases] = useState<CaseRow[]>([]); const [tasks, setTasks] = useState<TaskRow[]>([]); const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [reference, setReference] = useState<ReferenceData>({ sources: [], plans: [] });
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string>(); const [notice, setNotice] = useState<string>();
  const refresh = useCallback(async () => {
    try {
      const [nextCases, nextTasks, nextAppointments, nextReference] = await Promise.all([api<CaseRow[]>('/api/cases'), api<TaskRow[]>('/api/follow-up-tasks'), api<AppointmentRow[]>('/api/appointments'), api<ReferenceData>('/api/reference-data')]);
      setCases(nextCases); setTasks(nextTasks); setAppointments(nextAppointments); setReference(nextReference); setError(undefined);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'ไม่สามารถโหลดข้อมูลได้'); } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const requestId = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(requestId);
  }, [refresh]);
  const save = async (work: () => Promise<unknown>) => { try { await work(); setNotice('บันทึกข้อมูลแล้ว'); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'ไม่สามารถบันทึกข้อมูลได้'); } };

  return <main className="min-h-screen bg-[#f4f7f5] text-[#19312c]"><header className="flex items-center justify-between border-b border-[#dbe5df] bg-white px-5 py-3"><div><b>Care D Clinic</b><p className="text-xs text-[#71847b]">ระบบประสานการดูแลผู้ป่วย</p></div><SignOutButton /></header><div className="mx-auto max-w-7xl p-5 md:p-8"><nav className="flex flex-wrap gap-2">{([['cases', 'เคสผู้ป่วย'], ['tasks', 'คิวติดตาม'], ['appointments', 'นัดหมาย'], ['calendar', 'ปฏิทิน']] as [View, string][]).map(([key, label]) => <button key={key} onClick={() => setView(key)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === key ? 'bg-[#197365] text-white' : 'bg-white text-[#52665e]'}`}>{label}</button>)}<button onClick={() => void refresh()} className="ml-auto rounded-lg border border-[#d6e2dc] px-3 py-2 text-sm">รีเฟรช</button></nav>{error && <p role="alert" className="mt-4 rounded-lg bg-[#fff4e5] p-3 text-sm text-[#9a641b]">{error}</p>}{notice && <p className="mt-4 rounded-lg bg-[#eaf6f1] p-3 text-sm text-[#17695d]">{notice}</p>}{loading ? <p className="mt-5 text-sm text-[#71847b]">กำลังโหลดข้อมูล…</p> : <>{view === 'cases' && <Cases cases={cases} reference={reference} save={save} />}{view === 'tasks' && <Tasks tasks={tasks} save={save} />}{view === 'appointments' && <Appointments cases={cases} appointments={appointments} save={save} />}{view === 'calendar' && <CalendarWorkspace onOpenCase={() => setView('cases')} />}</>}</div></main>;
}

function Cases({ cases, reference, save }: { cases: CaseRow[]; reference: ReferenceData; save: (work: () => Promise<unknown>) => void }) {
  const [fullName, setFullName] = useState(''); const [phone, setPhone] = useState(''); const [sourceId, setSourceId] = useState(''); const [planId, setPlanId] = useState('');
  const submit = (event: { preventDefault(): void }) => { event.preventDefault(); save(() => api('/api/cases', { method: 'POST', body: JSON.stringify({ patientDecision: { kind: 'create', patient: { fullName, phone } }, sourceId: sourceId || undefined, planId: planId || undefined, sourceReceivedAt: new Date().toISOString(), priority: 'normal' }) })); };
  return <section className="mt-5 grid gap-5 lg:grid-cols-[360px_1fr]"><form onSubmit={submit} className="h-fit rounded-2xl border border-[#dce6e0] bg-white p-5"><h1 className="font-semibold">ลงทะเบียนเคสใหม่</h1><Field label="ชื่อผู้ป่วย"><input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field><Field label="โทรศัพท์"><input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field><Field label="แหล่งที่มา"><select value={sourceId} onChange={(e) => setSourceId(e.target.value)}><option value="">ไม่ระบุ</option>{reference.sources.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field><Field label="แผนติดตาม"><select value={planId} onChange={(e) => setPlanId(e.target.value)}><option value="">ไม่เลือก</option>{reference.plans.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><button className="mt-5 w-full rounded-lg bg-[#197365] py-2 text-sm font-semibold text-white">บันทึกเคส</button></form><Table headers={['เลขเคส', 'ผู้ป่วย', 'สถานะ', 'รับเรื่อง']} rows={cases.map((item) => [item.case_number, first(item.patients)?.full_name ?? '-', item.state, display(item.source_received_at)])} empty="ยังไม่มีเคส" /></section>;
}

function Tasks({ tasks, save }: { tasks: TaskRow[]; save: (work: () => Promise<unknown>) => void }) {
  const [taskId, setTaskId] = useState(''); const [summary, setSummary] = useState('');
  const submit = (event: { preventDefault(): void }) => { event.preventDefault(); save(() => api('/api/follow-up-results', { method: 'POST', body: JSON.stringify({ taskId, occurredAt: new Date().toISOString(), contactChannel: 'phone', contactStatus: 'contacted', outcome: 'ติดตามแล้ว', summary }) })); };
  return <section className="mt-5 grid gap-5 lg:grid-cols-[360px_1fr]"><form onSubmit={submit} className="h-fit rounded-2xl border border-[#dce6e0] bg-white p-5"><h1 className="font-semibold">บันทึกผลติดตาม</h1><Field label="งานติดตาม"><select required value={taskId} onChange={(e) => setTaskId(e.target.value)}><option value="">เลือกงาน</option>{tasks.map((item) => <option key={item.id} value={item.id}>{first(item.cases)?.case_number ?? item.id} · {display(item.due_at)}</option>)}</select></Field><Field label="สรุปผล"><textarea required value={summary} onChange={(e) => setSummary(e.target.value)} /></Field><button className="mt-5 w-full rounded-lg bg-[#197365] py-2 text-sm font-semibold text-white">บันทึกผล</button></form><Table headers={['เคส', 'ผู้ป่วย', 'กำหนด', 'สถานะ']} rows={tasks.map((item) => [first(item.cases)?.case_number ?? '-', first(first(item.cases)?.patients)?.full_name ?? '-', display(item.due_at), item.status])} empty="ไม่มีงานติดตาม" /></section>;
}

function Appointments({ cases, appointments, save }: { cases: CaseRow[]; appointments: AppointmentRow[]; save: (work: () => Promise<unknown>) => void }) {
  const [caseId, setCaseId] = useState(''); const [startsAt, setStartsAt] = useState(''); const [appointmentType, setAppointmentType] = useState('');
  const submit = (event: { preventDefault(): void }) => { event.preventDefault(); save(() => api('/api/appointments', { method: 'POST', body: JSON.stringify({ caseId, startsAt: new Date(startsAt).toISOString(), appointmentType }) })); };
  return <section className="mt-5 grid gap-5 lg:grid-cols-[360px_1fr]"><form onSubmit={submit} className="h-fit rounded-2xl border border-[#dce6e0] bg-white p-5"><h1 className="font-semibold">สร้างนัดหมาย</h1><Field label="เคส"><select required value={caseId} onChange={(e) => setCaseId(e.target.value)}><option value="">เลือกเคส</option>{cases.map((item) => <option key={item.id} value={item.id}>{item.case_number} · {first(item.patients)?.full_name}</option>)}</select></Field><Field label="วันและเวลา"><input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></Field><Field label="ประเภทนัด"><input required value={appointmentType} onChange={(e) => setAppointmentType(e.target.value)} /></Field><button className="mt-5 w-full rounded-lg bg-[#197365] py-2 text-sm font-semibold text-white">บันทึกนัดหมาย</button></form><Table headers={['เคส', 'ผู้ป่วย', 'วันนัด', 'สถานะ']} rows={appointments.map((item) => [first(item.cases)?.case_number ?? '-', first(first(item.cases)?.patients)?.full_name ?? '-', display(item.starts_at), item.status])} empty="ยังไม่มีนัดหมาย" /></section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="mt-3 block text-sm">{label}<span className="mt-1 block [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:p-2 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:p-2 [&_textarea]:min-h-24 [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:p-2">{children}</span></label>; }
function Table({ headers, rows, empty }: { headers: string[]; rows: string[][]; empty: string }) { return <div className="overflow-hidden rounded-2xl border border-[#dce6e0] bg-white"><table className="w-full text-left text-sm"><thead className="bg-[#f6faf8]"><tr>{headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3">{cell}</td>)}</tr>)}</tbody></table>{!rows.length && <p className="p-5 text-sm text-[#71847b]">{empty}</p>}</div>; }
