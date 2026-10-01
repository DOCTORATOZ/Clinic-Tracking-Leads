import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClinicContext } from '@/lib/auth/context';
import { requireRole } from '@/lib/auth/context';
import { intakeSchema } from '@/lib/validation/intake';
import { saveIntake } from '@/modules/patients/intake-service';

export async function createCase(client: SupabaseClient, context: ClinicContext, raw: unknown) {
  requireRole(context, ['clinic_admin','care_coordinator']);
  const input = intakeSchema.parse(raw);
  if (input.mode !== 'case') throw new Error('VALIDATION_ERROR');
  return (await saveIntake(client, context, raw)).case;
}
