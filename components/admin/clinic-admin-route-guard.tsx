'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClinicAdminWorkspace } from '@/components/admin/clinic-admin-workspace';

type Session = {
  systemAdmin: boolean;
  activeClinic: { role: string } | null;
};

export function ClinicAdminRouteGuard() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/session')
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'UNAUTHENTICATED');
        return body as Session;
      })
      .then((session) => {
        if (cancelled) return;
        if (session.systemAdmin && !session.activeClinic) router.replace('/system');
        else if (session.activeClinic?.role === 'clinic_admin') setAllowed(true);
        else router.replace('/');
      })
      .catch(() => { if (!cancelled) router.replace('/login'); });
    return () => { cancelled = true; };
  }, [router]);

  if (!allowed) return <main className="grid min-h-screen place-items-center bg-[#f4f7f5] p-6 text-sm text-[#71847b]">กำลังตรวจสอบสิทธิ์…</main>;
  return <ClinicAdminWorkspace />;
}
