const pad = (n: number) => String(n).padStart(2, '0');

// Built by hand so the result never depends on the browser's locale data.
export const toISODate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayISO = (): string => toISODate(new Date());

// Local noon, so a DST shift can never roll the date over. Invalid input gives an Invalid Date.
export const parseLocalDate = (iso: string): Date => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
};

export const isPast = (iso: string): boolean => {
  const d = parseLocalDate(iso);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return d < today;
};

// NaN for a blank string or a non-numeric hour.
export const toMinutes = (hhmm: string): number => {
  if (!hhmm || !hhmm.trim()) return NaN;
  const [h, m = 0] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return NaN;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
};

export const minutesToLabel = (m: number): string => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

// Wraps past midnight; returns the input unchanged when it is not a time.
export const addMinutes = (hhmm: string, mins: number): string => {
  const start = toMinutes(hhmm);
  if (Number.isNaN(start)) return hhmm;
  const total = start + mins;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
};

// Blank or unparseable times count as 00:00, so a missing end time is rejected rather than let through.
export const endsAfterStart = (start: string, end: string): boolean =>
  (toMinutes(end) || 0) > (toMinutes(start) || 0);

// String slicing only: new Date('2026-01-01') renders as 31/12/2025 west of UTC.
export function formatDate(isoDate?: string | null): string {
  if (!isoDate || isoDate.length < 10) return '';
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}/${isoDate.slice(0, 4)}`;
}

// ISO-8601 week ("KW 29"): Monday start, week 1 holds the first Thursday.
export function isoWeekNumber(date: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  // The Thursday of this week decides which year the week belongs to.
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const firstThursday = new Date(d.getFullYear(), 0, 4, 12);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}
