import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasResult, isUnrecorded, matchOutcome } from './matchResult';

describe('matchOutcome', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 15, 10));
  });
  afterEach(() => vi.useRealTimers());

  it('derives W, D and L from a recorded score', () => {
    expect(matchOutcome({ date: '2026-10-01', goalsFor: 2, goalsAgainst: 1 })).toBe('W');
    expect(matchOutcome({ date: '2026-10-01', goalsFor: 0, goalsAgainst: 0 })).toBe('D');
    expect(matchOutcome({ date: '2026-10-01', goalsFor: 0, goalsAgainst: 3 })).toBe('L');
  });

  it('marks a past match without a score as U', () => {
    const m = { date: '2026-10-14', goalsFor: undefined, goalsAgainst: undefined };
    expect(matchOutcome(m)).toBe('U');
    expect(isUnrecorded(m)).toBe(true);
    expect(hasResult(m)).toBe(false);
  });

  it('gives no outcome for an upcoming or same-day match without a score', () => {
    expect(matchOutcome({ date: '2026-10-15' })).toBeNull();
    expect(matchOutcome({ date: '2026-10-20' })).toBeNull();
    expect(isUnrecorded({ date: '2026-10-20' })).toBe(false);
  });

  it('needs both sides of the score', () => {
    expect(hasResult({ goalsFor: 1, goalsAgainst: undefined })).toBe(false);
    expect(matchOutcome({ date: '2026-10-01', goalsFor: 1 })).toBe('U');
  });
});
