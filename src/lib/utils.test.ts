import { describe, it, expect } from 'vitest';
import { cn, formatDate } from './utils';

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
