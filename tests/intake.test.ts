import { describe, expect, it, vi } from 'vitest';
import { intakeSchema, intakePatientSchema } from '../lib/validation/intake';
import { saveIntake } from '../modules/patients/intake-service';
import type { SupabaseClient } from '@supabase/supabase-js';
const requestId = '11111111-1111-4111-8111-111111111111';
const context = { clinicId: requestId, userId: requestId, role: 'care_coordinator' as const };
const person = { fullName: 'ผู้สนใจทดสอบ', socialPlatform: 'line_oa', socialAccount: 'sample-account' };
describe('person-first intake contract', () => {
  it('accepts social-only person and never assumes consent', () => {
    const value = intakePatientSchema.parse(person);
    expect(value.phone).toBeNull(); expect(value.contactPermission).toBe('unknown');
  });
  it.each(['', '123', 'abcdefgh', '++66812345678', '0815550192junk'])('rejects invalid/missing contact: %s', (phone) => {
    expect(intakePatientSchema.safeParse({ fullName: 'คน', phone }).success).toBe(false);
  });
  it.each(['081-555-0192', '+66 81 555 0192', '+44 20 7946 0958', '02-123-4567'])('accepts phone: %s', (phone) => {
    expect(intakePatientSchema.safeParse({ fullName: 'คน', phone }).success).toBe(true);
  });
  it('requires social platform, representative relationship and a name', () => {
    expect(intakePatientSchema.safeParse({ fullName: '', socialAccount: 'x' }).success).toBe(false);
    expect(intakePatientSchema.safeParse({ ...person, representativeName: 'ญาติ' }).success).toBe(false);
  });
  it('requires callback date only for person-only intake', () => {
    const base = { requestId, patientDecision: { kind: 'create', patient: person } };
    expect(intakeSchema.safeParse({ ...base, mode: 'lead' }).success).toBe(false);
    expect(intakeSchema.safeParse({ ...base, mode: 'lead', nextContactAt: '2026-09-25T09:00:00+07:00' }).success).toBe(true);
    expect(intakeSchema.safeParse({ ...base, mode: 'case', case: { title: 'ขอประเมิน' } }).success).toBe(true);
    expect(intakeSchema.safeParse({ ...base, mode: 'case', case: { title: ' ' } }).success).toBe(false);
  });
  it('links an existing person without replacing their identity or consent', () => {
    const value = intakeSchema.parse({ requestId, mode: 'case', patientDecision: { kind: 'link', patientId: requestId, patient: person }, case: { title: 'เรื่องใหม่' } });
    expect(value.patientDecision).toEqual({ kind: 'link', patientId: requestId });
  });
  it('passes normalized input and recorder ownership to one transaction', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { patientId: requestId, case: null }, error: null });
    await saveIntake({ rpc } as unknown as SupabaseClient, context, { requestId, mode: 'lead', nextContactAt: '2026-09-25T09:00:00Z', patientDecision: { kind: 'create', patient: { fullName: ' คน ', phone: '+66 81 555 0192' } } });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1].p_input.ownerId).toBe(context.userId);
    expect(rpc.mock.calls[0][1].p_input.patientDecision.patient.phone).toBe('0815550192');
  });
  it('rejects viewers before invoking the database', async () => {
    const rpc = vi.fn();
    await expect(saveIntake({ rpc } as unknown as SupabaseClient, { ...context, role: 'viewer' }, {})).rejects.toThrow('FORBIDDEN');
    expect(rpc).not.toHaveBeenCalled();
  });
});
