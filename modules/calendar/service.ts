import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClinicContext } from '@/lib/auth/context';

export type CalendarReadItem = {
  id: string; entityType: 'task' | 'appointment'; title: string; startsAt: string; status: string; caseId: string;
};

/** The in-app calendar is a read model from clinic-owned business tables. */
export async function listCalendarItems(client: SupabaseClient, context: ClinicContext, from: string, to: string): Promise<CalendarReadItem[]> {
  const [tasks, appointments] = await Promise.all([
    client.from('follow_up_tasks').select('id, case_id, due_at, status, cases(case_number, patients(full_name))').eq('clinic_id', context.clinicId).gte('due_at', from).lt('due_at', to).neq('status', 'cancelled'),
    client.from('appointments').select('id, case_id, starts_at, status, appointment_type, cases(case_number, patients(full_name))').eq('clinic_id', context.clinicId).gte('starts_at', from).lt('starts_at', to).neq('status', 'cancelled'),
  ]);
  if (tasks.error) throw tasks.error; if (appointments.error) throw appointments.error;
  const taskItems = (tasks.data ?? []).map((task: any) => ({ id: task.id, entityType: 'task' as const, title: `ติดตาม ${task.cases?.patients?.full_name ?? task.cases?.case_number ?? ''}`, startsAt: task.due_at, status: task.status, caseId: task.case_id }));
  const appointmentItems = (appointments.data ?? []).map((item: any) => ({ id: item.id, entityType: 'appointment' as const, title: `${item.appointment_type} · ${item.cases?.patients?.full_name ?? item.cases?.case_number ?? ''}`, startsAt: item.starts_at, status: item.status, caseId: item.case_id }));
  return [...taskItems, ...appointmentItems].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function enqueueCalendarSync(client: SupabaseClient, context: ClinicContext, entityType: 'task' | 'appointment', entityId: string, operation: 'upsert' | 'cancel') {
  const idempotencyKey = `${entityType}:${entityId}`;
  const { error } = await client.from('calendar_sync_outbox').upsert({ clinic_id: context.clinicId, entity_type: entityType, entity_id: entityId, operation, idempotency_key: idempotencyKey, status: 'pending' }, { onConflict: 'clinic_id,idempotency_key,operation', ignoreDuplicates: true });
  if (error) throw error;
}
