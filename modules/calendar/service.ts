import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClinicContext } from '@/lib/auth/context';

export type CalendarReadItem = {
  id: string;
  entityType: 'task' | 'appointment';
  title: string;
  startsAt: string;
  status: string;
  syncStatus: 'disabled' | 'pending' | 'synced' | 'failed' | 'needs_review';
  caseId: string;
};

export type CalendarConnectionSummary = {
  status: 'disabled' | 'pending' | 'synced' | 'failed' | 'needs_review';
  destinationCalendarId: string | null;
};

/** The in-app calendar is a read model from clinic-owned business tables. */
export async function listCalendarItems(client: SupabaseClient, context: ClinicContext, from: string, to: string): Promise<CalendarReadItem[]> {
  const taskTable = context.role === 'care_coordinator' ? 'coordination_follow_up_tasks' : context.role === 'nurse' ? 'nurse_follow_up_tasks' : 'follow_up_tasks';
  const appointmentTable = context.role === 'nurse' ? 'nurse_appointments' : 'appointments';
  const taskFields = taskTable === 'follow_up_tasks' ? 'id, case_id, due_at, status, cases(case_number, patients(full_name))' : 'id, case_id, due_at, status, case_number, full_name';
  const appointmentFields = appointmentTable === 'appointments' ? 'id, case_id, starts_at, status, appointment_type, cases(case_number, patients(full_name))' : 'id, case_id, starts_at, status, appointment_type, case_number, full_name';
  const [tasks, appointments] = await Promise.all([
    client.from(taskTable as never).select(taskFields as never).gte('due_at', from).lt('due_at', to).neq('status', 'cancelled'),
    client.from(appointmentTable as never).select(appointmentFields as never).gte('starts_at', from).lt('starts_at', to).neq('status', 'cancelled'),
  ]);
  if (tasks.error) throw tasks.error; if (appointments.error) throw appointments.error;
  const taskRows = (tasks.data ?? []) as Array<Record<string, any>>;
  const appointmentRows = (appointments.data ?? []) as Array<Record<string, any>>;
  const entityIds = [...taskRows.map((task) => task.id as string), ...appointmentRows.map((item) => item.id as string)];
  const { data: links, error: linksError } = context.role === 'clinic_admin' && entityIds.length
    ? await client.from('calendar_event_links').select('entity_type,entity_id,sync_status').eq('clinic_id', context.clinicId).in('entity_id', entityIds)
    : { data: [], error: null };
  if (linksError) throw linksError;
  const syncStatusByEntity = new Map((links ?? []).map((link) => [`${link.entity_type}:${link.entity_id}`, link.sync_status]));
  const taskItems = taskRows.map((task) => {
    const caseRecord = task.cases?.[0];
    return { id: task.id, entityType: 'task' as const, title: `ติดตาม ${task.full_name ?? caseRecord?.patients?.[0]?.full_name ?? task.case_number ?? caseRecord?.case_number ?? ''}`, startsAt: task.due_at, status: task.status, syncStatus: syncStatusByEntity.get(`task:${task.id}`) ?? 'disabled', caseId: task.case_id };
  });
  const appointmentItems = appointmentRows.map((item) => {
    const caseRecord = item.cases?.[0];
    return { id: item.id, entityType: 'appointment' as const, title: `${item.appointment_type} · ${item.full_name ?? caseRecord?.patients?.[0]?.full_name ?? item.case_number ?? caseRecord?.case_number ?? ''}`, startsAt: item.starts_at, status: item.status, syncStatus: syncStatusByEntity.get(`appointment:${item.id}`) ?? 'disabled', caseId: item.case_id };
  });
  return [...taskItems, ...appointmentItems].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function getCalendarConnection(client: SupabaseClient, context: ClinicContext): Promise<CalendarConnectionSummary> {
  const { data, error } = await client
    .from('calendar_connections')
    .select('status,destination_calendar_id')
    .eq('clinic_id', context.clinicId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? { status: data.status, destinationCalendarId: data.destination_calendar_id }
    : { status: 'disabled', destinationCalendarId: null };
}

export async function enqueueCalendarSync(client: SupabaseClient, context: ClinicContext, entityType: 'task' | 'appointment', entityId: string, operation: 'upsert' | 'cancel') {
  const idempotencyKey = `${entityType}:${entityId}`;
  const { error } = await client.from('calendar_sync_outbox').upsert({ clinic_id: context.clinicId, entity_type: entityType, entity_id: entityId, operation, idempotency_key: idempotencyKey, status: 'pending' }, { onConflict: 'clinic_id,idempotency_key,operation', ignoreDuplicates: true });
  if (error) throw error;
}
