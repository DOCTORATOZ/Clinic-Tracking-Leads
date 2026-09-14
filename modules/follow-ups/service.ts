import type { SupabaseClient } from '@supabase/supabase-js';
import { recordFollowUpResultSchema, type RecordFollowUpResultInput } from '@/lib/validation/contracts';
import type { ClinicContext } from '@/lib/auth/context';
import { requireRole } from '@/lib/auth/context';
import { writeAuditEvent } from '@/modules/audit/service';

export async function recordFollowUpResult(client: SupabaseClient, context: ClinicContext, unsafeInput: RecordFollowUpResultInput) {
  requireRole(context, ['admin', 'manager']);
  const input = recordFollowUpResultSchema.parse(unsafeInput);
  const { data: task, error: taskError } = await client.from('follow_up_tasks').select('id, case_id, step_snapshot').eq('id', input.taskId).eq('clinic_id', context.clinicId).single();
  if (taskError) throw taskError;
  const { data: result, error } = await client.from('follow_up_results').insert({
    clinic_id: context.clinicId, task_id: task.id, occurred_at: input.occurredAt, contact_channel: input.contactChannel,
    contact_status: input.contactStatus, outcome: input.outcome, symptom_status: input.symptomStatus,
    summary: input.summary, next_action: input.nextAction, performed_by: input.performedBy,
    reported_by: input.reportedBy, recorded_by: context.userId,
  }).select().single();
  if (error) throw error;
  if (input.contactStatus === 'contacted') {
    const { error: completeError } = await client.from('follow_up_tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', task.id).eq('clinic_id', context.clinicId);
    if (completeError) throw completeError;
  }
  if (input.retryDueAt) {
    const { error: retryError } = await client.from('follow_up_tasks').insert({ clinic_id: context.clinicId, case_id: task.case_id, due_at: input.retryDueAt, step_snapshot: { kind: 'manual_retry', sourceTaskId: task.id }, status: 'pending', created_by: context.userId });
    if (retryError) throw retryError;
  }
  await writeAuditEvent(client, context, { entityType: 'follow_up_result', entityId: result.id, action: 'follow_up.result_recorded', afterData: { taskId: task.id, performedBy: input.performedBy, reportedBy: input.reportedBy, recordedBy: context.userId } });
  return result;
}
