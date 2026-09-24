import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function apiErrorResponse(error: unknown, fallback: string) {
  if (error instanceof ZodError) return NextResponse.json({ error: 'VALIDATION_ERROR', fieldErrors: Object.fromEntries(error.issues.map((issue) => [issue.path.join('.'), issue.message])) }, { status: 400 });
  const raw = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  const known = ['UNAUTHENTICATED', 'CLINIC_CONTEXT_NOT_FOUND', 'FORBIDDEN', 'HN_ALREADY_EXISTS', 'DUPLICATE_DECISION_REQUIRED', 'IDEMPOTENCY_CONFLICT', 'PLAN_OVERRIDE_REASON_REQUIRED', 'INVALID_REFERENCE', 'VALIDATION_ERROR', 'PATIENT_NOT_FOUND'];
  const message = known.includes(raw) ? raw : fallback;
  if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: message }, { status: 401 });
  if (message === 'CLINIC_CONTEXT_NOT_FOUND' || message === 'FORBIDDEN') return NextResponse.json({ error: message }, { status: 403 });
  if (['HN_ALREADY_EXISTS', 'DUPLICATE_DECISION_REQUIRED', 'IDEMPOTENCY_CONFLICT'].includes(message)) return NextResponse.json({ error: message }, { status: 409 });
  return NextResponse.json({ error: message }, { status: 400 });
}
