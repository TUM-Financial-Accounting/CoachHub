import { parseLocalDate } from './dates';

export type RepeatFrequency = 'none' | 'weekly' | 'biweekly' | 'monthly';
export type SeriesFrequency = Exclude<RepeatFrequency, 'none'>;
export type SeriesScope = 'this' | 'future' | 'all';
export type RepeatEnd = 'date' | 'count';

export const REPEAT_FREQUENCIES: readonly RepeatFrequency[] = ['none', 'weekly', 'biweekly', 'monthly'];
// Monday-first, matching the backend's date.weekday() convention.
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
// Mirrors recurrence.MAX_OCCURRENCES on the backend.
export const MAX_OCCURRENCES = 200;

export interface Recurrence {
  frequency: RepeatFrequency;
  // Extra weekdays on top of the start date's own weekday, which is always included.
  extraWeekdays: number[];
  endType: RepeatEnd;
  until: string;
  count: number;
}

export const noRecurrence = (): Recurrence => ({ frequency: 'none', extraWeekdays: [], endType: 'date', until: '', count: 10 });

export const weekdayOf = (iso: string): number => (parseLocalDate(iso).getDay() + 6) % 7;

export const weekOfMonth = (iso: string): number => Math.floor((parseLocalDate(iso).getDate() - 1) / 7) + 1;

export const seriesWeekdays = (r: Recurrence, startDate: string): number[] =>
  [...new Set([weekdayOf(startDate), ...r.extraWeekdays])].sort((a, b) => a - b);

export interface SeriesPattern {
  frequency: SeriesFrequency;
  weekdays: number[];
  startDate: string;
  endDate?: string;
  occurrences?: number;
}

export const seriesPattern = (r: Recurrence, startDate: string): SeriesPattern => ({
  frequency: r.frequency as SeriesFrequency,
  weekdays: seriesWeekdays(r, startDate),
  startDate,
  ...(r.endType === 'count' ? { occurrences: r.count } : { endDate: r.until }),
});

export type RecurrenceError = 'untilRequired' | 'untilBeforeStart' | 'countInvalid';

export function recurrenceError(r: Recurrence, startDate: string): RecurrenceError | null {
  if (r.frequency === 'none') return null;
  if (r.endType === 'count') {
    return Number.isInteger(r.count) && r.count >= 1 && r.count <= MAX_OCCURRENCES ? null : 'countInvalid';
  }
  if (!r.until) return 'untilRequired';
  if (r.until < startDate) return 'untilBeforeStart';
  return null;
}
