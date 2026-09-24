import type { SupabaseClient } from '@supabase/supabase-js';

export type ClinicContext = {
  clinicId: string;
  userId: string;
  role: 'clinic_admin' | 'care_coordinator' | 'nurse' | 'viewer';
};

/** Establishes tenant context once. Domain services receive this, never headers. */
export async function requireClinicContext(client: SupabaseClient): Promise<ClinicContext> {
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error('UNAUTHENTICATED');
  const { data: clinicId, error: clinicError } = await client.rpc('current_clinic_id');
  if (clinicError || !clinicId) throw new Error('CLINIC_CONTEXT_NOT_FOUND');
  const { data, error } = await client
    .from('clinic_memberships')
    .select('clinic_id, role')
    .eq('user_id', user.id)
    .eq('clinic_id', clinicId)
    .eq('active', true)
    .single();
  if (error || !data) throw new Error('CLINIC_CONTEXT_NOT_FOUND');
  return { clinicId: data.clinic_id, userId: user.id, role: data.role };
}

export async function requireSystemAdmin(client: SupabaseClient): Promise<{ userId: string }> {
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error('UNAUTHENTICATED');
  const { data, error } = await client.rpc('is_system_admin');
  if (error || !data) throw new Error('FORBIDDEN');
  return { userId: user.id };
}

export function requireRole(context: ClinicContext, allowed: ClinicContext['role'][]): void {
  if (!allowed.includes(context.role)) throw new Error('FORBIDDEN');
}
