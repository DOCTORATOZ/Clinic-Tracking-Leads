import { z } from 'zod';
import { normalizeHn, normalizePhone } from './normalization';

const optionalText = (max: number) => z.string().trim().max(max).optional();
export const intakePatientSchema = z.object({
  fullName: z.string().trim().min(1, 'กรุณาระบุชื่อหรือชื่อแสดง').max(200),
  hn: optionalText(80).transform(normalizeHn),
  phone: optionalText(40).superRefine((value, ctx) => {
    if (!value) return;
    const normalized = normalizePhone(value) ?? '';
    if (!/^[+\d\s().-]+$/.test(value) || !/^(?:0\d{8,9}|\+[1-9]\d{6,14})$/.test(normalized)) {
      ctx.addIssue({ code: 'custom', message: 'กรุณาระบุเบอร์ไทย 9–10 หลัก หรือเบอร์ต่างประเทศพร้อมรหัสประเทศ' });
    }
  }).transform(normalizePhone),
  socialPlatform: z.enum(['line_oa', 'facebook', 'tiktok', 'other']).optional(),
  socialAccount: optionalText(200),
  representativeName: optionalText(200),
  representativeRelationship: optionalText(100),
  preferredContactChannel: z.enum(['phone', 'line_oa', 'facebook', 'tiktok', 'other']).optional(),
  contactPermission: z.enum(['unknown', 'granted', 'declined']).default('unknown'),
}).superRefine((value, ctx) => {
  if (!value.phone && !value.socialAccount) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'ระบุโทรศัพท์หรือบัญชี social อย่างน้อยหนึ่งช่องทาง' });
  if (value.socialAccount && !value.socialPlatform) ctx.addIssue({ code: 'custom', path: ['socialPlatform'], message: 'เลือกช่องทาง social' });
  if (value.socialPlatform && !value.socialAccount) ctx.addIssue({ code: 'custom', path: ['socialAccount'], message: 'ระบุบัญชี social' });
  if (value.representativeName && !value.representativeRelationship) ctx.addIssue({ code: 'custom', path: ['representativeRelationship'], message: 'ระบุความสัมพันธ์ของผู้ติดต่อแทน' });
});

export const intakeCaseSchema = z.object({
  title: z.string().trim().min(1, 'ระบุหัวข้อหรือเหตุผลที่ติดต่อ').max(200),
  coordinationNote: optionalText(5000),
  sourceId: z.uuid().optional(),
  serviceId: z.uuid().optional(),
  planId: z.uuid().optional(),
  planOverrideReason: optionalText(1000),
  assignedTo: z.uuid().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
});

export const intakeSchema = z.object({
  requestId: z.uuid(),
  mode: z.enum(['lead', 'case']),
  patientDecision: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('create'), patient: intakePatientSchema, duplicateReason: optionalText(1000) }),
    z.object({ kind: z.literal('link'), patientId: z.uuid() }),
  ]),
  ownerId: z.uuid().optional(), // Resolved to authenticated recorder on the server.
  nextContactAt: z.iso.datetime({ offset: true }).optional(),
  case: intakeCaseSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.mode === 'lead' && !value.nextContactAt) ctx.addIssue({ code: 'custom', path: ['nextContactAt'], message: 'ระบุวันติดต่อต่อไป' });
  if (value.mode === 'case' && !value.case) ctx.addIssue({ code: 'custom', path: ['case'], message: 'ระบุรายละเอียดเคส' });
  if (value.mode === 'lead' && value.case) ctx.addIssue({ code: 'custom', path: ['case'], message: 'บันทึกลีดอย่างเดียวต้องไม่มีรายละเอียดเคส' });
});

export type IntakeInput = z.input<typeof intakeSchema>;
export type IntakeResult = { patientId: string; case: { id: string; case_number: string } | null };
