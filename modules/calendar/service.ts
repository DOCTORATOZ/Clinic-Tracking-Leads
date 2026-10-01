import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClinicContext } from '@/lib/auth/context';

export type CalendarReadItem = {
  id: string; entityType: 'task' | 'appointment'; title: string; startsAt: string;
  status: string; syncStatus: 'disabled' | 'pending' | 'synced' | 'failed' | 'needs_review';
  caseId: string; assigneeId: string | null;
};
export type CalendarConnectionSummary = {
  status: 'disabled' | 'pending' | 'synced' | 'failed' | 'needs_review'; destinationCalendarId: string | null;
};
type CaseLabel = { case_number: string; assigned_to: string | null; patients: { full_name: string } | { full_name: string }[] };
const one = <T,>(value: T | T[] | null | undefined): T | undefined => Array.isArray(value) ? value[0] : value ?? undefined;

/** Operational projections only. Base-table RLS enforces active clinic and Nurse assignment. */
export async function listCalendarItems(client: SupabaseClient, context: ClinicContext, from: string, to: string): Promise<CalendarReadItem[]> {
  const [tasks, appointments] = await Promise.all([
    client.from('follow_up_tasks').select('id,case_id,due_at,status,assigned_to,cases(case_number,assigned_to,patients(full_name))').eq('clinic_id',context.clinicId).gte('due_at',from).lt('due_at',to).order('due_at'),
    client.from('appointments').select('id,case_id,starts_at,status,appointment_type,cases(case_number,assigned_to,patients(full_name))').eq('clinic_id',context.clinicId).gte('starts_at',from).lt('starts_at',to).order('starts_at'),
  ]);
  if(tasks.error)throw tasks.error;if(appointments.error)throw appointments.error;
  const label=(relation:CaseLabel|CaseLabel[])=>{const record=one(relation);return one(record?.patients)?.full_name??record?.case_number??'';};
  return [
    ...(tasks.data??[]).map(row=>({id:row.id,entityType:'task' as const,title:'ติดตาม '+label(row.cases),startsAt:row.due_at,status:row.status,syncStatus:'disabled' as const,caseId:row.case_id,assigneeId:row.assigned_to??one(row.cases)?.assigned_to??null})),
    ...(appointments.data??[]).map(row=>({id:row.id,entityType:'appointment' as const,title:row.appointment_type+' · '+label(row.cases),startsAt:row.starts_at,status:row.status,syncStatus:'disabled' as const,caseId:row.case_id,assigneeId:one(row.cases)?.assigned_to??null})),
  ].sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
}

export async function getCalendarConnection(_client: SupabaseClient, _context: ClinicContext): Promise<CalendarConnectionSummary> {
  // Live sync is deliberately unavailable in this release, even for legacy links.
  return {status:'disabled',destinationCalendarId:null};
}
