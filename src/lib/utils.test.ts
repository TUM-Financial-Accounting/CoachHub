import { describe, it, expect } from 'vitest';
import { cn, formatDate, isoWeekNumber } from './utils';

describe('cn', () => {
  it('merges conditional class values', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });

  it('lets a later Tailwind class win over an earlier one in the same group', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('handles arrays and objects', () => {
    expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c');
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
