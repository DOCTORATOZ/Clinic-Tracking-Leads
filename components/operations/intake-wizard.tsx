'use client';
import { useEffect, useRef, useState } from 'react';
import {
  intakePatientSchema,
  intakeCaseSchema,
  intakeSchema,
  type IntakeResult,
} from '@/lib/validation/intake';

export type DirectoryPerson = {
  id: string;
  fullName: string;
  hn: string | null;
  phone: string | null;
  socialAccount: string | null;
  contactPermission: string;
  intakeStatus: string | null;
  nextContactAt: string | null;
  ownerId?: string;
  caseIds: string[];
};
type References = {
  sources: { id: string; label: string }[];
  services: {
    id: string;
    name: string;
    default_follow_up_plan_id?: string | null;
  }[];
  plans: { id: string; name: string }[];
  nurses: { user_id: string; display_name: string }[];
  staff?: {user_id:string;display_name:string;role:string}[];
};
const initial = {
  fullName: '',
  hn: '',
  phone: '',
  socialPlatform: '',
  socialAccount: '',
  representativeName: '',
  representativeRelationship: '',
  preferredContactChannel: '',
  contactPermission: 'unknown',
  nextContactAt: '',
  ownerId: '',
  title: '',
  coordinationNote: '',
  sourceId: '',
  serviceId: '',
  planId: '',
  planOverrideReason: '',
  assignedTo: '',
  priority: 'normal',
  duplicateReason: '',
};
type FieldName = keyof typeof initial;
const inputClass =
  'mt-1 w-full rounded-lg border border-[#cfded7] bg-white px-3 py-2 text-sm';
const friendly: Record<string, string> = {
  HN_ALREADY_EXISTS: 'HN นี้มีอยู่แล้ว เลือกบุคคลเดิม หรือแก้/เว้น HN ของคนใหม่',
  DUPLICATE_DECISION_REQUIRED:
    'พบข้อมูลซ้ำ กรุณาตรวจสอบอีกครั้งและระบุเหตุผลหากสร้างคนใหม่',
  PLAN_OVERRIDE_REASON_REQUIRED: 'ระบุเหตุผลที่เลือกแผนต่างจากค่าเริ่มต้น',
  INVALID_REFERENCE: 'รายการหรือบุคลากรเปลี่ยนไป กรุณาโหลดข้อมูลล่าสุด',
  FORBIDDEN: 'ไม่มีสิทธิ์ดำเนินการในคลินิกนี้',
  VALIDATION_ERROR: 'กรุณาตรวจข้อมูลที่ระบุ',
};

