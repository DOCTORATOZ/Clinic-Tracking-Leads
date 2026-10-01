import type { SupabaseClient } from '@supabase/supabase-js';
import { createAppointmentSchema, type CreateAppointmentInput } from '@/lib/validation/contracts';
import type { ClinicContext } from '@/lib/auth/context';
import { requireRole } from '@/lib/auth/context';

export async function createAppointment(client: SupabaseClient, context: ClinicContext, unsafeInput: CreateAppointmentInput) {
  requireRole(context, ['clinic_admin', 'care_coordinator']); const input = createAppointmentSchema.parse(unsafeInput);
  const { data, error } = await client.rpc('create_appointment_workflow_v3', { p_clinic_id: context.clinicId, p_input: input });
  if (error) throw error;
  return data;
}
