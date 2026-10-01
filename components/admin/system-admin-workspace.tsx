'use client';

import { useCallback, useEffect, useState } from 'react';
import { SignOutButton } from '@/components/auth/sign-out-button';
import {ActionDialog} from './action-dialog';

type Tenant = {
  id: string;
  name: string;
  active: boolean;
  active_member_count: number;
  suspended_at: string | null;
  suspension_reason: string | null;
};

export function SystemAdminWorkspace() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState<string>();
  const [selected,setSelected]=useState<Tenant>();
  const refresh = useCallback(async () => {
    const response = await fetch('/api/platform/clinics');
    const body = await response.json();
    if (!response.ok)
      throw new Error(body.error ?? 'ไม่สามารถโหลดข้อมูล tenant ได้');
    setTenants(body);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh().catch((reason) => setError(reason.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  const update = async (tenant: Tenant, active: boolean, reason:string) => {
    const response = await fetch('/api/platform/clinics', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clinicId: tenant.id, active, reason }),
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error ?? 'ไม่สามารถบันทึกได้');
    }
    await refresh();
  };
  return (
    <main className="min-h-screen bg-[#f4f7f5] text-[#19312c]">
      <header className="flex items-center justify-between border-b border-[#dbe5df] bg-white px-5 py-3">
        <div>
          <b>Care D Platform</b>
          <p className="text-xs text-[#71847b]">
            System Admin · ข้อมูล tenant เท่านั้น
          </p>
        </div>
        <SignOutButton />
      </header>
      <section className="mx-auto max-w-5xl p-6">
        <h1 className="text-xl font-bold">จัดการ SaaS tenants</h1>
        <p className="mt-1 text-sm text-[#71847b]">
          ไม่มีข้อมูลผู้ป่วยหรือข้อมูลทางคลินิกในหน้านี้
        </p>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-[#fff4e5] p-3 text-sm text-[#9a641b]"
          >
            {error}
          </p>
        )}
        <div className="mt-5 overflow-hidden rounded-xl border border-[#dce6e0] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f6faf8]">
              <tr>
                <th className="p-3">คลินิก</th>
                <th className="p-3">สมาชิก</th>
                <th className="p-3">สถานะ</th>
                <th className="p-3">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="border-t">
                  <td className="p-3">{tenant.name}</td>
                  <td className="p-3">{tenant.active_member_count}</td>
                  <td className="p-3">
                    {tenant.active
                      ? 'ใช้งาน'
                      : `ระงับ${tenant.suspension_reason ? ` · ${tenant.suspension_reason}` : ''}`}
                  </td>
                  <td className="p-3">
                    <button
                      className="rounded border px-2 py-1"
                      onClick={() => setSelected(tenant)}
                    >
                      {tenant.active ? 'ระงับ' : 'เปิดใช้งาน'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!tenants.length && (
            <p className="p-4 text-sm text-[#71847b]">
              ยังไม่มี tenant หรือคุณไม่มีสิทธิ์ System Admin
            </p>
          )}
        </div>
      </section>
      {selected&&<ActionDialog title={selected.active?'ยืนยันระงับคลินิก':'ยืนยันเปิดใช้งานคลินิก'} close={()=>setSelected(undefined)} confirm={async values=>{await update(selected,!selected.active,String(values.get('reason')));}}><p>{selected.name}</p><p className="text-sm">การระงับคลินิกจะปฏิเสธการใช้งานข้อมูลคลินิกของสมาชิกทุกคน โดยไม่ลบข้อมูล</p><label>เหตุผล<input name="reason" required maxLength={1000}/></label></ActionDialog>}
    </main>
  );
}