export function IntakeWizard({
  reference,
  close,
  saved,
  openCase,
  person,
}: {
  reference: References;
  close: () => void;
  saved: (result: IntakeResult) => Promise<void>;
  openCase: (id: string) => void;
  person?: DirectoryPerson;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const sent = useRef<{ body: string; requestId: string } | null>(null);
  const [fields, setFields] = useState(initial);
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState(person);
  const [matches, setMatches] = useState<DirectoryPerson[]>([]);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [discard, setDiscard] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const service = reference.services.find(
    (item) => item.id === fields.serviceId,
  );
  const planId =
    fields.planId || service?.default_follow_up_plan_id || undefined;
  const plan = reference.plans.find((item) => item.id === planId);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function update(key: FieldName, value: string) {
    setDirty(true);
    setError('');
    setErrors({});
    setFields((old) => ({
      ...old,
      [key]: value,
      ...(key === 'serviceId' ? { planId: '', planOverrideReason: '' } : {}),
    }));
    if (
      ['hn', 'phone', 'socialPlatform', 'socialAccount', 'fullName'].includes(
        key,
      )
    ) {
      setChecked(false);
      setMatches([]);
      setSelected(undefined);
    }
  }
  function invalid(issues: { path: PropertyKey[]; message: string }[]) {
    const values = Object.fromEntries(
      issues.map((issue) => [String(issue.path.at(-1)), issue.message]),
    );
    setErrors(values);
    requestAnimationFrame(() =>
      document.getElementById(`intake-${Object.keys(values)[0]}`)?.focus(),
    );
  }
  const patientInput = () => ({
    ...fields,
    socialPlatform: fields.socialPlatform || undefined,
    preferredContactChannel: fields.preferredContactChannel || undefined,
  });
  const caseInput = () => ({
    title: fields.title,
    coordinationNote: fields.coordinationNote,
    sourceId: fields.sourceId || undefined,
    serviceId: fields.serviceId || undefined,
    planId,
    planOverrideReason: fields.planOverrideReason || undefined,
    assignedTo: fields.assignedTo || undefined,
    priority: fields.priority,
  });
  async function checkPerson() {
    if (selected) return true;
    const parsed = intakePatientSchema.safeParse(patientInput());
    if (!parsed.success) {
      invalid(parsed.error.issues);
      return false;
    }
    let found = matches;
    if (!checked) {
      const query = new URLSearchParams({
        matches: 'true',
        hn: parsed.data.hn ?? '',
        phone: parsed.data.phone ?? '',
        socialPlatform: fields.socialPlatform,
        socialAccount: fields.socialAccount,
      });
      const response = await fetch(`/api/patients?${query}`);
      if (!response.ok) throw new Error('ตรวจข้อมูลซ้ำไม่สำเร็จ กรุณาลองใหม่ก่อนบันทึก');
      found = await response.json();
      setMatches(found);
      setChecked(true);
    }
    if (found.some((item) => parsed.data.hn && item.hn === parsed.data.hn)) {
      setError(friendly.HN_ALREADY_EXISTS);
      return false;
    }
    if (found.length && !fields.duplicateReason.trim()) {
      invalid([
        {
          path: ['duplicateReason'],
          message: 'เลือกบุคคลเดิม หรือระบุเหตุผลในการสร้างคนใหม่',
        },
      ]);
      return false;
    }
    return true;
  }
  async function send(body: string, requestId: string) {
    let response: Response;
    try {
      response = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...JSON.parse(body), requestId }),
      });
    } catch {
      setUncertain(true);
      throw new Error('ยังยืนยันผลบันทึกไม่ได้ กดลองอีกครั้งด้วยคำขอเดิมเพื่อป้องกันข้อมูลซ้ำ');
    }
    if (response.status >= 500) {
      setUncertain(true);
      throw new Error('ระบบขัดข้อง กดลองอีกครั้งด้วยคำขอเดิมเพื่อยืนยันผล');
    }
    const data = await response.json();
    if (!response.ok) {
      if (data.fieldErrors)
        invalid(
          Object.entries(data.fieldErrors).map(([key, value]) => ({
            path: key.split('.'),
            message: String(value),
          })),
        );
      if (
        data.error === 'DUPLICATE_DECISION_REQUIRED' ||
        data.error === 'HN_ALREADY_EXISTS'
      ) {
        setStep(1);
        setChecked(false);
      }
      setUncertain(false);
      throw new Error(friendly[data.error] ?? data.error ?? 'บันทึกไม่สำเร็จ');
    }
    setUncertain(false);
    setDirty(false);
    await saved(data as IntakeResult);
  }
  async function action(mode: 'next' | 'lead' | 'case') {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setErrors({});
    try {
      if (uncertain && sent.current) {
        await send(sent.current.body, sent.current.requestId);
        return;
      }
      if (step === 1 && !(await checkPerson())) return;
      if (mode === 'next') {
        if (step === 2) {
          const result = intakeCaseSchema.safeParse(caseInput());
          if (!result.success) {
            invalid(result.error.issues);
            return;
          }
          if (
            planId &&
            planId !== service?.default_follow_up_plan_id &&
            !fields.planOverrideReason.trim()
          ) {
            invalid([
              {
                path: ['planOverrideReason'],
                message: friendly.PLAN_OVERRIDE_REASON_REQUIRED,
              },
            ]);
            return;
          }
        }
        setStep(step + 1);
        return;
      }
      const payload = {
        ownerId:fields.ownerId||undefined,
        mode,
        patientDecision: selected
          ? { kind: 'link', patientId: selected.id }
          : {
              kind: 'create',
              patient: patientInput(),
              duplicateReason: fields.duplicateReason || undefined,
            },
        nextContactAt:
          mode === 'lead' && fields.nextContactAt
            ? new Date(`${fields.nextContactAt}:00+07:00`).toISOString()
            : undefined,
        ...(mode === 'case' ? { case: caseInput() } : {}),
      };
      const body = JSON.stringify(payload);
      if (!sent.current || sent.current.body !== body)
        sent.current = { body, requestId: crypto.randomUUID() };
      const parsed = intakeSchema.safeParse({
        ...payload,
        requestId: sent.current.requestId,
      });
      if (!parsed.success) {
        invalid(parsed.error.issues);
        return;
      }
      await send(body, sent.current.requestId);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'บันทึกไม่สำเร็จ ข้อมูลที่กรอกยังอยู่',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function field(
    key: FieldName,
    label: string,
    options?: { value: string; label: string }[],
    type = 'text',
  ) {
    const props = {
      id: `intake-${key}`,
      value: fields[key],
      onChange: (
        event: React.ChangeEvent<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >,
      ) => update(key, event.target.value),
      className: inputClass,
      'aria-invalid': !!errors[key],
      'aria-describedby': errors[key] ? `error-${key}` : undefined,
    };
    return (
      <div>
        <label htmlFor={props.id} className="text-sm font-medium">
          {label}
        </label>
        {options ? (
          <select {...props}>
            {options.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        ) : type === 'textarea' ? (
          <textarea {...props} rows={3} />
        ) : (
          <input {...props} type={type} />
        )}
        {errors[key] && (
          <p id={`error-${key}`} className="mt-1 text-sm text-red-700">
            {errors[key]}
          </p>
        )}
      </div>
    );
  }
  const chooseClose = () => {
    if (!busy) {
      if (dirty) setDiscard(true);
      else close();
    }
  };
  return (
    <dialog
      ref={dialog}
      aria-labelledby="intake-dialog-title"
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]'))
          .filter(node => node.tabIndex >= 0 && !node.matches(':disabled') && node.getClientRects().length > 0);
        const first = controls[0]; const last = controls.at(-1);
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}
      onCancel={(event) => {
        event.preventDefault();
        chooseClose();
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 text-[#193b33] shadow-xl backdrop:bg-[#19312c]/35"
    >
      <div className="flex justify-between">
        <div>
          <h2 id="intake-dialog-title" className="font-semibold">
            เพิ่มลีด / สร้างเคส
          </h2>
          <p className="mt-1 text-xs text-[#6a7d75]">
            ขั้นตอน {step} จาก 3 · ค้นหาบุคคล → รายละเอียดเคส → ตรวจทาน
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={chooseClose}
          aria-label="ปิด"
        >
          ✕
        </button>
      </div>
      {discard ? (
        <div className="mt-5 space-y-4">
          <p>
            {uncertain
              ? 'ผลบันทึกยังไม่แน่นอน ควรลองคำขอเดิมก่อนออก'
              : 'ข้อมูลยังไม่ได้บันทึก ต้องการออกจากฟอร์มหรือไม่?'}
          </p>
          <button className="mr-5" onClick={() => setDiscard(false)}>
            กลับไปกรอกต่อ
          </button>
          <button onClick={close}>ออกจากฟอร์ม</button>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void action(step === 3 ? 'case' : 'next');
          }}
        >
          {error && (
            <p
              role="alert"
              className="my-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
            >
              {error}
            </p>
          )}
          <fieldset disabled={busy || uncertain} className="mt-5 space-y-4">
            {step === 1 && (
              <>
                {selected ? (
                  <div className="rounded-lg bg-[#eef7f3] p-4">
                    <b>ใช้บุคคลเดิม: {selected.fullName}</b>
                    <p className="text-sm">คงข้อมูลและสิทธิ์ติดต่อเดิม ไม่เขียนทับ</p>
                    <button
                      type="button"
                      onClick={() => setSelected(undefined)}
                      className="mt-2 underline"
                    >
                      เปลี่ยนการเลือก
                    </button>
                    {selected.caseIds.map((id, index) => (
                      <button
                        type="button"
                        key={id}
                        onClick={() => {
                          close();
                          openCase(id);
                        }}
                        className="mt-2 block underline"
                      >
                        เปิดเคสเดิม {index + 1} แทนสร้างเคสใหม่
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    {field('fullName', 'ชื่อ / ชื่อแสดง *')}
                    <div className="grid gap-4 sm:grid-cols-2">
                      {field('hn', 'HN (ไม่บังคับ)')}
                      {field('phone', 'โทรศัพท์')}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {field('socialPlatform', 'ช่องทาง social', [
                        { value: '', label: 'ไม่ระบุ' },
                        { value: 'line_oa', label: 'LINE' },
                        { value: 'facebook', label: 'Facebook' },
                        { value: 'tiktok', label: 'TikTok' },
                        { value: 'other', label: 'อื่น ๆ' },
                      ])}
                      {field('socialAccount', 'บัญชี social / ลิงก์โปรไฟล์')}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {field('representativeName', 'ผู้ติดต่อแทน (ถ้ามี)')}
                      {field('representativeRelationship', 'ความสัมพันธ์')}
                    </div>
                    {field('preferredContactChannel', 'ช่องทางที่สะดวก', [
                      { value: '', label: 'ยังไม่ระบุ' },
                      { value: 'phone', label: 'โทรศัพท์' },
                      { value: 'line_oa', label: 'LINE' },
                      { value: 'facebook', label: 'Facebook' },
                      { value: 'tiktok', label: 'TikTok' },
                      { value: 'other', label: 'อื่น ๆ' },
                    ])}
                    {field('contactPermission', 'สิทธิ์ติดต่อเพื่อประสานการดูแล', [
                      { value: 'unknown', label: 'ยังไม่ยืนยัน' },
                      { value: 'granted', label: 'ยินยอม' },
                      { value: 'declined', label: 'ไม่ประสงค์ให้ติดต่อ' },
                    ])}
                    <p className="text-xs text-[#6a7d75]">
                      ไม่ใช่ความยินยอมทางการตลาด ไม่เลือกยินยอมให้อัตโนมัติ
                    </p>
                  </>
                )}
                {matches.length > 0 && !selected && (
                  <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <b className="text-sm">พบข้อมูลที่อาจซ้ำ — ระบบไม่รวมให้อัตโนมัติ</b>
                    {matches.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between gap-3 text-sm"
                      >
                        <span>
                          {item.fullName} ·{' '}
                          {item.hn ?? item.phone ?? item.socialAccount}
                        </span>
                        <button
                          type="button"
                          className="underline"
                          onClick={() => {
                            setSelected(item);
                            setErrors({});
                            setError('');
                          }}
                        >
                          ใช้บุคคลเดิม
                        </button>
                      </div>
                    ))}
                    {field('duplicateReason', 'เหตุผลหากสร้างเป็นคนใหม่')}
                  </div>
                )}
                {!selected &&
                  field(
                    'nextContactAt',
                    'วันติดต่อต่อไป (จำเป็นเมื่อบันทึกลีดอย่างเดียว) · เวลาไทย',
                    undefined,
                    'datetime-local',
                  )}
                {field('ownerId','ผู้รับผิดชอบประสานงาน',[{value:'',label:'ผู้บันทึก (ค่าเริ่มต้น)'},...(reference.staff??[]).filter(p=>['care_coordinator','clinic_admin'].includes(p.role)).map(p=>({value:p.user_id,label:p.display_name}))])}
              </>
            )}
            {step === 2 && (
              <>
                {field('title', 'หัวข้อ / เหตุผลที่ติดต่อ *')}
                {field('sourceId', 'แหล่งที่มา', [
                  { value: '', label: 'ยังไม่ระบุ' },
                  ...reference.sources.map((item) => ({
                    value: item.id,
                    label: item.label,
                  })),
                ])}
                {field('serviceId', 'บริการ / โปรแกรม', [
                  { value: '', label: 'ยังไม่ทราบบริการ' },
                  ...reference.services.map((item) => ({
                    value: item.id,
                    label: item.name,
                  })),
                ])}
                {field('planId', 'แผนติดตาม', [
                  {
                    value: '',
                    label: service?.default_follow_up_plan_id
                      ? 'ใช้แผนเริ่มต้นของบริการ'
                      : 'ยังไม่เลือกแผน',
                  },
                  ...reference.plans.map((item) => ({
                    value: item.id,
                    label: item.name,
                  })),
                ])}
                {planId &&
                  planId !== service?.default_follow_up_plan_id &&
                  field('planOverrideReason', 'เหตุผลที่เลือกแผนอื่น *')}
                {field(
                  'coordinationNote',
                  'ข้อมูลที่ผู้ป่วยแจ้งเพื่อส่งต่อ (ไม่ใช่ผลประเมิน Nurse)',
                  undefined,
                  'textarea',
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  {field('priority', 'ความสำคัญ', [
                    { value: 'low', label: 'ต่ำ' },
                    { value: 'normal', label: 'ปกติ' },
                    { value: 'high', label: 'สูง' },
                    { value: 'urgent', label: 'เร่งด่วน' },
                  ])}
                  {field('assignedTo', 'มอบหมาย Nurse', [
                    { value: '', label: 'มอบหมายภายหลัง' },
                    ...reference.nurses.map((item) => ({
                      value: item.user_id,
                      label: item.display_name,
                    })),
                  ])}
                </div>
              </>
            )}
            {step === 3 && (
              <div className="space-y-3 rounded-xl bg-[#f0f7f4] p-4 text-sm">
                <p>
                  <b>บุคคล:</b> {selected?.fullName ?? fields.fullName}
                </p>
                <p>
                  <b>เรื่อง:</b> {fields.title}
                </p>
                <p>
                  <b>บริการ:</b> {service?.name ?? 'รอระบุบริการ'}
                </p>
                <p>
                  <b>Nurse:</b>{' '}
                  {reference.nurses.find(
                    (item) => item.user_id === fields.assignedTo,
                  )?.display_name ?? 'รอมอบหมาย'}
                </p>
                <p>
                  <b>แผน:</b> {plan?.name ?? 'ยังไม่เลือกแผน'}
                </p>
                <p>ผู้รับผิดชอบประสานงาน: {reference.staff?.find(p=>p.user_id===fields.ownerId)?.display_name??'ผู้บันทึก'}</p>
                <p className="font-semibold">
                  {plan
                    ? 'แผนรอยืนยันวันเริ่ม — ยังไม่สร้างงานติดตาม'
                    : 'สร้างเคสรับเรื่องได้ และเพิ่มแผนภายหลัง'}
                </p>
              </div>
            )}
          </fieldset>
          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <button
              type="button"
              disabled={busy || uncertain}
              onClick={() => (step > 1 ? setStep(step - 1) : chooseClose())}
            >
              {step > 1 ? 'ย้อนกลับ' : 'ยกเลิก'}
            </button>
            <div className="flex gap-3">
              {step === 1 && !selected && !uncertain && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void action('lead')}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  บันทึกลีดอย่างเดียว
                </button>
              )}
              <button
                disabled={busy}
                className="rounded-lg bg-[#197365] px-4 py-2 text-sm font-semibold text-white"
              >
                {busy
                  ? 'กำลังตรวจสอบ / บันทึก…'
                  : uncertain
                    ? 'ลองคำขอเดิมอีกครั้ง'
                    : step === 3
                      ? 'ยืนยันสร้างเคส'
                      : 'ถัดไป'}
              </button>
            </div>
          </div>
        </form>
      )}
    </dialog>
  );
}
