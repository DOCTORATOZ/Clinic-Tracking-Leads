import type { SupabaseClient } from '@supabase/supabase-js';
import { recordFollowUpResultSchema, type RecordFollowUpResultInput } from '@/lib/validation/contracts';
import type { ClinicContext } from '@/lib/auth/context';
import { requireRole } from '@/lib/auth/context';

export async function recordFollowUpResult(client: SupabaseClient, context: ClinicContext, unsafeInput: RecordFollowUpResultInput) {
  requireRole(context, ['clinic_admin', 'care_coordinator', 'nurse']);
  const input = recordFollowUpResultSchema.parse(unsafeInput);
  const { data, error } = await client.rpc('record_follow_up_result_workflow_v2', { p_clinic_id: context.clinicId, p_input: input });
  if (error) throw error;
  return data;
}
