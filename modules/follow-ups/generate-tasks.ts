import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClinicContext } from '@/lib/auth/context';
import { calculateBangkokDueAt, snapshotStep, type PlanStep } from './schedule';
import { writeAuditEvent } from '@/modules/audit/service';

/** Creates immutable snapshots. Later plan edits cannot rewrite generated work. */
export async function generatePlanTasks(client: SupabaseClient, context: ClinicContext, caseId: string, planId: string, anchor: Date) {
  const { data: steps, error } = await client.from('follow_up_plan_steps')
    .select('id, sequence, day_offset, due_time, instruction')
    .eq('clinic_id', context.clinicId).eq('plan_id', planId).order('sequence');
  if (error) throw error;
  const payload = (steps ?? []).map((row) => {
    const step: PlanStep = { id: row.id, sequence: row.sequence, dayOffset: row.day_offset, dueTime: row.due_time, instruction: row.instruction };
    return { clinic_id: context.clinicId, case_id: caseId, plan_id: planId, plan_step_id: step.id, step_snapshot: snapshotStep(step), due_at: calculateBangkokDueAt(anchor, step).toISOString(), created_by: context.userId };
  });
  if (!payload.length) return [];
  const { data, error: insertError } = await client.from('follow_up_tasks').insert(payload).select();
  if (insertError) throw insertError;
  await writeAuditEvent(client, context, { entityType: 'case', entityId: caseId, action: 'follow_up.tasks_generated', afterData: { planId, taskCount: data.length } });
  return data;
}
