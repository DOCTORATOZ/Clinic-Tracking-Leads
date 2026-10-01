import {describe,it,expect} from 'vitest';
import {bangkokDateKey,bangkokWeekKeys,calendarRange} from '../lib/calendar-range';
describe('Bangkok calendar range',()=>{
 it('uses Bangkok today across the UTC date boundary',()=>expect(bangkokDateKey(new Date('2026-09-24T18:00:00Z'))).toBe('2026-09-25'));
 it('includes both months in a cross-month week',()=>{
  expect(bangkokWeekKeys('2026-10-01')).toEqual(['2026-09-27','2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03']);
  expect(calendarRange('week','2026-10-01',2026,9)).toEqual({from:'2026-09-26T17:00:00.000Z',to:'2026-10-03T17:00:00.000Z'});
 });
 it('starts a Thai Sunday week on Sunday, not Monday',()=>expect(bangkokWeekKeys('2026-09-27')[0]).toBe('2026-09-27'));
 it('uses a half-open day interval',()=>expect(calendarRange('day','2026-10-01',2026,9)).toEqual({from:'2026-09-30T17:00:00.000Z',to:'2026-10-01T17:00:00.000Z'}));
});
