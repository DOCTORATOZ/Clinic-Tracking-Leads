'use client';
import { useEffect, useRef, useState } from 'react';
import { normalizePhone } from '@/lib/validation/normalization';
import type {DirectoryPerson} from './intake-wizard';
type Person = {
  id: string;
  full_name: string;
  phone_normalized: string | null;
  hn_normalized: string | null;
  contact_permission: string;
  updated_at: string;
  social_platform: string|null;
  social_account: string|null;
  representative_name: string|null;
  representative_relationship: string|null;
};
type Contact = {
  id: string;
  direction: string;
  channel: string;
  summary: string;
  occurred_at: string;
};
export function PersonEditor({
  id,
  editable,
  changed,
  intake,
  staff,
}: {
  id: string;
  editable: boolean;
  changed: () => void;
  intake:DirectoryPerson;
  staff:{user_id:string;display_name:string;role:string}[];
}) {
  const [person, setPerson] = useState<Person>();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [version, setVersion] = useState(0);
  const lock = useRef(false);
  const request = useRef<string>('');
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/patients/${id}`, { signal: c.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        setPerson(body.patient);
        setContacts(body.contacts);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [id, version]);
  async function save(
    event: React.SubmitEvent<HTMLFormElement>,
    contact: boolean,
  ) {
    event.preventDefault();
    if (lock.current || !person) return;
    lock.current = true;
    setPending(true);
    setError('');
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >;
    try {
      if (!request.current) request.current = crypto.randomUUID();
      const body = contact
        ? {
            ...values,
            requestId: request.current,
            occurredAt: new Date(values.occurredAt + ':00+07:00').toISOString(),
          }
        : {
            ...values,
            phone: normalizePhone(values.phone) ?? '',
            ownerId:values.ownerId||undefined,
            nextContactAt:values.nextContactAt?new Date(values.nextContactAt+':00+07:00').toISOString():null,
            expectedUpdatedAt: person.updated_at,
          };
      const response = await fetch(
        `/api/patients/${id}${contact ? '/contacts' : ''}`,
        {
          method: contact ? 'POST' : 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.fieldErrors?Object.values(data.fieldErrors).join(' · '):data.error==='STALE_WRITE'?'ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดล่าสุดก่อนบันทึก':data.error==='CONTACT_NOT_PERMITTED'?'ยังไม่มีสิทธิ์ติดต่อออก':data.error);
      request.current = '';
      setVersion(version + 1);
      changed();
      if (contact) form.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'บันทึกไม่สำเร็จ');
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  const field = 'mt-1 block w-full rounded border p-2';
  return (
    <div className="mt-4 space-y-4">
      {error && (
        <p role="alert" className="rounded bg-amber-50 p-3">
          {error}
          <button
            className="ml-3 underline"
            onClick={() => {
              setError('');
              setVersion(version + 1);
            }}
          >
            โหลดล่าสุด
          </button>
        </p>
      )}
      {editable && person && (
        <details>
          <summary className="cursor-pointer font-semibold">
            แก้ข้อมูลติดต่อ / สิทธิ์ติดต่อ
          </summary>
          <form
            key={person.updated_at}
            onSubmit={(e) => void save(e, false)}
            className="mt-3 space-y-3"
          >
            <fieldset disabled={pending} className="space-y-3">
              <label className="block">
                ชื่อ
                <input
                  name="fullName"
                  required
                  maxLength={200}
                  className={field}
                  defaultValue={person.full_name}
                />
              </label>
              <label className="block">
                โทรศัพท์
                <input
                  name="phone"
                  className={field}
                  defaultValue={person.phone_normalized ?? ''}
                />
              </label>
              <label className="block">
                HN
                <input
                  name="hn"
                  className={field}
                  defaultValue={person.hn_normalized ?? ''}
                />
              </label>
              <label className="block">ช่องทาง social<select name="socialPlatform" className={field} defaultValue={person.social_platform??''}><option value="">ไม่ระบุ</option><option value="line_oa">LINE</option><option value="facebook">Facebook</option><option value="tiktok">TikTok</option><option value="other">อื่น ๆ</option></select></label>
              <label className="block">บัญชี social<input name="socialAccount" maxLength={200} className={field} defaultValue={person.social_account??''}/></label>
              <label className="block">ผู้ติดต่อแทน<input name="representativeName" maxLength={200} className={field} defaultValue={person.representative_name??''}/></label>
              <label className="block">ความสัมพันธ์<input name="representativeRelationship" maxLength={200} className={field} defaultValue={person.representative_relationship??''}/></label>
              <label className="block">ผู้รับผิดชอบประสานงาน<select name="ownerId" className={field} defaultValue={intake.ownerId??''}><option value="">ผู้บันทึก</option>{staff.filter(p=>['clinic_admin','care_coordinator'].includes(p.role)).map(p=><option key={p.user_id} value={p.user_id}>{p.display_name}</option>)}</select></label>
              <label className="block">สถานะรับเรื่อง<select name="intakeStatus" className={field} defaultValue={intake.intakeStatus??'new'}><option value="new">ใหม่</option><option value="in_progress">กำลังประสานงาน</option><option value="awaiting_callback">รอติดต่อกลับ</option><option value="linked_to_case">ส่งต่อเข้าเคส</option><option value="closed">ยุติการประสานงาน</option></select></label>
              <label className="block">วันติดต่อต่อไป · เวลาไทย<input name="nextContactAt" type="datetime-local" className={field} defaultValue={intake.nextContactAt?new Date(Date.parse(intake.nextContactAt)+7*3600000).toISOString().slice(0,16):''}/></label>
              <label className="block">
                สิทธิ์ติดต่อ
                <select
                  name="contactPermission"
                  className={field}
                  defaultValue={person.contact_permission}
                >
                  <option value="unknown">ยังไม่ยืนยัน</option>
                  <option value="granted">ยินยอม</option>
                  <option value="declined">ไม่ประสงค์ให้ติดต่อ</option>
                </select>
              </label>
              <label className="block">
                เหตุผล / แหล่งที่ยืนยัน
                <input name="reason" required className={field} />
              </label>
              <button className="rounded bg-[#197365] px-4 py-2 text-white">
                บันทึกข้อมูลบุคคล
              </button>
            </fieldset>
          </form>
        </details>
      )}
      {editable && (
        <details>
          <summary className="cursor-pointer font-semibold">
            บันทึกการติดต่อเข้า / ออก
          </summary>
          <form onSubmit={(e) => void save(e, true)} className="mt-3 space-y-3">
            <fieldset disabled={pending} className="space-y-3">
              <label className="block">
                ทิศทาง
                <select name="direction" className={field}>
                  <option value="incoming">ติดต่อเข้ามา</option>
                  <option value="outgoing">ติดต่อออก</option>
                </select>
              </label>
              <label className="block">
                ช่องทาง
                <select name="channel" className={field}>
                  <option value="phone">โทรศัพท์</option>
                  <option value="line_oa">LINE</option>
                  <option value="facebook">Facebook</option>
                  <option value="other">อื่น ๆ</option>
                </select>
              </label>
              <label className="block">
                วันเวลาไทย
                <input
                  name="occurredAt"
                  type="datetime-local"
                  required
                  className={field}
                />
              </label>
              <label className="block">
                สรุปเพื่อประสานงาน
                <textarea
                  name="summary"
                  required
                  maxLength={5000}
                  className={field}
                />
              </label>
              <button className="rounded bg-[#197365] px-4 py-2 text-white">
                บันทึกการติดต่อ
              </button>
            </fieldset>
          </form>
        </details>
      )}
      {contacts.map((item) => (
        <div key={item.id} className="border-t pt-2">
          <p>
            {new Date(item.occurred_at).toLocaleString('th-TH', {
              timeZone: 'Asia/Bangkok',
            })}{' '}
            · {item.direction === 'incoming' ? 'ติดต่อเข้า' : 'ติดต่อออก'} ·{' '}
            {item.channel}
          </p>
          <p>{item.summary}</p>
        </div>
      ))}
    </div>
  );
}
