import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { ClinicContext } from '@/lib/auth/context';
import { requireRole } from '@/lib/auth/context';

const id = z.uuid();
const sourceSchema = z.object({ action: z.enum(['create', 'update', 'archive', 'reactivate']), id: id.optional(), code: z.string().trim().max(80).optional(), label: z.string().trim().max(200).optional() });
const serviceSchema = z.object({ action: z.enum(['create', 'update', 'archive', 'reactivate']), id: id.optional(), code: z.string().trim().max(80).optional(), name: z.string().trim().max(200).optional(), planId: id.nullable().optional() });
const planSchema = z.object({ previousPlanId: id.nullable().optional(), name: z.string().trim().min(1).max(200), steps: z.array(z.object({ sequence: z.number().int().min(1), dayOffset: z.number().int().min(0), dueTime: z.string().regex(/^\d{2}:\d{2}/), instruction: z.string().trim().max(1000).optional() })).min(1) });

function admin(context: ClinicContext) { requireRole(context, ['clinic_admin']); }
async function rpc(client: SupabaseClient, name: string, values: Record<string, unknown>) { const { data, error } = await client.rpc(name, values); if (error) throw error; return data; }

export async function getAdminData(client: SupabaseClient, context: ClinicContext) {
  admin(context);
  const [clinic, sources, services, plans] = await Promise.all([
    client.from('clinics').select('id,name,timezone,case_number_prefix,case_number_next').eq('id', context.clinicId).single(),
    client.from('sources').select('id,code,label,active').eq('clinic_id', context.clinicId).order('label'),
    client.from('service_catalog').select('id,code,name,active,default_follow_up_plan_id').eq('clinic_id', context.clinicId).order('name'),
    client.from('follow_up_plans').select('id,name,version,active,supersedes_plan_id,created_at,follow_up_plan_steps(id,sequence,day_offset,due_time,instruction)').eq('clinic_id', context.clinicId).order('name').order('version', { ascending: false }),
  ]);
  for (const result of [clinic, sources, services, plans]) if (result.error) throw result.error;
  return { clinic: clinic.data, sources: sources.data ?? [], services: services.data ?? [], plans: plans.data ?? [] };
}

export async function updateClinicConfig(client: SupabaseClient, context: ClinicContext, input: unknown) {
  admin(context); const data = z.object({ name: z.string().trim().min(1).max(200), caseNumberPrefix: z.string().trim().regex(/^[A-Z0-9]{1,12}$/) }).parse(input);
  return rpc(client, 'update_clinic_configuration', { p_name: data.name, p_case_number_prefix: data.caseNumberPrefix });
}
export async function mutateSource(client: SupabaseClient, context: ClinicContext, input: unknown) {
  admin(context); const data = sourceSchema.parse(input); if (['create', 'update'].includes(data.action) && (!data.code || !data.label)) throw new Error('INVALID_SOURCE');
  return rpc(client, 'manage_clinic_source', { p_action: data.action, p_source_id: data.id ?? null, p_code: data.code ?? null, p_label: data.label ?? null });
}
export async function mutateService(client: SupabaseClient, context: ClinicContext, input: unknown) {
  admin(context); const data = serviceSchema.parse(input); if (['create', 'update'].includes(data.action) && (!data.code || !data.name)) throw new Error('INVALID_SERVICE');
  return rpc(client, 'manage_clinic_service', { p_action: data.action, p_service_id: data.id ?? null, p_code: data.code ?? null, p_name: data.name ?? null, p_plan_id: data.planId ?? null });
}
export async function createPlanVersion(client: SupabaseClient, context: ClinicContext, input: unknown) {
  admin(context); const data = planSchema.parse(input);
  return rpc(client, 'create_follow_up_plan_version', { p_previous_plan_id: data.previousPlanId ?? null, p_name: data.name, p_steps: data.steps.map((step) => ({ sequence: step.sequence, day_offset: step.dayOffset, due_time: step.dueTime, instruction: step.instruction ?? null })) });
}
export async function listAudit(client: SupabaseClient, context: ClinicContext, before?: string) {
  admin(context); let query = client.from('clinic_audit_timeline').select('id,entity_type,entity_id,action,reason,occurred_at,actor_name').order('occurred_at', { ascending: false }).limit(50);
  if (before) query = query.lt('occurred_at', before); const { data, error } = await query; if (error) throw error; return data ?? [];
}
export async function getCalendarTool(client: SupabaseClient, context: ClinicContext) {
  admin(context); const { data, error } = await client.from('calendar_connections').select('provider,status,updated_at,connected_at').eq('clinic_id', context.clinicId).maybeSingle(); if (error) throw error;
  return { ...data, enabled: false };
}
