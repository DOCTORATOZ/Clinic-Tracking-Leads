import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClinicContext } from '@/lib/auth/context';

export async function listCases(client: SupabaseClient, context: ClinicContext) {
  if (context.role === 'care_coordinator') {
    const { data, error } = await client.from('coordination_cases').select('id,case_number,state,priority,source_received_at,full_name,phone_normalized,source_label').order('source_received_at', { ascending: false }).limit(100);
    if (error) throw error;
    return (data ?? []).map((item) => ({ ...item, patients: [{ full_name: item.full_name }], sources: item.source_label ? [{ label: item.source_label }] : [] }));
  }
  const { data, error } = await client.from('cases').select('id,case_number,state,priority,source_received_at,patients(full_name,phone_normalized),sources(label)').eq('clinic_id', context.clinicId).order('source_received_at', { ascending: false }).limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function listFollowUpTasks(client: SupabaseClient, context: ClinicContext) {
  if (context.role === 'care_coordinator') {
    const { data, error } = await client.from('coordination_follow_up_tasks').select('id,case_id,due_at,status,step_snapshot,case_number,full_name').in('status', ['pending', 'in_progress', 'paused']).order('due_at').limit(100);
    if (error) throw error;
    return (data ?? []).map((item) => ({ ...item, cases: [{ case_number: item.case_number, patients: [{ full_name: item.full_name }] }] }));
  }
  const { data, error } = await client.from('follow_up_tasks').select('id,case_id,due_at,status,step_snapshot,cases(case_number,patients(full_name))').eq('clinic_id', context.clinicId).in('status', ['pending', 'in_progress', 'paused']).order('due_at').limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function listAppointments(client: SupabaseClient, context: ClinicContext) {
  const { data, error } = await client.from('appointments').select('id,case_id,starts_at,ends_at,appointment_type,branch,provider_name,status,cases(case_number,patients(full_name))').eq('clinic_id', context.clinicId).order('starts_at').limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function listNotifications(client: SupabaseClient, context: ClinicContext) {
  const { data, error } = await client.from('operational_notifications').select('id,kind,title,body,case_id,appointment_id,read_at,created_at').eq('clinic_id', context.clinicId).order('created_at', { ascending: false }).limit(30);
  if (error) throw error;
  return data ?? [];
}

export async function listReferenceData(client: SupabaseClient, context: ClinicContext) {
  const [sources, services, plans] = await Promise.all([
    client.from('sources').select('id,code,label').eq('clinic_id', context.clinicId).eq('active', true).order('label'),
    client.from('service_catalog').select('id,code,name,default_follow_up_plan_id').eq('clinic_id', context.clinicId).eq('active', true).order('name'),
    client.from('follow_up_plans').select('id,name').eq('clinic_id', context.clinicId).eq('active', true).order('name'),
  ]);
  if (sources.error) throw sources.error;
  if (services.error) throw services.error;
  if (plans.error) throw plans.error;
  return { sources: sources.data ?? [], services: services.data ?? [], plans: plans.data ?? [] };
}
