import { z } from 'zod';
const id = z.uuid();
export const planCycleActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('activate'), requestId: id, planId: id, anchorDate: z.iso.date(), eventKind: z.enum(['assessment','procedure','care_start']), reportedBy: id.optional(), reason: z.string().trim().min(1), expectedRevision: z.number().int().positive() }),
  z.object({ action: z.literal('preview'), cycleId: id, anchorDate: z.iso.date() }),
  z.object({ action: z.literal('revise'), cycleId: id, anchorDate: z.iso.date(), reason: z.string().trim().min(1), preview: z.record(z.string(), z.unknown()) }),
]);
