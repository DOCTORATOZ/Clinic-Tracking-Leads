'use client';
import { useEffect, useRef, useState } from 'react';
type Staff = { user_id: string; display_name: string };
type Task = {
  id: string;
  status: string;
  due_at: string;
  step_snapshot: { instruction?: string; label?: string };
};
type Appointment = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  appointment_type: string;
  provider_name: string | null;
  branch: string | null;
  updated_at: string;
};
type Cycle = {
  id: string;
  plan_id: string;
  anchor_date: string;
  revision: number;
};
type Result = {
  id: string;
  occurred_at: string;
  outcome: string;
  coordination_summary: string;
  correction_reason: string | null;
  corrects_result_id: string | null;
  reported_by: string | null;
  recorded_by: string;
};
type Detail = {
  case: {
    id: string;
    patient_id: string;
    case_number: string;
    intake_title: string;
    coordination_note: string;
    lifecycle: string;
    care_stage: string;
    revision: number;
    selected_plan_id: string | null;
    priority: string;
    anchor_review_required:boolean;
    patients:
      | { full_name: string; contact_permission: string }
      | { full_name: string; contact_permission: string }[];
  };
  tasks: Task[];
  appointments: Appointment[];
  cycles: Cycle[];
  results: Result[];
  clinical?: { concern: string };
  clinicalResults?: {result_id:string;clinical_summary:string|null;symptom_status:string|null}[];
  assignments: { id: string; assigned_to: string; assigned_at: string }[];
  appointmentHistory: {
    id: string;
    previous_status: string;
    next_status: string;
    reason: string;
    changed_at: string;
  }[];
};
type Action =
  | 'edit'
  | 'assign'
  | 'activate'
  | 'anchor'
  | 'task'
  | 'task_status'
  | 'result'
  | 'correction'
  | 'appointment'
  | 'appointment_status'
  | 'close'
  | 'reopen'
  | 'pause'
  | 'resume';
const style =
  'mt-1 w-full rounded-lg border border-[#cfded7] bg-white px-3 py-2 text-sm';
const thaiErrors: Record<string, string> = {
  UNRESOLVED_WORK: 'ยังมีงานหรือนัดค้าง กรุณาทบทวนแต่ละรายการก่อนปิดเคส',
  CONTACT_NOT_PERMITTED: 'ยังไม่มีสิทธิ์ติดต่อออก กรุณาตรวจสอบสถานะสิทธิ์ติดต่อในทะเบียนบุคคล',
  STALE_WRITE: 'ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดข้อมูลล่าสุด',
  STALE_PREVIEW: 'รายการงานเปลี่ยนไป กรุณาตรวจตัวอย่างใหม่',
  NURSE_REPORTER_REQUIRED: 'กรุณาระบุ Nurse ผู้รายงาน',
  CASE_NOT_OPEN: 'เคสนี้ไม่อยู่ในสถานะเปิด',
  INVALID_TRANSITION: 'ไม่สามารถเปลี่ยนสถานะนี้ได้',
  APPOINTMENT_COLLISION: 'เวลานัดทับกับผู้ให้บริการ กรุณาตรวจสอบและระบุเหตุผล',
  TERMINAL_TASK: 'งานนี้สิ้นสุดแล้ว ไม่สามารถแก้ประวัติเดิม',
  FORBIDDEN: 'ไม่มีสิทธิ์ดำเนินการ',
};
const date = (value: string) =>
  new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
const utc = (value: string) => new Date(`${value}:00+07:00`).toISOString();

