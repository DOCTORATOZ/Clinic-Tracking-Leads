'use client';

import { Suspense, useState, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
const subscribeHydration = () => () => {};

export default function LoginPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#f4f7f5] text-[#19312c]"><output>กำลังโหลดหน้าเข้าสู่ระบบ…</output></main>}><LoginForm /></Suspense>;
}

function LoginForm() {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function signIn(event: { preventDefault(): void }) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      const { error: signInError } = await createSupabaseBrowserClient().auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      const next = searchParams.get('next');
      router.replace(next?.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : '/');
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-[#f4f7f5] p-5 text-[#19312c]">
    <form onSubmit={signIn} className="w-full max-w-sm rounded-2xl border border-[#dce6e0] bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold">Care D Clinic</h1>
      <p className="mt-1 text-sm text-[#71847b]">เข้าสู่ระบบสำหรับเจ้าหน้าที่</p>
      {error && <p role="alert" className="mt-4 rounded-lg bg-[#fff4e5] p-3 text-sm text-[#9a641b]">{error}</p>}
      <label className="mt-5 block text-sm font-medium">อีเมล<input disabled={!hydrated} autoComplete="username" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-[#cfded7] px-3 py-2" /></label>
      <label className="mt-4 block text-sm font-medium">รหัสผ่าน<input disabled={!hydrated} autoComplete="current-password" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-[#cfded7] px-3 py-2" /></label>
      <button disabled={!hydrated || submitting} className="mt-6 w-full rounded-lg bg-[#197365] px-3 py-2.5 font-semibold text-white disabled:opacity-60">{submitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
    </form>
  </main>;
}
