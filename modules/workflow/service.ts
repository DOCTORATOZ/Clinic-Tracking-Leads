import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClinicContext } from '@/lib/auth/context';
import { requireRole } from '@/lib/auth/context';
import {patientUpdateSchema,caseUpdateSchema,caseTransitionSchema,assignmentSchema,taskTransitionSchema,manualTaskSchema,correctionSchema,appointmentTransitionSchema} from '@/lib/validation/workflow';

async function rpc(client: SupabaseClient, name: string, values: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, values);
  if (error) throw error;
  return data;
}

export const updatePatient = (client: SupabaseClient, context: ClinicContext, patientId: string, input: unknown) => {
  requireRole(context,['clinic_admin','care_coordinator']);return rpc(client, 'update_patient_intake', { p_patient_id: patientId, p_input: patientUpdateSchema.parse(input) });};
export const updateCase = (client: SupabaseClient, _context: ClinicContext, caseId: string, input: unknown) =>
  rpc(client, 'amend_case', { p_case_id: caseId, p_input: caseUpdateSchema.parse(input) });
export const assignCase = (client: SupabaseClient, _context: ClinicContext, caseId: string, input: { nurseId: string; reason?: string }) =>
  rpc(client, 'assign_case_nurse', { p_case_id: caseId, p_nurse_id: assignmentSchema.parse(input).nurseId, p_reason: assignmentSchema.parse(input).reason });
export const transitionCase = (client: SupabaseClient, _context: ClinicContext, caseId: string, input: unknown) =>
  rpc(client, 'transition_case_checked', { p_case_id: caseId, p_input: caseTransitionSchema.parse(input) });
export const transitionTask = (client: SupabaseClient, _context: ClinicContext, taskId: string, input: unknown) =>
  rpc(client, 'transition_follow_up_task', { p_task_id: taskId, p_input: taskTransitionSchema.parse(input) });
export const createManualTask = (client: SupabaseClient, _context: ClinicContext, caseId: string, input: unknown) =>
  rpc(client, 'create_manual_follow_up_task', { p_case_id: caseId, p_input: manualTaskSchema.parse(input) });
export const transitionAppointment = (client: SupabaseClient, _context: ClinicContext, appointmentId: string, input: unknown) =>
  rpc(client, 'transition_appointment_checked', { p_appointment_id: appointmentId, p_input: appointmentTransitionSchema.parse(input) });
export const correctResult = (client: SupabaseClient, _context: ClinicContext, resultId: string, input: unknown) =>
  rpc(client, 'add_follow_up_result_correction', { p_result_id: resultId, p_input: correctionSchema.parse(input) });