export function CaseWorkflow({
  id,
  role,
  nurses,
  plans,
  refreshWorkspace,
}: {
  id?: string;
  role?: string;
  nurses: Staff[];
  plans: { id: string; name: string }[];
  refreshWorkspace: () => Promise<void>;
}) {
  const [detail, setDetail] = useState<Detail>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loadedKey, setLoadedKey] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [action, setAction] = useState<Action>();
  const [target, setTarget] = useState('');
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<Record<string, unknown>>();
  const [formError, setFormError] = useState('');
  const [withAppointment,setWithAppointment]=useState(false);
  const [withRetry,setWithRetry]=useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const key = useRef('');
  const requestKey = `${id}:${revision}`;
  const loading = loadedKey !== requestKey;
  useEffect(() => {
    if (!id) return;
    const control = new AbortController();
    fetch(`/api/cases/${id}`, { signal: control.signal })
      .then(async (response) => {
        const data = await response.json();
        if (control.signal.aborted) return;
        if (!response.ok) throw new Error(data.error);
        setError('');
        setDetail(data);
      })
      .catch((reason) => {
        if (!control.signal.aborted) setError(reason.message);
      })
      .finally(() => {
        if (!control.signal.aborted) setLoadedKey(requestKey);
      });
    return () => control.abort();
  }, [id, revision, requestKey]);
  useEffect(() => {
    if (action) dialog.current?.showModal();
  }, [action]);
  function open(next: Action, selected = '') {
    setAction(next);
    setTarget(selected);
    setPreview(undefined);
    setFormError('');
    setWithAppointment(false);setWithRetry(false);
    key.current = crypto.randomUUID();
  }
  async function call(url: string, method: string, body: unknown) {
    const response = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.fieldErrors?Object.values(data.fieldErrors).join(' · '):thaiErrors[data.error] ?? data.error ?? 'บันทึกไม่สำเร็จ');
    return data;
  }
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !detail || !id) return;
    lock.current = true;
    setPending(true);
    setFormError('');
    const values = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    ) as Record<string, string>;
    const body: Record<string, unknown> = { ...values, requestId: key.current };
    const base = `/api/cases/${id}`;
    if (!body.reportedBy) delete body.reportedBy;
    try {
      if (action === 'edit')
        await call(base, 'PATCH', {
          ...body,
          expectedRevision: detail.case.revision,
        });
      else if (action === 'assign') await call(`${base}/assign`, 'POST', body);
      else if (action === 'activate')
        await call(`${base}/plans`, 'POST', {
          ...body,
          action: 'activate',
          expectedRevision: detail.case.revision,
        });
      else if (action === 'anchor') {
        if (!preview) {
          setPreview(
            await call(`${base}/plans`, 'POST', {
              action: 'preview',
              cycleId: target,
              anchorDate: values.anchorDate,
            }),
          );
          return;
        }
        await call(`${base}/plans`, 'POST', {
          action: 'revise',
          cycleId: target,
          anchorDate: values.anchorDate,
          reason: values.reason,
          preview,
        });
      } else if (action === 'task')
        await call(`${base}/tasks`, 'POST', {
          ...body,
          dueAt: utc(values.dueAt),
          assignedTo: values.assignedTo || undefined,
        });
      else if (action === 'task_status')
        await call(`/api/follow-up-tasks/${target}`, 'PATCH', {
          ...body,
          dueAt: values.dueAt ? utc(values.dueAt) : undefined,
        });
      else if (action === 'result')
        await call('/api/follow-up-results', 'POST', {
          ...body,
          taskId: target,
          occurredAt: utc(values.occurredAt),
          performedBy: body.reportedBy,
          retryDueAt:withRetry?utc(values.retryDueAt):undefined,
          retryReason:withRetry?values.retryReason:undefined,
          retryAssignedTo:withRetry?values.retryAssignedTo:undefined,
          appointment:withAppointment?{appointmentType:values.appointmentType,startsAt:utc(values.startsAt),endsAt:utc(values.endsAt),reason:values.appointmentReason||undefined}:undefined,
        });
      else if (action === 'correction')
        await call('/api/follow-up-results', 'PATCH', {
          resultId: target,
          reason: values.reason,
          summary: values.summary,
        });
      else if (action === 'appointment')
        await call('/api/appointments', 'POST', {
          ...body,
          caseId: id,
          startsAt: utc(values.startsAt),
          endsAt: utc(values.endsAt),
        });
      else if (action === 'appointment_status')
        await call('/api/appointments', 'PATCH', {
          ...body,
          appointmentId: target,
          expectedUpdatedAt: detail.appointments.find(
            (item) => item.id === target,
          )?.updated_at,
          startsAt: values.startsAt ? utc(values.startsAt) : undefined,
          endsAt: values.endsAt ? utc(values.endsAt) : undefined,
        });
      else
        await call(`${base}/lifecycle`, 'POST', {
          ...body,
          action,
          reason:
            action === 'close'
              ? `${values.closureReason}: ${values.reason}`
              : values.reason,
          expectedRevision: detail.case.revision,
        });
      setAction(undefined);
      setNotice('บันทึกแล้ว');
      setRevision(revision + 1);
      await refreshWorkspace();
    } catch (reason) {
      setFormError(
        reason instanceof Error ? reason.message : 'บันทึกไม่สำเร็จ ข้อมูลยังอยู่',
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  const field = (
    name: string,
    label: string,
    type = 'text',
    required = true,
    value?: string,
  ) => (
    <label className="block text-sm">
      {label}
      <input
        className={style}
        name={name}
        type={type}
        required={required}
        defaultValue={value}
      />
    </label>
  );
  const select = (
    name: string,
    label: string,
    items: { value: string; label: string }[],
    required = true,
  ) => (
    <div className="text-sm">
      <label htmlFor={`case-action-${name}`}>{label}</label>
      <select
        id={`case-action-${name}`}
        className={style}
        name={name}
        required={required}
      >
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
  const nurseOptions = [
    { value: '', label: role === 'nurse' ? 'ตัวฉันเอง' : 'เลือก Nurse' },
    ...nurses.map((n) => ({ value: n.user_id, label: n.display_name })),
  ];
  const button = (label: string, next: Action, selected = '') => (
    <button
      type="button"
      className="rounded-lg border border-[#cfded7] bg-white px-3 py-2 text-sm"
      onClick={() => open(next, selected)}
    >
      {label}
    </button>
  );
  if (!id) return <p className="mt-6">เลือกเคสที่ต้องการดู</p>;
  if (loading)
    return (
      <output className="mt-6 block">
        กำลังโหลดรายละเอียดเคส…
      </output>
    );
  if (error || !detail)
    return (
      <p role="alert" className="mt-6">
        {error || 'ไม่พบเคส'}{' '}
        <button onClick={() => setRevision(revision + 1)}>ลองใหม่</button>
      </p>
    );
  const editable = role === 'clinic_admin' || role === 'care_coordinator';
  const writable = editable || role === 'nurse';
  const active = detail.case.lifecycle === 'open';
  const patient = Array.isArray(detail.case.patients)
    ? detail.case.patients[0]
    : detail.case.patients;
  return (
    <section className="mt-6 space-y-5">
      <div className="rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-semibold">
          {patient?.full_name} · {detail.case.case_number}
        </h2>
        <p className="mt-2">
          {detail.case.intake_title || 'รอเติมหัวข้อเคส'} · {detail.case.lifecycle}{' '}
          · {detail.case.care_stage}
        </p>
        <p className="mt-2 text-sm">{detail.case.coordination_note}</p>
        {detail.case.anchor_review_required&&<p className="mt-3 rounded bg-amber-50 p-3 text-sm">วันเริ่มแผนเดิมรอตรวจสอบ — ระบบไม่เดาวันเหตุการณ์และไม่เลื่อนงานย้อนหลัง</p>}
        {patient?.contact_permission !== 'granted' && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm">
            ระงับการติดต่อออก: ยังไม่ยืนยันสิทธิ์ หรือไม่ประสงค์ให้ติดต่อ
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {editable && detail.case.lifecycle !== 'closed' && (
            <>
              {button('แก้ไขเคส', 'edit')}
              {button('มอบหมาย Nurse', 'assign')}
            </>
          )}
          {writable && active && (
            <>
              {button('เริ่มรอบแผน', 'activate')}
              {button('พักเคส', 'pause')}
              {button('ปิดเคส', 'close')}
            </>
          )}
          {writable &&
            detail.case.lifecycle === 'paused' &&
            button('กลับมาดำเนินการ', 'resume')}
          {role === 'clinic_admin' &&
            detail.case.lifecycle === 'closed' &&
            button('เปิดเคสกลับ', 'reopen')}
        </div>
      </div>
      {notice && <output className="block">{notice}</output>}
      {detail.clinical && (
        <section className="rounded-2xl border bg-white p-5">
          <h3 className="font-semibold">ข้อมูลทางคลินิก — จำกัดสิทธิ์</h3>
          <p>{detail.clinical.concern}</p>
        </section>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5">
          <h3 className="font-semibold">รอบแผน</h3>
          {!detail.cycles.length && (
            <p className="my-3 text-sm">ยังไม่มีรอบแผนที่ยืนยันวันเริ่ม</p>
          )}
          {detail.cycles.map((cycle) => (
            <article key={cycle.id} className="mt-3 border-t pt-3">
              <p>
                {plans.find((p) => p.id === cycle.plan_id)?.name ?? 'แผนเดิม'} ·
                วันเริ่ม {cycle.anchor_date}
              </p>
              {writable &&
                active &&
                button('ตรวจและแก้วันเริ่ม', 'anchor', cycle.id)}
            </article>
          ))}
        </section>
        <section className="rounded-2xl border bg-white p-5">
          <h3 className="font-semibold">งานติดตาม</h3>
          {editable && active && button('เพิ่มงาน / retry', 'task')}
          {detail.tasks.map((task) => (
            <article key={task.id} className="mt-3 border-t pt-3 text-sm">
              <b>
                {task.step_snapshot.label ??
                  task.step_snapshot.instruction ??
                  'งานติดตาม'}
              </b>
              <p>
                {date(task.due_at)} · {task.status}
              </p>
              <div className="mt-2 flex gap-2">
                {writable &&
                  active &&
                  !['completed', 'cancelled', 'skipped'].includes(
                    task.status,
                  ) &&
                  button('บันทึกผล', 'result', task.id)}
                {editable &&
                  !['completed', 'cancelled', 'skipped'].includes(
                    task.status,
                  ) &&
                  button('จัดการงาน', 'task_status', task.id)}
              </div>
            </article>
          ))}
        </section>
      </div>
      <section className="rounded-2xl border bg-white p-5">
        <h3 className="font-semibold">นัดหมาย</h3>
        {editable && active && button('เพิ่มนัดหมาย', 'appointment')}
        {detail.appointments.map((appt) => (
          <article key={appt.id} className="mt-3 border-t pt-3 text-sm">
            <b>{appt.appointment_type}</b>
            <p>
              {date(appt.starts_at)} · {appt.status} · {appt.provider_name}
            </p>
            {editable &&
              detail.case.lifecycle !== 'closed' &&
              button('เลื่อน / เปลี่ยนสถานะ', 'appointment_status', appt.id)}
          </article>
        ))}
      </section>
      <section className="rounded-2xl border bg-white p-5">
        <h3 className="font-semibold">ผลติดตามและประวัติ</h3>
        {detail.results.map((result) => (
          <article key={result.id} className="mt-3 border-t pt-3 text-sm">
            <p>
              {date(result.occurred_at)} · {result.outcome}
            </p>
            <p>{result.coordination_summary}</p>
            {detail.clinicalResults?.filter(r=>r.result_id===result.id).map(r=><p key={r.result_id} className="my-2 rounded bg-[#edf5f1] p-3">รายละเอียดทางคลินิก (จำกัดสิทธิ์): {r.clinical_summary}</p>)}
            <p className="text-xs">
              ผู้รายงาน:{' '}
              {nurses.find((n) => n.user_id === result.reported_by)
                ?.display_name ??
                result.reported_by ??
                'ไม่ได้ระบุ'}{' '}
              · ผู้บันทึก: {result.recorded_by}
            </p>
            {result.corrects_result_id && (
              <p>บันทึกเพิ่มเติม: {result.correction_reason}</p>
            )}
            {writable &&
              button('เพิ่มคำแก้ไข (เก็บต้นฉบับ)', 'correction', result.id)}
          </article>
        ))}
        {detail.assignments.map((item) => (
          <p key={item.id} className="mt-3 text-sm">
            {date(item.assigned_at)} · มอบหมาย Nurse{' '}
            {nurses.find((n) => n.user_id === item.assigned_to)?.display_name ??
              item.assigned_to}
          </p>
        ))}
        {detail.appointmentHistory.map((item) => (
          <p key={item.id} className="mt-3 text-sm">
            {date(item.changed_at)} · นัดหมาย {item.previous_status} →{' '}
            {item.next_status} · {item.reason}
          </p>
        ))}
      </section>
      {action && (
        <dialog
          ref={dialog}
          aria-label="จัดการเคส"
          onCancel={(event) => {
            event.preventDefault();
            if (!pending) setAction(undefined);
          }}
          className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-6 backdrop:bg-black/30"
        >
          <form onSubmit={submit}>
            <h3 className="font-semibold">
              จัดการเคส · {detail.case.case_number}
            </h3>
            {formError && (
              <p role="alert" className="my-3 rounded bg-amber-50 p-3">
                {formError}
              </p>
            )}
            <fieldset disabled={pending} className="mt-4 space-y-4">
              {action === 'edit' && (
                <>
                  {field(
                    'title',
                    'หัวข้อ',
                    'text',
                    true,
                    detail.case.intake_title,
                  )}
                  {field(
                    'coordinationNote',
                    'ข้อมูลประสานงาน',
                    'text',
                    false,
                    detail.case.coordination_note,
                  )}
                  {select('careStage', 'ช่วงการดูแล', [
                    { value: detail.case.care_stage, label: 'คงช่วงเดิม' },
                    { value: 'assessment', label: 'ประเมิน' },
                    { value: 'preparation', label: 'เตรียมหัตถการ' },
                    { value: 'post_procedure', label: 'ติดตามหลังทำ' },
                  ])}
                </>
              )}
              {action === 'assign' &&
                select('nurseId', 'Nurse ที่รับมอบหมาย', nurseOptions)}
              {action === 'activate' && (
                <>
                  {select(
                    'planId',
                    'แผน',
                    plans.map((p) => ({ value: p.id, label: p.name })),
                  )}
                  {field('anchorDate', 'วันเกิดเหตุการณ์จริง', 'date')}
                  {select('eventKind', 'เหตุการณ์', [
                    { value: 'assessment', label: 'ประเมิน' },
                    { value: 'procedure', label: 'ทำหัตถการ' },
                    { value: 'care_start', label: 'เริ่มดูแล' },
                  ])}
                  {select(
                    'reportedBy',
                    'Nurse ผู้ยืนยัน / ให้คำสั่ง',
                    nurseOptions,
                    role !== 'nurse',
                  )}
                </>
              )}
              {action === 'anchor' && (
                <>
                  {field(
                    'anchorDate',
                    'วันเกิดเหตุการณ์จริงที่แก้ไข',
                    'date',
                    true,
                    detail.cycles.find((c) => c.id === target)?.anchor_date,
                  )}
                  {preview && (
                    <div className="rounded bg-[#f0f7f4] p-3 text-sm">
                      <b>ตรวจผลกระทบก่อนยืนยัน</b>
                      {(
                        preview.tasks as {
                          id: string;
                          status: string;
                          willChange: boolean;
                          previousDueAt: string;
                          nextDueAt: string;
                        }[]
                      ).map((t) => (
                        <p key={t.id}>
                          {t.status}: {date(t.previousDueAt)} →{' '}
                          {t.willChange ? date(t.nextDueAt) : 'คงเดิม'}
                        </p>
                      ))}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => setPreview(undefined)}
                      >
                        คำนวณใหม่
                      </button>
                    </div>
                  )}
                </>
              )}
              {action === 'task' && (
                <>
                  {field('label', 'งานที่ต้องทำ')}
                  {field('dueAt', 'กำหนดเวลาไทย', 'datetime-local')}
                  {select('assignedTo', 'มอบหมาย', nurseOptions)}
                </>
              )}
              {action === 'task_status' && (
                <>
                  {select('status', 'สถานะ', [
                    { value: 'paused', label: 'พัก' },
                    { value: 'pending', label: 'รอดำเนินการ' },
                    { value: 'in_progress', label: 'กำลังทำ' },
                    { value: 'cancelled', label: 'ยกเลิก' },
                  ])}
                  {field(
                    'dueAt',
                    'กำหนดใหม่ (ถ้าต้องการ)',
                    'datetime-local',
                    false,
                  )}
                </>
              )}
              {action === 'result' && (
                <>
                  {field(
                    'occurredAt',
                    'วันเวลาเกิดเหตุการณ์ · เวลาไทย',
                    'datetime-local',
                  )}
                  {select('contactChannel', 'ช่องทาง', [
                    { value: 'phone', label: 'โทรศัพท์' },
                    { value: 'line_oa', label: 'LINE' },
                    { value: 'facebook', label: 'Facebook' },
                  ])}
                  {select('contactStatus', 'ผลการติดต่อ', [
                    { value: 'contacted', label: 'ติดต่อสำเร็จ' },
                    { value: 'no_answer', label: 'ไม่รับสาย' },
                    { value: 'wrong_number', label: 'เบอร์ผิด' },
                    { value: 'declined', label: 'ปฏิเสธ' },
                  ])}
                  {field('outcome', 'ผลลัพธ์')}
                  {field('summary', 'สรุปที่ใช้ประสานงานได้')}
                  {select(
                    'reportedBy',
                    'Nurse ผู้รายงาน',
                    nurseOptions,
                    role !== 'nurse',
                  )}
                  {role === 'nurse' &&
                    field(
                      'clinicalSummary',
                      'รายละเอียดทางคลินิก (จำกัดสิทธิ์)',
                      'text',
                      false,
                    )}
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={withRetry} onChange={e=>setWithRetry(e.target.checked)}/>สร้างงานติดต่อใหม่อย่างชัดเจน</label>
                  {withRetry&&<>{field('retryDueAt','วันติดต่อใหม่ · เวลาไทย','datetime-local')}{field('retryReason','เหตุผลสร้างงานใหม่')}{select('retryAssignedTo','ผู้รับผิดชอบงานใหม่',nurseOptions)}</>}
                  {editable&&<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={withAppointment} onChange={e=>setWithAppointment(e.target.checked)}/>บันทึกผลพร้อมสร้างนัด (สำเร็จร่วมกัน)</label>}
                  {withAppointment&&<>{field('appointmentType','ประเภทนัด')}{field('startsAt','เริ่ม · เวลาไทย','datetime-local')}{field('endsAt','สิ้นสุด · เวลาไทย','datetime-local')}{field('appointmentReason','คำสั่ง Nurse / รายละเอียดนัด','text',true)}</>}
                </>
              )}
              {action === 'correction' && field('summary', 'สรุปเพิ่มเติม / แก้ไข')}
              {action === 'appointment' && (
                <>
                  {field('appointmentType', 'ประเภทนัด')}
                  {field('startsAt', 'เริ่ม · เวลาไทย', 'datetime-local')}
                  {field('endsAt', 'สิ้นสุด · เวลาไทย', 'datetime-local')}
                  {field('providerName', 'ผู้ให้บริการ', 'text', false)}
                  {field('branch', 'สาขา', 'text', false)}
                </>
              )}
              {action === 'appointment_status' && (
                <>
                  {select('status', 'สถานะ', [
                    { value: 'rescheduled', label: 'เลื่อนนัด' },
                    { value: 'completed', label: 'เสร็จสิ้น' },
                    { value: 'cancelled', label: 'ยกเลิก' },
                    { value: 'no_show', label: 'ไม่มาตามนัด' },
                  ])}
                  {field(
                    'startsAt',
                    'วันเริ่มใหม่ (เมื่อเลื่อน)',
                    'datetime-local',
                    false,
                  )}
                  {field(
                    'endsAt',
                    'วันสิ้นสุดใหม่ (เมื่อเลื่อน)',
                    'datetime-local',
                    false,
                  )}
                </>
              )}
              {action === 'close' && (
                <>
                  <div className="rounded bg-amber-50 p-3 text-sm"><b>รายการค้างที่ต้องตัดสินใจก่อนปิด</b>{detail.tasks.filter(t=>!['completed','cancelled','skipped'].includes(t.status)).map(t=><p key={t.id}>งาน: {t.step_snapshot.label??t.step_snapshot.instruction??'ติดตาม'} · {date(t.due_at)}</p>)}{detail.appointments.filter(a=>['scheduled','rescheduled'].includes(a.status)).map(a=><p key={a.id}>นัด: {a.appointment_type} · {date(a.starts_at)}</p>)}<p>ปิดหน้าต่างนี้เพื่อจัดการแต่ละรายการ ไม่ใช้ “เสร็จสิ้น” แทนการยกเลิกงานที่ไม่ได้ทำ</p></div>
                  {select('closureReason', 'เหตุผลปิด', [
                    { value: 'care_completed', label: 'จบการดูแล' },
                    { value: 'not_interested', label: 'ไม่ประสงค์รับบริการต่อ' },
                    { value: 'unreachable', label: 'ติดต่อไม่ได้' },
                    { value: 'referred', label: 'ส่งต่อ' },
                    { value: 'cancelled', label: 'ยกเลิก' },
                    { value: 'other', label: 'อื่น ๆ' },
                  ])}
                  {select(
                    'reportedBy',
                    'Nurse ผู้ยืนยันกรณีจบการดูแล',
                    nurseOptions,
                    false,
                  )}
                  <p className="text-sm">
                    ต้องจัดการงานและนัดที่ยังค้างก่อน ระบบจะไม่ยกเลิกให้อัตโนมัติ
                  </p>
                </>
              )}
              {!['result'].includes(action) &&
                field(
                  'reason',
                  action === 'activate'
                    ? 'คำสั่ง / เหตุผลเริ่มแผน'
                    : 'เหตุผล / รายละเอียด',
                  'text',
                  action !== 'appointment',
                )}
            </fieldset>
            <div className="mt-5 flex justify-between">
              <button
                type="button"
                disabled={pending}
                onClick={() => setAction(undefined)}
              >
                ยกเลิก
              </button>
              <button
                disabled={pending}
                className="rounded-lg bg-[#197365] px-4 py-2 text-white"
              >
                {pending
                  ? 'กำลังบันทึก…'
                  : action === 'anchor' && !preview
                    ? 'ดูผลกระทบ'
                    : 'ยืนยันบันทึก'}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  );
}
