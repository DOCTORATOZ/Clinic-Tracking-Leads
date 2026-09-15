import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClinicContext } from '@/lib/auth/context';

export type OperationalNotification = {
  recipientUserId?: string;
  kind: 'task_overdue' | 'appointment_due' | 'calendar_sync_failed' | 'needs_review';
  title: string;
  body?: string;
  caseId?: string;
  appointmentId?: string;
};

/** Internal operational inbox only. It never sends a patient-facing message. */
export async function createOperationalNotification(
  client: SupabaseClient,
  context: ClinicContext,
  notification: OperationalNotification,
) {
  const { error } = await client.from('operational_notifications').insert({
    clinic_id: context.clinicId,
    recipient_user_id: notification.recipientUserId,
    kind: notification.kind,
    title: notification.title,
    body: notification.body,
    case_id: notification.caseId,
    appointment_id: notification.appointmentId,
  });
  if (error) throw error;
}
