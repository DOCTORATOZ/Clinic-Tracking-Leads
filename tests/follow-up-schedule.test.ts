import { describe, expect, it } from 'vitest';
import { calculateBangkokDueAt, snapshotStep } from '@/modules/follow-ups/schedule';

describe('Bangkok follow-up schedule', () => {
  const step = { id: 'step-1', sequence: 1, dayOffset: 1, dueTime: '10:00', instruction: 'โทรติดตาม' };
  it('anchors Day 1 at 10:00 Asia/Bangkok', () => expect(calculateBangkokDueAt(new Date('2026-09-10T16:30:00.000Z'), step).toISOString()).toBe('2026-09-11T03:00:00.000Z'));
  it('keeps generated step data immutable as a snapshot', () => expect(snapshotStep(step)).toEqual({ planStepId: 'step-1', sequence: 1, dayOffset: 1, dueTime: '10:00', instruction: 'โทรติดตาม' }));
});
