import { describe, expect, it } from 'vitest';
import { noRecurrence, recurrenceError, seriesPattern, seriesWeekdays, weekOfMonth, weekdayOf } from './recurrence';

describe('recurrence helpers', () => {
  it('uses Monday = 0', () => {
    expect(weekdayOf('2026-09-21')).toBe(0);
    expect(weekdayOf('2026-09-27')).toBe(6);
  });

  it('computes the week of the month', () => {
    expect(weekOfMonth('2026-09-01')).toBe(1);
    expect(weekOfMonth('2026-09-08')).toBe(2);
    expect(weekOfMonth('2026-09-29')).toBe(5);
  });

  it('always includes the start weekday, deduped and sorted', () => {
    const r = { ...noRecurrence(), frequency: 'weekly' as const, extraWeekdays: [4, 1, 0] };
    expect(seriesWeekdays(r, '2026-09-22')).toEqual([0, 1, 4]);
  });

  it('validates the end date only when repeating', () => {
    expect(recurrenceError(noRecurrence(), '2026-09-22')).toBeNull();
    const weekly = { ...noRecurrence(), frequency: 'weekly' as const };
    expect(recurrenceError(weekly, '2026-09-22')).toBe('untilRequired');
    expect(recurrenceError({ ...weekly, until: '2026-09-01' }, '2026-09-22')).toBe('untilBeforeStart');
    expect(recurrenceError({ ...weekly, until: '2026-09-22' }, '2026-09-22')).toBeNull();
  });

  it('validates the occurrence count when ending after N times', () => {
    const byCount = { ...noRecurrence(), frequency: 'weekly' as const, endType: 'count' as const };
    expect(recurrenceError({ ...byCount, count: 12 }, '2026-09-22')).toBeNull();
    expect(recurrenceError({ ...byCount, count: 0 }, '2026-09-22')).toBe('countInvalid');
    expect(recurrenceError({ ...byCount, count: 201 }, '2026-09-22')).toBe('countInvalid');
    expect(recurrenceError({ ...byCount, count: NaN }, '2026-09-22')).toBe('countInvalid');
  });

  it('sends either an end date or a count, never both', () => {
    const r = { ...noRecurrence(), frequency: 'monthly' as const, until: '2026-12-31', count: 5 };
    expect(seriesPattern(r, '2026-09-22')).toEqual({ frequency: 'monthly', weekdays: [1], startDate: '2026-09-22', endDate: '2026-12-31' });
    expect(seriesPattern({ ...r, endType: 'count' }, '2026-09-22')).toEqual({ frequency: 'monthly', weekdays: [1], startDate: '2026-09-22', occurrences: 5 });
  });
});
