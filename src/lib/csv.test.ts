import { describe, it, expect } from 'vitest';
import { splitCsv, joinCsv } from './csv';

describe('splitCsv', () => {
  it('trims items and drops empty ones', () => {
    expect(splitCsv('a, b,')).toEqual(['a', 'b']);
    expect(splitCsv(' ,a,,b ')).toEqual(['a', 'b']);
  });

  it('returns an empty list for missing values', () => {
    expect(splitCsv('')).toEqual([]);
    expect(splitCsv(null)).toEqual([]);
    expect(splitCsv(undefined)).toEqual([]);
  });
});

describe('joinCsv', () => {
  it('joins without spaces and skips blanks', () => {
    expect(joinCsv(['a', ' b ', ''])).toBe('a,b');
    expect(joinCsv([])).toBe('');
  });

  it('round-trips with splitCsv', () => {
    expect(splitCsv(joinCsv(['p1', 'p2']))).toEqual(['p1', 'p2']);
  });
});
