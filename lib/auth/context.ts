import type { SupabaseClient } from '@supabase/supabase-js';

export type ClinicContext = {
  clinicId: string;
  userId: string;
  role: 'admin' | 'manager' | 'nurse' | 'viewer';
};

/** Establishes tenant context once. Domain services receive this, never headers. */
export async function requireClinicContext(client: SupabaseClient): Promise<ClinicContext> {
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error('UNAUTHENTICATED');
  const { data, error } = await client
    .from('clinic_memberships')
    .select('clinic_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single();
  if (error || !data) throw new Error('CLINIC_CONTEXT_NOT_FOUND');
  return { clinicId: data.clinic_id, userId: user.id, role: data.role };
}

export function requireRole(context: ClinicContext, allowed: ClinicContext['role'][]): void {
  if (!allowed.includes(context.role)) throw new Error('FORBIDDEN');
}
