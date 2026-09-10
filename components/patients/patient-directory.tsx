'use client';

import { Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LeadCase } from '@/modules/leads/types';

export function PatientDirectory({
  cases,
  onOpenCase,
}: {
  cases: LeadCase[];
  onOpenCase: (leadCase: LeadCase) => void;
}) {
  const [query, setQuery] = useState('');
  const patients = useMemo(
    () =>
      Object.values(
        cases.reduce<Record<string, { patient: LeadCase; cases: LeadCase[] }>>(
          (groups, leadCase) => {
            const key = leadCase.phone.replace(/\D/g, '') || leadCase.name;
            const group = groups[key] ?? { patient: leadCase, cases: [] };
            group.cases.push(leadCase);
            groups[key] = group;
            return groups;
          },
          {},
        ),
      ).filter(({ patient }) =>
        `${patient.name} ${patient.hn ?? ''} ${patient.phone}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [cases, query],
  );

  return (
    <div className="mt-7 space-y-5">
      <section className="rounded-2xl border border-[#dce6e0] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">ผู้ป่วยทั้งหมด</h2>
            <p className="mt-1 text-xs text-[#71847b]">
              ผู้ป่วยหนึ่งรายอาจมีหลาย lead/case
            </p>
          </div>
          <span className="rounded-full bg-[#e5f3ef] px-2.5 py-1 text-xs font-semibold text-[#17695d]">
            {patients.length} ราย
          </span>
        </div>
        <label className="mt-4 flex items-center gap-2 rounded-lg border border-[#d5e2db] px-3 py-2 text-[#6d8178]">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหาชื่อ, HN หรือเบอร์โทร"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
      </section>
      <section className="overflow-hidden rounded-2xl border border-[#dce6e0] bg-white">
        {patients.map(({ patient, cases: patientCases }) => (
          <div
            key={patient.phone}
            className="border-b border-[#e8eeea] p-4 last:border-0"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-[#e5f3ef] text-xs font-semibold text-[#197365]">
                  {patient.initials}
                </span>
                <div>
                  <b className="block text-sm">{patient.name}</b>
                  <span className="mt-1 block text-xs text-[#71847b]">
                    {patient.hn ?? 'ยังไม่มี HN'} · {patient.phone}
                  </span>
                </div>
              </div>
              <span className="rounded-full bg-[#eff3f1] px-2 py-1 text-[11px] font-semibold text-[#52665e]">
                {patientCases.length} เคส
              </span>
            </div>
            <div className="mt-3 rounded-lg bg-[#f7faf8] p-3">
              <p className="text-xs font-semibold text-[#52665e]">
                Lead / Case ของผู้ป่วย
              </p>
              {patientCases.map((leadCase) => (
                <button
                  key={leadCase.id}
                  onClick={() => onOpenCase(leadCase)}
                  className="mt-2 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-white"
                >
                  <span>
                    <b className="text-xs">
                      {leadCase.id} · {leadCase.service}
                    </b>
                    <span className="ml-2 text-xs text-[#71847b]">
                      {leadCase.status}
                    </span>
                  </span>
                  <span className="text-xs text-[#197365]">เปิดเคส</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {!patients.length && (
          <div className="p-10 text-center text-sm text-[#71847b]">
            <Users className="mx-auto mb-2" size={20} />
            ไม่พบผู้ป่วย
          </div>
        )}
      </section>
    </div>
  );
}
