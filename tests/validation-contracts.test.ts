import { describe, expect, it } from 'vitest';
import { createAppointmentSchema, createPatientSchema, recordFollowUpResultSchema } from '../lib/validation/contracts';
import { planCycleActionSchema } from '../lib/validation/plan-cycles';
import { appointmentTransitionSchema, patientUpdateSchema } from '../lib/validation/workflow';

const id = '11111111-1111-4111-8111-111111111111';
const appointment = { requestId: id, caseId: id, appointmentType: 'ประเมิน', startsAt: '2026-10-01T02:00:00Z', endsAt: '2026-10-01T03:00:00Z' };

describe('validation format API regression', () => {
  it('accepts UUID and UTC appointment times with optional fields omitted', () => {
    expect(createAppointmentSchema.parse(appointment)).toEqual(appointment);
  });
  it.each(['AUTH_USER_UUID', 'not-a-uuid', ''])('rejects invalid record identity %s', (caseId) => {
    expect(createAppointmentSchema.safeParse({ ...appointment, caseId }).success).toBe(false);
  });
  it.each(['2026-10-01T02:00:00Z', '2026-10-01T01:00:00Z'])('preserves end-after-start field error for %s', (endsAt) => {
    const result = createAppointmentSchema.safeParse({ ...appointment, endsAt });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ['endsAt'], message: 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม' }));
  });
  it('does not accept a timezone-less appointment timestamp', () => {
    expect(createAppointmentSchema.safeParse({ ...appointment, startsAt: '2026-10-01T09:00:00' }).success).toBe(false);
  });
  it('retains offset support and optimistic revision input for operational updates', () => {
    expect(patientUpdateSchema.safeParse({ expectedUpdatedAt: '2026-10-01T09:00:00+07:00', reason: 'แก้ช่องทางติดต่อ', ownerId: id }).success).toBe(true);
    expect(patientUpdateSchema.safeParse({ expectedUpdatedAt: '2026-10-01T09:00:00', reason: 'แก้ข้อมูล' }).success).toBe(false);
  });
  it('validates calendar dates without converting an anchor into a timestamp', () => {
    const value = { action: 'activate', requestId: id, planId: id, anchorDate: '2026-10-01', eventKind: 'procedure', reason: 'ยืนยันวันที่จริง', expectedRevision: 1 };
    expect(planCycleActionSchema.parse(value)).toEqual(value);
    expect(planCycleActionSchema.safeParse({ ...value, anchorDate: '2026-02-30' }).success).toBe(false);
    expect(planCycleActionSchema.safeParse({ ...value, anchorDate: appointment.startsAt }).success).toBe(false);
  });
  it('retains email and birth-date validation', () => {
    expect(createPatientSchema.safeParse({ fullName: 'ผู้ทดสอบ', email: 'staff@example.test', birthDate: '2000-02-29' }).success).toBe(true);
    expect(createPatientSchema.safeParse({ fullName: 'ผู้ทดสอบ', email: 'invalid', birthDate: '2001-02-29' }).success).toBe(false);
  });
  it('retains reported/performed identities and explicit retry date on results', () => {
    const result = { requestId: id, taskId: id, occurredAt: appointment.startsAt, contactChannel: 'phone', contactStatus: 'no_answer', outcome: 'ติดต่อไม่ได้', summary: 'โทรแล้วไม่มีผู้รับ', performedBy: id, reportedBy: id, retryDueAt: appointment.endsAt };
    expect(recordFollowUpResultSchema.parse(result)).toEqual(result);
  });
  it('still requires both dates when rescheduling', () => {
    const transition = { expectedUpdatedAt: appointment.startsAt, status: 'rescheduled', reason: 'เปลี่ยนวัน' };
    expect(appointmentTransitionSchema.safeParse(transition).success).toBe(false);
    expect(appointmentTransitionSchema.safeParse({ ...transition, startsAt: appointment.startsAt, endsAt: appointment.endsAt }).success).toBe(true);
  });
});
