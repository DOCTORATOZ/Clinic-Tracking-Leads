'use client';

import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export function SignOutButton() {
  const router = useRouter();
  return <button onClick={async () => { await createSupabaseBrowserClient().auth.signOut(); router.replace('/login'); router.refresh(); }} className="rounded-lg border border-[#d6e2dc] px-3 py-1.5 text-xs font-semibold text-[#17695d]">ออกจากระบบ</button>;
}
