import type { SupabaseClient } from '@supabase/supabase-js';
import { createAppointmentSchema, transitionAppointmentSchema, type CreateAppointmentInput } from '@/lib/validation/contracts';
import type { ClinicContext } from '@/lib/auth/context';
import { requireRole } from '@/lib/auth/context';
import { writeAuditEvent } from '@/modules/audit/service';

export async function createAppointment(client: SupabaseClient, context: ClinicContext, unsafeInput: CreateAppointmentInput) {
  requireRole(context, ['admin', 'manager']); const input = createAppointmentSchema.parse(unsafeInput);
  const { data, error } = await client.rpc('create_appointment_workflow', { p_clinic_id: context.clinicId, p_input: input });
  if (error) throw error;
  return data;
}

export async function transitionAppointment(client: SupabaseClient, context: ClinicContext, unsafeInput: unknown) {
  requireRole(context, ['admin', 'manager']); const input = transitionAppointmentSchema.parse(unsafeInput);
  const { data: previous, error: previousError } = await client.from('appointments').select('status').eq('id', input.appointmentId).eq('clinic_id', context.clinicId).single();
  if (previousError) throw previousError;
  const { error } = await client.from('appointments').update({ status: input.status, lifecycle_reason: input.reason, starts_at: input.startsAt, ends_at: input.endsAt }).eq('id', input.appointmentId).eq('clinic_id', context.clinicId);
  if (error) throw error;
  await client.from('appointment_history').insert({ clinic_id: context.clinicId, appointment_id: input.appointmentId, previous_status: previous.status, next_status: input.status, reason: input.reason, changed_by: context.userId });
  await writeAuditEvent(client, context, { entityType: 'appointment', entityId: input.appointmentId, action: `appointment.${input.status}`, reason: input.reason });
}
