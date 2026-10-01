'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { ActionDialog } from './action-dialog';

type Tab =
  | 'users'
  | 'config'
  | 'sources'
  | 'services'
  | 'plans'
  | 'tools'
  | 'audit';
type Plan = {
  id: string;
  name: string;
  version: number;
  active: boolean;
  follow_up_plan_steps: {
    sequence: number;
    day_offset: number;
    due_time: string;
  }[];
};
type Data = {
  clinic: { name: string; timezone: string; case_number_prefix: string } | null;
  sources: { id: string; code: string; label: string; active: boolean }[];
  services: {
    id: string;
    code: string;
    name: string;
    active: boolean;
    default_follow_up_plan_id: string | null;
  }[];
  plans: Plan[];
};
type Member = {
  user_id: string;
  display_name: string;
  role: string;
  active: boolean;
};
const tabs: [Tab, string][] = [
  ['users', 'ผู้ใช้'],
  ['config', 'ตั้งค่าคลินิก'],
  ['sources', 'Sources'],
  ['services', 'Services'],
  ['plans', 'Follow-up plans'],
  ['tools', 'Tools'],
  ['audit', 'Audit'],
];
const roles = ['viewer', 'nurse', 'care_coordinator', 'clinic_admin'];
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  const response = await fetch(url, { ...init, headers });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'ไม่สามารถดำเนินการได้');
  return body as T;
}
function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#dce6e0] bg-white p-5">
      {children}
    </section>
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
      <span className="mt-1 block [&_input]:w-full [&_input]:rounded [&_input]:border [&_input]:p-2 [&_select]:w-full [&_select]:rounded [&_select]:border [&_select]:p-2">
        {children}
      </span>
    </label>
  );
}

