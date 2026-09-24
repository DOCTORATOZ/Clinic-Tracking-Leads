import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRole, type ClinicContext } from '@/lib/auth/context';
import { intakeSchema, type IntakeResult } from '@/lib/validation/intake';

export async function saveIntake(client: SupabaseClient, context: ClinicContext, raw: unknown): Promise<IntakeResult> {
  requireRole(context, ['clinic_admin', 'care_coordinator']);
  const input = intakeSchema.parse(raw);
  const { data, error } = await client.rpc('save_intake', {
    p_input: { ...input, ownerId: input.ownerId ?? context.userId },
  });
  if (error) throw error;
  return data as IntakeResult;
}
