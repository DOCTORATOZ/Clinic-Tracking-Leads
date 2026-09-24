import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClinicContext } from '@/lib/auth/context';

export async function listCases(client: SupabaseClient, context: ClinicContext) {
  if (context.role === 'care_coordinator') {
    const { data, error } = await client.from('coordination_cases').select('id,case_number,state,priority,source_received_at,full_name,phone_normalized,source_label,service_name,assigned_to').order('source_received_at', { ascending: false }).limit(100);
    if (error) throw error;
    return (data ?? []).map((item) => ({ ...item, patients: [{ full_name: item.full_name }], sources: item.source_label ? [{ label: item.source_label }] : [] }));
  }
  if (context.role === 'nurse') {
    const { data, error } = await client.from('nurse_cases').select('id,case_number,state,priority,source_received_at,full_name,hn_normalized,phone_normalized,source_label,service_name,assigned_to').order('source_received_at', { ascending: false }).limit(100);
    if (error) throw error;
    return (data ?? []).map((item) => ({ ...item, patients: [{ full_name: item.full_name, phone_normalized: item.phone_normalized, hn: item.hn_normalized }], sources: item.source_label ? [{ label: item.source_label }] : [] }));
  }
  const { data, error } = await client.from('cases').select('id,case_number,state,priority,source_received_at,assigned_to,service_catalog(name),patients(full_name,phone_normalized,hn_normalized),sources(label)').eq('clinic_id', context.clinicId).order('source_received_at', { ascending: false }).limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function listFollowUpTasks(client: SupabaseClient, context: ClinicContext) {
  if (context.role === 'care_coordinator') {
    const { data, error } = await client.from('coordination_follow_up_tasks').select('id,case_id,due_at,status,step_snapshot,case_number,full_name').in('status', ['pending', 'in_progress', 'paused']).order('due_at').limit(100);
    if (error) throw error;
    return (data ?? []).map((item) => ({ ...item, cases: [{ case_number: item.case_number, patients: [{ full_name: item.full_name }] }] }));
  }
  if (context.role === 'nurse') {
    const { data, error } = await client.from('nurse_follow_up_tasks').select('id,case_id,due_at,status,step_snapshot,case_number,full_name,assigned_to').in('status', ['pending', 'in_progress', 'paused']).order('due_at').limit(100);
    if (error) throw error;
    return (data ?? []).map((item) => ({ ...item, cases: [{ case_number: item.case_number, patients: [{ full_name: item.full_name }] }] }));
  }
  const { data, error } = await client.from('follow_up_tasks').select('id,case_id,due_at,status,step_snapshot,cases(case_number,patients(full_name))').eq('clinic_id', context.clinicId).in('status', ['pending', 'in_progress', 'paused']).order('due_at').limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function listAppointments(client: SupabaseClient, context: ClinicContext) {
  if (context.role === 'nurse') {
    const { data, error } = await client.from('nurse_appointments').select('id,case_id,starts_at,ends_at,appointment_type,branch,provider_name,status,case_number,full_name').order('starts_at').limit(100);
    if (error) throw error;
    return (data ?? []).map((item) => ({ ...item, cases: [{ case_number: item.case_number, patients: [{ full_name: item.full_name }] }] }));
  }
  const { data, error } = await client.from('appointments').select('id,case_id,starts_at,ends_at,appointment_type,branch,provider_name,status,cases(case_number,patients(full_name))').eq('clinic_id', context.clinicId).order('starts_at').limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function listNotifications(client: SupabaseClient, context: ClinicContext) {
  const { data, error } = await client.from('operational_notifications').select('id,kind,title,body,case_id,appointment_id,read_at,created_at').eq('clinic_id', context.clinicId).order('created_at', { ascending: false }).limit(30);
  if (error) throw error;
  return data ?? [];
}

export async function listPatientDirectory(client: SupabaseClient, context: ClinicContext, query?: string) {
  const needle = query?.trim().toLowerCase() ?? '';
  const rows = await listCases(client, context);
  const grouped = new Map<string, { id: string; fullName: string; phone: string | null; hn: string | null; caseCount: number; caseIds: string[] }>();
  for (const row of rows as Array<any>) {
    const patient = row.patients?.[0] ?? { full_name: row.full_name ?? 'ไม่ระบุชื่อ', phone_normalized: row.phone_normalized ?? null, hn: null };
    const key = `${patient.full_name}:${patient.phone_normalized ?? ''}`;
    const current = grouped.get(key) ?? { id: key, fullName: patient.full_name, phone: patient.phone_normalized ?? null, hn: ('hn' in patient ? patient.hn ?? null : null), caseCount: 0, caseIds: [] as string[] };
    current.caseCount += 1; current.caseIds.push(row.id); grouped.set(key, current);
  }
  return [...grouped.values()].filter((item) => !needle || `${item.fullName} ${item.phone ?? ''} ${item.hn ?? ''}`.toLowerCase().includes(needle));
}

export async function getCaseDetail(client: SupabaseClient, context: ClinicContext, caseId: string) {
  const [cases, tasks, appointments] = await Promise.all([listCases(client, context), listFollowUpTasks(client, context), listAppointments(client, context)]);
  const item = cases.find((row) => row.id === caseId);
  if (!item) throw new Error('CASE_NOT_FOUND');
  let results: unknown[] = [];
  if (context.role === 'clinic_admin') {
    const taskIds = tasks.filter((task) => task.case_id === caseId).map((task) => task.id);
    if (taskIds.length) { const { data, error } = await client.from('follow_up_results').select('id,task_id,occurred_at,contact_status,outcome,coordination_summary,next_action,performed_by,reported_by,recorded_by,corrects_result_id,correction_reason').in('task_id', taskIds).order('occurred_at'); if (error) throw error; results = data ?? []; }
  } else if (context.role === 'care_coordinator') {
    const taskIds = tasks.filter((task) => task.case_id === caseId).map((task) => task.id);
    if (taskIds.length) { const { data, error } = await client.from('coordination_follow_up_results').select('id,task_id,occurred_at,contact_status,outcome,coordination_summary,next_action,performed_by,reported_by,recorded_by').in('task_id', taskIds).order('occurred_at'); if (error) throw error; results = data ?? []; }
  }
  return { case: item, tasks: tasks.filter((task) => task.case_id === caseId), appointments: appointments.filter((appointment) => appointment.case_id === caseId), results };
}

export async function listReferenceData(client: SupabaseClient, context: ClinicContext) {
  const [sources, services, plans, nurses] = await Promise.all([
    client.from('sources').select('id,code,label').eq('clinic_id', context.clinicId).eq('active', true).order('label'),
    client.from('service_catalog').select('id,code,name,default_follow_up_plan_id').eq('clinic_id', context.clinicId).eq('active', true).order('name'),
    client.from('follow_up_plans').select('id,name').eq('clinic_id', context.clinicId).eq('active', true).order('name'),
    context.role === 'clinic_admin' || context.role === 'care_coordinator'
      ? client.from('clinic_nurse_directory').select('user_id,display_name').order('display_name')
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (sources.error) throw sources.error;
  if (services.error) throw services.error;
  if (plans.error) throw plans.error;
  if (nurses.error) throw nurses.error;
  return { sources: sources.data ?? [], services: services.data ?? [], plans: plans.data ?? [], nurses: nurses.data ?? [] };
}