export function ClinicAdminWorkspace() {
  const [tab, setTab] = useState<Tab>('users');
  const [data, setData] = useState<Data>();
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const refresh = useCallback(async () => {
    const [admin, membership] = await Promise.all([
      api<Data>('/api/clinic/admin'),
      api<{ memberships: Member[] }>('/api/clinic/memberships'),
    ]);
    setData(admin);
    setMembers(membership.memberships);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh().catch((reason) => setError(reason.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  const save = async (work: () => Promise<unknown>) => {
    try {
      await work();
      setNotice('บันทึกแล้ว');
      setError(undefined);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'บันทึกไม่สำเร็จ');
    }
  };
  return (
    <main className="min-h-screen bg-[#f4f7f5] text-[#19312c]">
      <header className="flex items-center justify-between border-b border-[#dbe5df] bg-white px-5 py-3">
        <div>
          <b>Clinic Admin</b>
          <p className="text-xs text-[#71847b]">การตั้งค่าและการกำกับดูแลคลินิก</p>
        </div>
        <div className="flex gap-2">
          <Link href="/" className="rounded border px-2 py-1 text-sm">
            กลับหน้าคลินิก
          </Link>
          <SignOutButton />
        </div>
      </header>
      <section className="mx-auto max-w-6xl p-5 md:p-8">
        <nav className="flex flex-wrap gap-2">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === key ? 'bg-[#197365] text-white' : 'bg-white text-[#52665e]'}`}
            >
              {label}
            </button>
          ))}
        </nav>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded bg-[#fff4e5] p-3 text-sm text-[#9a641b]"
          >
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-4 rounded bg-[#eaf6f1] p-3 text-sm text-[#17695d]">
            {notice}
          </p>
        )}
        {!data ? (
          <p className="mt-5 text-sm text-[#71847b]">กำลังโหลด…</p>
        ) : (
          <div className="mt-5">
            {tab === 'users' && <Users members={members} save={save} />}
            {tab === 'config' && <Config data={data} save={save} />}
            {tab === 'sources' && <Sources data={data} save={save} />}
            {tab === 'services' && <Services data={data} save={save} />}
            {tab === 'plans' && <Plans data={data} save={save} />}
            {tab === 'tools' && <Tools />}
            {tab === 'audit' && <Audit />}
          </div>
        )}
      </section>
    </main>
  );
}

function Users({
  members,
  save,
}: {
  members: Member[];
  save: (work: () => Promise<unknown>) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('care_coordinator');
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <Card>
        <h1 className="font-semibold">เชิญผู้ใช้</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save(() =>
              api('/api/clinic/memberships', {
                method: 'POST',
                body: JSON.stringify({ email, role }),
              }).then(() => setEmail('')),
            );
          }}
        >
          <Field label="อีเมล">
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field label="บทบาท">
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              {roles.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          <button className="mt-4 w-full rounded bg-[#197365] py-2 text-sm text-white">
            ส่งคำเชิญ
          </button>
        </form>
      </Card>
      <Card>
        <h1 className="font-semibold">สมาชิกคลินิก</h1>
        <table className="mt-4 w-full text-left text-sm">
          <tbody>
            {members.map((member) => (
              <tr key={member.user_id} className="border-b">
                <td className="p-2">{member.display_name}</td>
                <td className="p-2">
                  <select
                    value={member.role}
                    onChange={(event) =>
                      save(() =>
                        api('/api/clinic/memberships', {
                          method: 'PATCH',
                          body: JSON.stringify({
                            userId: member.user_id,
                            role: event.target.value,
                            active: member.active,
                          }),
                        }),
                      )
                    }
                  >
                    {roles.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <button
                    className="rounded border px-2 py-1"
                    onClick={() =>
                      save(() =>
                        api('/api/clinic/memberships', {
                          method: 'PATCH',
                          body: JSON.stringify({
                            userId: member.user_id,
                            role: member.role,
                            active: !member.active,
                          }),
                        }),
                      )
                    }
                  >
                    {member.active ? 'ปิดสิทธิ์' : 'เปิดสิทธิ์'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
function Config({
  data,
  save,
}: {
  data: Data;
  save: (work: () => Promise<unknown>) => void;
}) {
  const [name, setName] = useState(data.clinic?.name ?? '');
  const [prefix, setPrefix] = useState(data.clinic?.case_number_prefix ?? '');
  return (
    <Card>
      <h1 className="font-semibold">ตั้งค่าคลินิก</h1>
      <form
        className="max-w-md"
        onSubmit={(event) => {
          event.preventDefault();
          save(() =>
            api('/api/clinic/admin/config', {
              method: 'PATCH',
              body: JSON.stringify({ name, caseNumberPrefix: prefix }),
            }),
          );
        }}
      >
        <Field label="ชื่อคลินิก">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </Field>
        <Field label="Case-number prefix">
          <input
            value={prefix}
            onChange={(event) => setPrefix(event.target.value.toUpperCase())}
            required
          />
        </Field>
        <Field label="Timezone">
          <input value={data.clinic?.timezone ?? 'Asia/Bangkok'} disabled />
        </Field>
        <button className="mt-4 rounded bg-[#197365] px-4 py-2 text-sm text-white">
          บันทึก
        </button>
      </form>
    </Card>
  );
}
function Sources({
  data,
  save,
}: {
  data: Data;
  save: (work: () => Promise<unknown>) => void;
}) {
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [editing,setEditing]=useState<Data['sources'][number]>();
  const edit = (source: Data['sources'][number]) => {
    setEditing(source);
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <Card>
        {editing&&<ActionDialog title="แก้ไขแหล่งที่มา" close={()=>setEditing(undefined)} confirm={async values=>{await api('/api/clinic/admin/sources',{method:'POST',body:JSON.stringify({action:'update',id:editing.id,code:values.get('code'),label:values.get('label')})});save(()=>Promise.resolve());}}><label>รหัส<input name="code" required maxLength={80} defaultValue={editing.code}/></label><label>ชื่อ<input name="label" required maxLength={200} defaultValue={editing.label}/></label></ActionDialog>}
        <h1 className="font-semibold">เพิ่ม Source</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save(() =>
              api('/api/clinic/admin/sources', {
                method: 'POST',
                body: JSON.stringify({ action: 'create', code, label }),
              }).then(() => {
                setCode('');
                setLabel('');
              }),
            );
          }}
        >
          <Field label="Code">
            <input
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </Field>
          <Field label="ชื่อ">
            <input
              required
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </Field>
          <button className="mt-4 rounded bg-[#197365] px-4 py-2 text-sm text-white">
            เพิ่ม
          </button>
        </form>
      </Card>
      <Card>
        <h1 className="font-semibold">Sources</h1>
        {data.sources.map((source) => (
          <p
            key={source.id}
            className="mt-3 flex justify-between border-b pb-3 text-sm"
          >
            <span>
              <b>{source.label}</b> · {source.code}
            </span>
            <span className="flex gap-2">
              <button
                className="rounded border px-2 py-1"
                onClick={() => edit(source)}
              >
                แก้ไข
              </button>
              <button
                className="rounded border px-2 py-1"
                onClick={() =>
                  save(() =>
                    api('/api/clinic/admin/sources', {
                      method: 'POST',
                      body: JSON.stringify({
                        action: source.active ? 'archive' : 'reactivate',
                        id: source.id,
                      }),
                    }),
                  )
                }
              >
                {source.active ? 'Archive' : 'Reactivate'}
              </button>
            </span>
          </p>
        ))}
      </Card>
    </div>
  );
}
function Services({
  data,
  save,
}: {
  data: Data;
  save: (work: () => Promise<unknown>) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [planId, setPlanId] = useState('');
  const [editing,setEditing]=useState<Data['services'][number]>();
  const edit = (service: Data['services'][number]) => {
    setEditing(service);
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <Card>
        {editing&&<ActionDialog title="แก้ไขบริการ" close={()=>setEditing(undefined)} confirm={async values=>{await api('/api/clinic/admin/services',{method:'POST',body:JSON.stringify({action:'update',id:editing.id,code:values.get('code'),name:values.get('name'),planId:values.get('planId')||null})});save(()=>Promise.resolve());}}><label>รหัส<input name="code" required maxLength={80} defaultValue={editing.code}/></label><label>ชื่อบริการ<input name="name" required maxLength={200} defaultValue={editing.name}/></label><label>แผนเริ่มต้น<select name="planId" defaultValue={editing.default_follow_up_plan_id??''}><option value="">ไม่เลือก</option>{data.plans.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name} v{p.version}</option>)}</select></label></ActionDialog>}
        <h1 className="font-semibold">เพิ่ม Service</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save(() =>
              api('/api/clinic/admin/services', {
                method: 'POST',
                body: JSON.stringify({
                  action: 'create',
                  code,
                  name,
                  planId: planId || null,
                }),
              }).then(() => {
                setCode('');
                setName('');
              }),
            );
          }}
        >
          <Field label="Code">
            <input
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </Field>
          <Field label="ชื่อบริการ">
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Default plan">
            <select
              value={planId}
              onChange={(event) => setPlanId(event.target.value)}
            >
              <option value="">ไม่เลือก</option>
              {data.plans
                .filter((plan) => plan.active)
                .map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} v{plan.version}
                  </option>
                ))}
            </select>
          </Field>
          <button className="mt-4 rounded bg-[#197365] px-4 py-2 text-sm text-white">
            เพิ่ม
          </button>
        </form>
      </Card>
      <Card>
        <h1 className="font-semibold">Services</h1>
        {data.services.map((service) => (
          <p
            key={service.id}
            className="mt-3 flex justify-between border-b pb-3 text-sm"
          >
            <span>
              <b>{service.name}</b> · {service.code}
            </span>
            <span className="flex gap-2">
              <button
                className="rounded border px-2 py-1"
                onClick={() => edit(service)}
              >
                แก้ไข
              </button>
              <button
                className="rounded border px-2 py-1"
                onClick={() =>
                  save(() =>
                    api('/api/clinic/admin/services', {
                      method: 'POST',
                      body: JSON.stringify({
                        action: service.active ? 'archive' : 'reactivate',
                        id: service.id,
                      }),
                    }),
                  )
                }
              >
                {service.active ? 'Archive' : 'Reactivate'}
              </button>
            </span>
          </p>
        ))}
      </Card>
    </div>
  );
}
function Plans({
  data,
  save,
}: {
  data: Data;
  save: (work: () => Promise<unknown>) => void;
}) {
  const [name, setName] = useState('');
  const [previousPlanId, setPreviousPlanId] = useState('');
  const [steps, setSteps] = useState(
    '1,1,10:00,ติดตามครั้งแรก\n2,3,10:00,ติดตามครั้งที่สอง',
  );
  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <Card>
        <h1 className="font-semibold">สร้าง Plan / Version ใหม่</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const values = steps
              .split('\n')
              .filter(Boolean)
              .map((row) => {
                const [sequence, dayOffset, dueTime, instruction] =
                  row.split(',');
                return {
                  sequence: Number(sequence),
                  dayOffset: Number(dayOffset),
                  dueTime,
                  instruction,
                };
              });
            save(() =>
              api('/api/clinic/admin/plans', {
                method: 'POST',
                body: JSON.stringify({
                  previousPlanId: previousPlanId || null,
                  name,
                  steps: values,
                }),
              }).then(() => setName('')),
            );
          }}
        >
          <Field label="Plan เดิม">
            <select
              value={previousPlanId}
              onChange={(event) => setPreviousPlanId(event.target.value)}
            >
              <option value="">Plan ใหม่</option>
              {data.plans
                .filter((plan) => plan.active)
                .map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} v{plan.version}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="ชื่อ plan">
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <label className="mt-3 block text-sm">
            Steps
            <textarea
              className="mt-1 min-h-28 w-full rounded border p-2"
              value={steps}
              onChange={(event) => setSteps(event.target.value)}
            />
          </label>
          <p className="mt-1 text-xs text-[#71847b]">
            หนึ่งบรรทัด: sequence, dayOffset, HH:MM, instruction
          </p>
          <button className="mt-4 rounded bg-[#197365] px-4 py-2 text-sm text-white">
            สร้าง version
          </button>
        </form>
      </Card>
      <Card>
        <h1 className="font-semibold">Follow-up plans</h1>
        {data.plans.map((plan) => (
          <p key={plan.id} className="mt-3 border-b pb-3 text-sm">
            <b>
              {plan.name} v{plan.version}
            </b>{' '}
            · {plan.active ? 'Active' : 'Archived'}
            <br />
            <span className="text-xs text-[#71847b]">
              {plan.follow_up_plan_steps
                .map(
                  (step) =>
                    `Day ${step.day_offset} ${step.due_time.slice(0, 5)}`,
                )
                .join(' · ')}
            </span>
          </p>
        ))}
      </Card>
    </div>
  );
}
function Tools() {
  const [status, setStatus] = useState('disabled');
  useEffect(() => {
    void api<{ status?: string }>('/api/clinic/admin/tools').then((tool) =>
      setStatus(tool.status ?? 'disabled'),
    );
  }, []);
  return (
    <Card>
      <h1 className="font-semibold">Google Calendar</h1>
      <p className="mt-2 text-sm">สถานะ: {status}</p>
      <p className="mt-3 rounded bg-[#fff4e5] p-3 text-sm text-[#9a641b]">
        Calendar sync ถูกปิด ไม่มี OAuth credential, cron หรือการส่งข้อมูลไป Google
      </p>
    </Card>
  );
}
function Audit() {
  const [rows, setRows] = useState<
    {
      id: string;
      action: string;
      actor_name: string;
      entity_type: string;
      reason: string | null;
      occurred_at: string;
    }[]
  >([]);
  useEffect(() => {
    void api<typeof rows>('/api/clinic/admin/audit').then(setRows);
  }, []);
  return (
    <Card>
      <h1 className="font-semibold">Audit timeline</h1>
      <p className="mt-1 text-sm text-[#71847b]">ไม่แสดง clinical detail</p>
      {rows.map((row) => (
        <p key={row.id} className="mt-4 border-b pb-3 text-sm">
          <b>{row.actor_name}</b> · {row.action} · {row.entity_type}
          {row.reason && ` · ${row.reason}`}
          <br />
          <span className="text-xs text-[#71847b]">
            {new Date(row.occurred_at).toLocaleString('th-TH', {
              timeZone: 'Asia/Bangkok',
            })}
          </span>
        </p>
      ))}
    </Card>
  );
}
