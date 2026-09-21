import { describe, it, expect, afterEach } from 'vitest';
import {
  toISODate, todayISO, parseLocalDate, isPast, toMinutes, minutesToLabel,
  addMinutes, endsAfterStart, formatDate, isoWeekNumber,
} from './dates';

const originalTZ = process.env.TZ;
afterEach(() => { process.env.TZ = originalTZ; });

describe('parseLocalDate / toISODate', () => {
  it('round-trips a date', () => {
    expect(toISODate(parseLocalDate('2026-09-21'))).toBe('2026-09-21');
  });

  it('keeps the calendar day on DST switch days', () => {
    process.env.TZ = 'Europe/Berlin';
    // Summer time starts here: UTC+2, so the zone really is in effect.
    expect(new Date(2026, 2, 29, 12).getTimezoneOffset()).toBe(-120);
    for (const iso of ['2026-03-29', '2026-10-25']) {
      const d = parseLocalDate(iso);
      expect(d.getHours()).toBe(12);
      expect(toISODate(d)).toBe(iso);
    }
    process.env.TZ = 'America/New_York';
    for (const iso of ['2026-03-08', '2026-11-01']) expect(toISODate(parseLocalDate(iso))).toBe(iso);
  });

  it('ignores a time component', () => {
    expect(toISODate(parseLocalDate('2026-12-31T23:30:00'))).toBe('2026-12-31');
  });

  it('gives an Invalid Date for input that is not a date', () => {
    expect(Number.isNaN(parseLocalDate('').getTime())).toBe(true);
    expect(Number.isNaN(parseLocalDate('next week').getTime())).toBe(true);
  });

  it('pads single-digit months and days', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('todayISO / isPast', () => {
  it('treats today as not past and yesterday as past', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isPast(todayISO())).toBe(false);
    expect(isPast(toISODate(yesterday))).toBe(true);
  });

  it('never calls an unparseable date past', () => {
    expect(isPast('')).toBe(false);
  });
});

describe('toMinutes / minutesToLabel / addMinutes', () => {
  it('parses HH:MM and bare hours', () => {
    expect(toMinutes('09:30')).toBe(570);
    expect(toMinutes('9')).toBe(540);
    expect(Number.isNaN(toMinutes(''))).toBe(true);
    expect(Number.isNaN(toMinutes('tbd'))).toBe(true);
  });

  it('formats minutes back to HH:MM', () => {
    expect(minutesToLabel(570)).toBe('09:30');
  });

  it('adds minutes and wraps past midnight', () => {
    expect(addMinutes('15:00', 120)).toBe('17:00');
    expect(addMinutes('23:30', 60)).toBe('00:30');
    expect(addMinutes('tbd', 60)).toBe('tbd');
  });
});

describe('endsAfterStart', () => {
  it('requires the end to be strictly later', () => {
    expect(endsAfterStart('09:00', '11:00')).toBe(true);
    expect(endsAfterStart('09:00', '09:00')).toBe(false);
    expect(endsAfterStart('11:00', '09:00')).toBe(false);
  });

  it('rejects a missing end time', () => {
    expect(endsAfterStart('09:00', '')).toBe(false);
  });
});

describe('formatDate', () => {
  it('reformats an ISO date to DD/MM/YYYY', () => {
    expect(formatDate('2026-01-05')).toBe('05/01/2026');
  });

  it('ignores a time component', () => {
    expect(formatDate('2026-12-31T23:30:00')).toBe('31/12/2026');
  });

  it('does not shift the day across a timezone boundary', () => {
    // Pure string slicing is the whole point — `new Date('2026-01-01')` in a
    // negative-offset timezone renders as 31/12/2025.
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
  });

  it('returns an empty string for missing or too-short input', () => {
    expect(formatDate()).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate('2026-01')).toBe('');
  });
});

describe('isoWeekNumber', () => {
  const at = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  it('matches the week printed on the reference plan', () => {
    // 16 July 2026 is a Thursday in ISO week 29.
    expect(isoWeekNumber(at('2026-07-16'))).toBe(29);
  });

  it('starts the week on Monday', () => {
    expect(isoWeekNumber(at('2026-07-13'))).toBe(29); // Monday
    expect(isoWeekNumber(at('2026-07-19'))).toBe(29); // Sunday
    expect(isoWeekNumber(at('2026-07-20'))).toBe(30); // next Monday
  });

  it('handles the turn of the year the ISO way', () => {
    // 1 Jan 2027 is a Friday, so it still belongs to week 53 of 2026.
    expect(isoWeekNumber(at('2027-01-01'))).toBe(53);
    // 4 Jan 2027 is the Monday that opens week 1.
    expect(isoWeekNumber(at('2027-01-04'))).toBe(1);
  });

  it('gives a 53-week year its 53rd week', () => {
    expect(isoWeekNumber(at('2026-12-31'))).toBe(53);
  });
});
