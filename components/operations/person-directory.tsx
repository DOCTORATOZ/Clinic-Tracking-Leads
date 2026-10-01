'use client';
import { useEffect, useState } from 'react';
import type { DirectoryPerson } from './intake-wizard';
import { PersonEditor } from './person-editor';

export function PersonDirectory({
  chooseCase,
  createCase,
  focusId,
  staff,
}: {
  chooseCase: (id: string) => void;
  createCase?: (person: DirectoryPerson) => void;
  focusId?: string;
  staff: {user_id:string;display_name:string;role:string}[];
}) {
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<DirectoryPerson[]>([]);
  const [selected, setSelected] = useState<string | undefined>(focusId);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [onlyIntake,setOnlyIntake]=useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(
          `/api/patients?query=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error('โหลดทะเบียนบุคคลไม่สำเร็จ');
        setPeople(await response.json());
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : 'โหลดข้อมูลไม่สำเร็จ',
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, revision]);
  return (
    <section className="mt-6 rounded-2xl border border-[#dce6e0] bg-white p-5">
      <h2 className="font-semibold">ทะเบียนลีด / ผู้ป่วย</h2>
      <label className="my-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyIntake} onChange={e=>setOnlyIntake(e.target.checked)}/>คิวรับเรื่อง — เฉพาะลีดที่ยังไม่มีเคส</label>
      <input
        aria-label="ค้นหาบุคคล"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="ชื่อ, HN, โทรศัพท์ หรือบัญชี social"
        className="my-4 w-full rounded-lg border p-2"
      />
      {loading ? (
        <output className="block">กำลังโหลด…</output>
      ) : error ? (
        <div role="alert">
          {error}{' '}
          <button
            className="underline"
            onClick={() => setRevision(revision + 1)}
          >
            ลองใหม่
          </button>
        </div>
      ) : !people.length ? (
        <p>ไม่พบบุคคลตามคำค้น</p>
      ) : (
        people.filter(person=>!onlyIntake||person.caseIds.length===0).map((person) => (
          <article key={person.id} className="border-t py-4">
            <button
              className="w-full text-left"
              onClick={() =>
                setSelected(selected === person.id ? undefined : person.id)
              }
            >
              <b>{person.fullName}</b>
              <span className="ml-3 text-sm">
                {person.hn ?? 'ยังไม่มี HN'} ·{' '}
                {person.phone ?? person.socialAccount} · {person.caseIds.length}{' '}
                เคส
              </span>
            </button>
            {selected === person.id && (
              <div className="mt-3 space-y-2 text-sm">
                <p>เจ้าของงาน: {staff.find(p=>p.user_id===person.ownerId)?.display_name??'รอระบุ'} · สถานะ: {({new:'ใหม่',in_progress:'กำลังประสานงาน',awaiting_callback:'รอติดต่อกลับ',linked_to_case:'ส่งต่อเข้าเคส',closed:'ยุติการประสานงาน'})[person.intakeStatus??'new']}</p>
                <p>
                  สิทธิ์ติดต่อ:{' '}
                  {{
                    unknown: 'ยังไม่ยืนยัน',
                    granted: 'ยินยอม',
                    declined: 'ไม่ประสงค์ให้ติดต่อ',
                  }[person.contactPermission] ?? 'ยังไม่ยืนยัน'}
                </p>
                <p>
                  วันติดต่อต่อไป:{' '}
                  {person.nextContactAt
                    ? new Date(person.nextContactAt).toLocaleString('th-TH', {
                        timeZone: 'Asia/Bangkok',
                      })
                    : 'ยังไม่ระบุ'}
                </p>
                {person.caseIds.map((id, index) => (
                  <button
                    key={id}
                    className="mr-4 underline"
                    onClick={() => chooseCase(id)}
                  >
                    เปิดเคส {index + 1}
                  </button>
                ))}
                {createCase && (
                  <button
                    className="rounded-lg border px-3 py-2"
                    onClick={() => createCase(person)}
                  >
                    เปิดเคสใหม่ของบุคคลนี้
                  </button>
                )}
                <PersonEditor
                  intake={person}
                  staff={staff}
                  id={person.id}
                  editable={!!createCase}
                  changed={() => setRevision((value) => value + 1)}
                />
              </div>
            )}
          </article>
        ))
      )}
      <p className="mt-4 text-xs text-[#71847b]">
        แสดงไม่เกิน 100 คนต่อคำค้น — ค้นหาเพิ่มเติมเพื่อระบุบุคคล
      </p>
    </section>
  );
}
