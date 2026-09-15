import { NextResponse } from 'next/server';

export function apiErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: message }, { status: 401 });
  if (message === 'CLINIC_CONTEXT_NOT_FOUND' || message === 'FORBIDDEN') return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 400 });
}
