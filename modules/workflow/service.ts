import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClinicContext } from '@/lib/auth/context';

async function rpc(client: SupabaseClient, name: string, values: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, values);
  if (error) throw error;
  return data;
}

export const updatePatient = (client: SupabaseClient, _context: ClinicContext, patientId: string, input: unknown) =>
  rpc(client, 'update_patient_profile', { p_patient_id: patientId, p_input: input });
export const updateCase = (client: SupabaseClient, _context: ClinicContext, caseId: string, input: unknown) =>
  rpc(client, 'update_case_operational', { p_case_id: caseId, p_input: input });
export const assignCase = (client: SupabaseClient, _context: ClinicContext, caseId: string, input: { nurseId: string; reason?: string }) =>
  rpc(client, 'assign_case_nurse', { p_case_id: caseId, p_nurse_id: input.nurseId, p_reason: input.reason ?? null });
export const transitionCase = (client: SupabaseClient, _context: ClinicContext, caseId: string, input: { action: 'close' | 'reopen'; reason?: string }) =>
  rpc(client, 'transition_case_lifecycle', { p_case_id: caseId, p_action: input.action, p_reason: input.reason ?? null });
export const transitionTask = (client: SupabaseClient, _context: ClinicContext, taskId: string, input: unknown) =>
  rpc(client, 'transition_follow_up_task', { p_task_id: taskId, p_input: input });
export const createManualTask = (client: SupabaseClient, _context: ClinicContext, caseId: string, input: unknown) =>
  rpc(client, 'create_manual_follow_up_task', { p_case_id: caseId, p_input: input });
export const transitionAppointment = (client: SupabaseClient, _context: ClinicContext, appointmentId: string, input: unknown) =>
  rpc(client, 'transition_appointment_workflow_v2', { p_appointment_id: appointmentId, p_input: input });
export const correctResult = (client: SupabaseClient, _context: ClinicContext, resultId: string, input: unknown) =>
  rpc(client, 'add_follow_up_result_correction', { p_result_id: resultId, p_input: input });
