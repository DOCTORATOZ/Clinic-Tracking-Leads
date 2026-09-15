import { z } from 'zod';

const id = z.string().uuid();

export const createPatientSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  hn: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().email().optional(),
  birthDate: z.string().date().optional(),
  preferredContactChannel: z.enum(['phone', 'line_oa', 'facebook', 'tiktok', 'other']).optional(),
  doNotContact: z.boolean().default(false),
  careContactConsentAt: z.string().datetime().optional(),
  // Marketing consent is deliberately not collected by the Phase 1 intake UI.
  marketingConsentAt: z.string().datetime().optional(),
});

export const patientMatchSchema = z.object({
  hn: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
});

export const createCaseSchema = z.object({
  patientDecision: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('link'), patientId: id, duplicateReason: z.string().trim().min(1) }),
    z.object({ kind: z.literal('create'), patient: createPatientSchema, duplicateReason: z.string().trim().min(1).optional() }),
  ]),
  sourceId: id.optional(),
  serviceId: id.optional(),
  sourceReceivedAt: z.string().datetime(),
  concern: z.string().trim().max(5000).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  assignedTo: id.optional(),
  planId: id.optional(),
  planOverrideReason: z.string().trim().min(1).optional(),
});

export const recordFollowUpResultSchema = z.object({
  taskId: id,
  occurredAt: z.string().datetime(),
  contactChannel: z.enum(['phone', 'line_oa', 'facebook', 'tiktok', 'other']),
  contactStatus: z.enum(['contacted', 'no_answer', 'wrong_number', 'declined']),
  outcome: z.string().trim().min(1).max(100),
  symptomStatus: z.string().trim().max(100).optional(),
  summary: z.string().trim().min(1).max(5000),
  nextAction: z.string().trim().max(1000).optional(),
  performedBy: id.optional(),
  reportedBy: id.optional(),
  retryDueAt: z.string().datetime().optional(),
});

export const createAppointmentSchema = z.object({
  caseId: id,
  sourceResultId: id.optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  appointmentType: z.string().trim().min(1).max(200),
  branch: z.string().trim().max(200).optional(),
  providerName: z.string().trim().max(200).optional(),
});

export const transitionAppointmentSchema = z.object({
  appointmentId: id,
  status: z.enum(['scheduled', 'completed', 'rescheduled', 'cancelled', 'no_show']),
  reason: z.string().trim().min(1).max(1000),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type RecordFollowUpResultInput = z.infer<typeof recordFollowUpResultSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
