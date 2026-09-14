import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClinicContext } from '@/lib/auth/context';

export async function writeAuditEvent(client: SupabaseClient, context: ClinicContext, event: {
  entityType: string; entityId: string; action: string; reason?: string; beforeData?: object; afterData?: object;
}) {
  const { error } = await client.from('audit_events').insert({
    clinic_id: context.clinicId, entity_type: event.entityType, entity_id: event.entityId,
    action: event.action, actor_id: context.userId, reason: event.reason,
    before_data: event.beforeData, after_data: event.afterData,
  });
  if (error) throw error;
}
