import type { SupabaseClient } from '@supabase/supabase-js';
import { createCaseSchema, type CreateCaseInput } from '@/lib/validation/contracts';
import type { ClinicContext } from '@/lib/auth/context';
import { requireRole } from '@/lib/auth/context';
import { normalizeHn, normalizePhone } from '@/lib/validation/normalization';

export async function createCase(client: SupabaseClient, context: ClinicContext, unsafeInput: CreateCaseInput) {
  requireRole(context, ['admin', 'manager']);
  const input = createCaseSchema.parse(unsafeInput);
  const selectedPlanId = input.planId ?? (await client.from('service_catalog').select('default_follow_up_plan_id').eq('id', input.serviceId ?? '').maybeSingle()).data?.default_follow_up_plan_id ?? null;
  if (input.planId && !input.planOverrideReason) throw new Error('PLAN_OVERRIDE_REASON_REQUIRED');
  const patientDecision = input.patientDecision.kind === 'link' ? input.patientDecision : {
    ...input.patientDecision,
    patient: { ...input.patientDecision.patient, hn: normalizeHn(input.patientDecision.patient.hn), phone: normalizePhone(input.patientDecision.patient.phone) },
  };
  const { data, error } = await client.rpc('create_case_workflow', {
    p_clinic_id: context.clinicId, p_patient_decision: patientDecision, p_source_id: input.sourceId ?? null,
    p_service_id: input.serviceId ?? null, p_source_received_at: input.sourceReceivedAt, p_concern: input.concern ?? null,
    p_priority: input.priority, p_assigned_to: input.assignedTo ?? null, p_plan_id: selectedPlanId,
    p_plan_override_reason: input.planOverrideReason ?? null,
  });
  if (error) throw error;
  return data;
}
