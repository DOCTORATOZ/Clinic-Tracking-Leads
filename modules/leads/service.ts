import type { SupabaseClient } from '@supabase/supabase-js';
import { createCaseSchema, type CreateCaseInput } from '@/lib/validation/contracts';
import type { ClinicContext } from '@/lib/auth/context';
import { requireRole } from '@/lib/auth/context';
import { createPatient } from '@/modules/patients/service';
import { writeAuditEvent } from '@/modules/audit/service';
import { generatePlanTasks } from '@/modules/follow-ups/generate-tasks';

export async function createCase(client: SupabaseClient, context: ClinicContext, unsafeInput: CreateCaseInput) {
  requireRole(context, ['admin', 'manager']);
  const input = createCaseSchema.parse(unsafeInput);
  const patientId = input.patientDecision.kind === 'link'
    ? input.patientDecision.patientId
    : (await createPatient(client, context, input.patientDecision.patient)).id;
  const { data: caseNumber, error: numberError } = await client.rpc('next_case_number', { target_clinic: context.clinicId });
  if (numberError) throw numberError;
  const selectedPlanId = input.planId ?? (await client.from('service_catalog').select('default_follow_up_plan_id').eq('id', input.serviceId ?? '').maybeSingle()).data?.default_follow_up_plan_id ?? null;
  if (input.planId && !input.planOverrideReason) throw new Error('PLAN_OVERRIDE_REASON_REQUIRED');
  const { data, error } = await client.from('cases').insert({
    clinic_id: context.clinicId, patient_id: patientId, source_id: input.sourceId, service_id: input.serviceId,
    case_number: caseNumber, source_received_at: input.sourceReceivedAt, concern: input.concern,
    priority: input.priority, assigned_to: input.assignedTo, selected_plan_id: selectedPlanId,
    plan_override_reason: input.planOverrideReason, created_by: context.userId,
    state: input.assignedTo ? 'awaiting_nurse_call' : 'new',
  }).select().single();
  if (error) throw error;
  if (selectedPlanId) await generatePlanTasks(client, context, data.id, selectedPlanId, new Date(input.sourceReceivedAt));
  await writeAuditEvent(client, context, { entityType: 'case', entityId: data.id, action: 'case.created', reason: input.patientDecision.duplicateReason, afterData: { caseNumber: data.case_number, patientId, selectedPlanId } });
  return data;
}
