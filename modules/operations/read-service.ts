import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClinicContext } from '@/lib/auth/context';

export async function listCases(
  client: SupabaseClient,
  context: ClinicContext,
) {
  if (context.role === 'care_coordinator') {
    const { data, error } = await client
      .from('coordination_cases')
      .select(
        'id,case_number,state,priority,source_received_at,full_name,phone_normalized,source_label,service_name,assigned_to',
      )
      .order('source_received_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []).map((item) => ({
      ...item,
      patients: [{ full_name: item.full_name }],
      sources: item.source_label ? [{ label: item.source_label }] : [],
    }));
  }
  if (context.role === 'nurse') {
    const { data, error } = await client
      .from('nurse_cases')
      .select(
        'id,case_number,state,priority,source_received_at,full_name,hn_normalized,phone_normalized,source_label,service_name,assigned_to',
      )
      .order('source_received_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []).map((item) => ({
      ...item,
      patients: [
        {
          full_name: item.full_name,
          phone_normalized: item.phone_normalized,
          hn: item.hn_normalized,
        },
      ],
      sources: item.source_label ? [{ label: item.source_label }] : [],
    }));
  }
  const { data, error } = await client
    .from('cases')
    .select(
      'id,case_number,state,priority,source_received_at,assigned_to,service_catalog(name),patients(full_name,phone_normalized,hn_normalized),sources(label)',
    )
    .eq('clinic_id', context.clinicId)
    .order('source_received_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function listFollowUpTasks(
  client: SupabaseClient,
  context: ClinicContext,
) {
  if (context.role === 'care_coordinator') {
    const { data, error } = await client
      .from('coordination_follow_up_tasks')
      .select('id,case_id,due_at,status,step_snapshot,case_number,full_name')
      .in('status', ['pending', 'in_progress', 'paused'])
      .order('due_at')
      .limit(100);
    if (error) throw error;
    return (data ?? []).map((item) => ({
      ...item,
      cases: [
        {
          case_number: item.case_number,
          patients: [{ full_name: item.full_name }],
        },
      ],
    }));
  }
  if (context.role === 'nurse') {
    const { data, error } = await client
      .from('nurse_follow_up_tasks')
      .select(
        'id,case_id,due_at,status,step_snapshot,case_number,full_name,assigned_to',
      )
      .in('status', ['pending', 'in_progress', 'paused'])
      .order('due_at')
      .limit(100);
    if (error) throw error;
    return (data ?? []).map((item) => ({
      ...item,
      cases: [
        {
          case_number: item.case_number,
          patients: [{ full_name: item.full_name }],
        },
      ],
    }));
  }
  const { data, error } = await client
    .from('follow_up_tasks')
    .select(
      'id,case_id,due_at,status,step_snapshot,cases(case_number,patients(full_name))',
    )
    .eq('clinic_id', context.clinicId)
    .in('status', ['pending', 'in_progress', 'paused'])
    .order('due_at')
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function listAppointments(
  client: SupabaseClient,
  context: ClinicContext,
) {
  if (context.role === 'nurse') {
    const { data, error } = await client
      .from('nurse_appointments')
      .select(
        'id,case_id,starts_at,ends_at,appointment_type,branch,provider_name,status,case_number,full_name',
      )
      .order('starts_at')
      .limit(100);
    if (error) throw error;
    return (data ?? []).map((item) => ({
      ...item,
      cases: [
        {
          case_number: item.case_number,
          patients: [{ full_name: item.full_name }],
        },
      ],
    }));
  }
  const { data, error } = await client
    .from('appointments')
    .select(
      'id,case_id,starts_at,ends_at,appointment_type,branch,provider_name,status,cases(case_number,patients(full_name))',
    )
    .eq('clinic_id', context.clinicId)
    .order('starts_at')
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function listNotifications(
  client: SupabaseClient,
  context: ClinicContext,
) {
  const { data, error } = await client
    .from('operational_notifications')
    .select('id,kind,title,body,case_id,appointment_id,read_at,created_at')
    .eq('clinic_id', context.clinicId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data ?? [];
}

export async function listPatientDirectory(
  client: SupabaseClient,
  _context: ClinicContext,
  query?: string,
) {
  const { data, error } = await client.rpc('intake_patient_directory', {
    p_query: query?.trim() ?? '',
  });
  if (error) throw error;
  return data ?? [];
}

export async function getCaseDetail(
  client: SupabaseClient,
  context: ClinicContext,
  caseId: string,
) {
  const item = await client
    .from('cases')
    .select(
      'id,patient_id,case_number,state,lifecycle,care_stage,revision,intake_title,coordination_note,coordinator_id,priority,assigned_to,selected_plan_id,anchor_review_required,source_id,service_id,updated_at,patients(id,full_name,hn_normalized,phone_normalized,social_account,contact_permission)',
    )
    .eq('clinic_id', context.clinicId)
    .eq('id', caseId)
    .maybeSingle();
  if (item.error) throw item.error;
  if (!item.data) throw new Error('CASE_NOT_FOUND');
  const [tasks, appointments, cycles, assignments] = await Promise.all([
    client
      .from('follow_up_tasks')
      .select(
        'id,case_id,due_at,status,assigned_to,step_snapshot,cycle_id,closure_reason',
      )
      .eq('clinic_id', context.clinicId)
      .eq('case_id', caseId)
      .order('due_at'),
    client
      .from('appointments')
      .select(
        'id,starts_at,ends_at,appointment_type,branch,provider_name,status,lifecycle_reason,updated_at',
      )
      .eq('clinic_id', context.clinicId)
      .eq('case_id', caseId)
      .order('starts_at'),
    client
      .from('case_plan_cycles')
      .select(
        'id,plan_id,anchor_date,event_kind,reported_by,recorded_by,revision,created_at',
      )
      .eq('clinic_id', context.clinicId)
      .eq('case_id', caseId)
      .order('created_at'),
    client
      .from('case_assignments')
      .select('id,assigned_to,assigned_by,reason,assigned_at')
      .eq('clinic_id', context.clinicId)
      .eq('case_id', caseId)
      .order('assigned_at'),
  ]);
  for (const result of [tasks, appointments, cycles, assignments])
    if (result.error) throw result.error;
  const taskIds = (tasks.data ?? []).map((task) => task.id);
  const results = taskIds.length
    ? await client
        .from('follow_up_results')
        .select(
          'id,task_id,occurred_at,contact_channel,contact_status,outcome,coordination_summary,next_action,performed_by,reported_by,recorded_by,recorded_at,corrects_result_id,correction_reason',
        )
        .eq('clinic_id', context.clinicId)
        .in('task_id', taskIds)
        .order('occurred_at')
    : { data: [], error: null };
  if (results.error) throw results.error;
  let clinical: unknown = null;
  let clinicalResults: {result_id:string;clinical_summary:string|null;symptom_status:string|null}[] = [];
  if (context.role === 'clinic_admin' || context.role === 'nurse') {
    const details = await client
      .from('case_clinical_details')
      .select('concern')
      .eq('clinic_id', context.clinicId)
      .eq('case_id', caseId)
      .maybeSingle();
    if (details.error) throw details.error;
    clinical = details.data;
    const resultIds=(results.data??[]).map(r=>r.id);
    if(resultIds.length){const reports=await client.from('follow_up_clinical_details').select('result_id,clinical_summary,symptom_status').eq('clinic_id',context.clinicId).in('result_id',resultIds);if(reports.error)throw reports.error;clinicalResults=reports.data??[];}
  }
  const appointmentIds = (appointments.data ?? []).map((item) => item.id);
  const history = appointmentIds.length
    ? await client
        .from('appointment_history')
        .select(
          'id,appointment_id,previous_status,next_status,reason,changed_by,changed_at',
        )
        .eq('clinic_id', context.clinicId)
        .in('appointment_id', appointmentIds)
        .order('changed_at')
    : { data: [], error: null };
  if (history.error) throw history.error;
  return {
    case: item.data,
    tasks: tasks.data ?? [],
    appointments: appointments.data ?? [],
    cycles: cycles.data ?? [],
    assignments: assignments.data ?? [],
    results: results.data ?? [],
    appointmentHistory: history.data ?? [],
    ...(clinical ? { clinical } : {}),
    ...(['nurse','clinic_admin'].includes(context.role)?{clinicalResults}:{}),
  };
}

export async function listReferenceData(
  client: SupabaseClient,
  context: ClinicContext,
) {
  const [sources, services, plans, staff] = await Promise.all([
    client
      .from('sources')
      .select('id,code,label')
      .eq('clinic_id', context.clinicId)
      .eq('active', true)
      .order('label'),
    client
      .from('service_catalog')
      .select('id,code,name,default_follow_up_plan_id')
      .eq('clinic_id', context.clinicId)
      .eq('active', true)
      .order('name'),
    client
      .from('follow_up_plans')
      .select('id,name')
      .eq('clinic_id', context.clinicId)
      .eq('active', true)
      .order('name'),
    client.rpc('workflow_staff_directory'),
  ]);
  if (sources.error) throw sources.error;
  if (services.error) throw services.error;
  if (plans.error) throw plans.error;
  if (staff.error) throw staff.error;
  const people = (staff.data ?? []) as {
    user_id: string;
    display_name: string;
    role: string;
  }[];
  return {
    sources: sources.data ?? [],
    services: services.data ?? [],
    plans: plans.data ?? [],
    nurses: people.filter((person) => person.role === 'nurse'),
    staff: people,
  };
}
