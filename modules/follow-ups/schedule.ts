export type PlanStep = { id: string; sequence: number; dayOffset: number; dueTime: string; instruction?: string | null };
export type TaskSnapshot = { planStepId: string; sequence: number; dayOffset: number; dueTime: string; instruction?: string | null };

/** Day-0 anchor comes from source_received_at; all scheduling uses Bangkok wall time. */
export function calculateBangkokDueAt(anchor: Date, step: PlanStep): Date {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(anchor);
  const part = (type: string) => date.find((value) => value.type === type)?.value ?? '';
  const baseUtc = Date.UTC(Number(part('year')), Number(part('month')) - 1, Number(part('day')) + step.dayOffset);
  const [hours, minutes] = step.dueTime.split(':').map(Number);
  // Bangkok is UTC+7 and does not observe DST.
  return new Date(baseUtc + (hours - 7) * 3_600_000 + minutes * 60_000);
}

export function snapshotStep(step: PlanStep): TaskSnapshot {
  return { planStepId: step.id, sequence: step.sequence, dayOffset: step.dayOffset, dueTime: step.dueTime, instruction: step.instruction };
}
