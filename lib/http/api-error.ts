import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function apiErrorResponse(error: unknown, fallback: string) {
  if (error instanceof ZodError) return NextResponse.json({ error: 'VALIDATION_ERROR', fieldErrors: Object.fromEntries(error.issues.map((issue) => [issue.path.join('.'), issue.message])) }, { status: 400 });
  const raw = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  const known = ['UNAUTHENTICATED', 'CLINIC_CONTEXT_NOT_FOUND', 'FORBIDDEN', 'HN_ALREADY_EXISTS', 'DUPLICATE_DECISION_REQUIRED', 'IDEMPOTENCY_CONFLICT', 'PLAN_OVERRIDE_REASON_REQUIRED', 'INVALID_REFERENCE', 'VALIDATION_ERROR', 'PATIENT_NOT_FOUND', 'CASE_NOT_FOUND', 'STALE_WRITE', 'STALE_PREVIEW', 'CASE_NOT_OPEN', 'INVALID_TRANSITION', 'UNRESOLVED_WORK', 'NURSE_CONFIRMATION_REQUIRED', 'NURSE_REPORTER_REQUIRED', 'CONTACT_NOT_PERMITTED', 'TERMINAL_TASK', 'TERMINAL_APPOINTMENT', 'INVALID_APPOINTMENT_TIME', 'APPOINTMENT_COLLISION', 'REASON_REQUIRED', 'EMPTY_PLAN'];
  const message = known.includes(raw) ? raw : fallback;
  if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: message }, { status: 401 });
  if (message === 'CLINIC_CONTEXT_NOT_FOUND' || message === 'FORBIDDEN') return NextResponse.json({ error: message }, { status: 403 });
  if (['HN_ALREADY_EXISTS', 'DUPLICATE_DECISION_REQUIRED', 'IDEMPOTENCY_CONFLICT', 'STALE_WRITE', 'STALE_PREVIEW', 'UNRESOLVED_WORK', 'APPOINTMENT_COLLISION'].includes(message)) return NextResponse.json({ error: message }, { status: 409 });
  if (['PATIENT_NOT_FOUND', 'CASE_NOT_FOUND'].includes(message)) return NextResponse.json({ error: message }, { status: 404 });
  return NextResponse.json({ error: message }, { status: 400 });
}
