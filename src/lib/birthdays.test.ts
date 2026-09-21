import { describe, it, expect } from 'vitest';
import { birthdaysInWeek } from './birthdays';
import { weekStartOf } from './settings';
import type { Player } from '../types/models';

const player = (id: string, firstName: string, dateOfBirth: string): Player => ({
  id, firstName, lastName: 'Muster', dateOfBirth,
  position: '', jerseyNumber: 0, status: '', playerPhone: '', height: 0, weight: 0,
  clothingSize: '', strongFoot: '', motherName: '', motherPhone: '', fatherName: '',
  fatherPhone: '', imageUrl: '', attendance: 0, performance: 0,
  isTrial: false, homeClub: '', trialRating: 0, trialNotes: '',
});

const weekOf = (isoDate: string, startsOn: 'monday' | 'sunday' = 'monday'): Date[] => {
  const [y, m, d] = isoDate.split('-').map(Number);
  const start = weekStartOf(new Date(y, m - 1, d), startsOn);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
};

describe('birthdaysInWeek', () => {
  it('finds a birthday in the week and reports the age being turned', () => {
    const week = weekOf('2026-08-27'); // Mon 24 Aug – Sun 30 Aug 2026
    const hits = birthdaysInWeek([player('p1', 'Ali', '2010-08-26')], week);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ playerId: 'p1', date: '2026-08-26', age: 16 });
  });

  it('ignores players whose birthday falls outside the week', () => {
    const week = weekOf('2026-08-27');
    expect(birthdaysInWeek([player('p1', 'Ali', '2010-09-15')], week)).toEqual([]);
  });

  it('matches on month and day regardless of birth year', () => {
    const week = weekOf('2026-08-27');
    const hits = birthdaysInWeek([player('p1', 'Ali', '1998-08-30')], week);
    expect(hits).toHaveLength(1);
    expect(hits[0].age).toBe(28);
  });

  it('returns hits in day order', () => {
    const week = weekOf('2026-08-27');
    const hits = birthdaysInWeek([
      player('late', 'Late', '2010-08-30'),
      player('early', 'Early', '2010-08-25'),
    ], week);
    expect(hits.map(h => h.playerId)).toEqual(['early', 'late']);
  });

  it('shows a 29 February birthday on 28 February in a non-leap year', () => {
    const hits = birthdaysInWeek([player('p1', 'Ali', '2008-02-29')], weekOf('2026-02-25'));
    expect(hits).toHaveLength(1);
    expect(hits[0].date).toBe('2026-02-28');
  });

  it('keeps a 29 February birthday on its own day in a leap year', () => {
    const hits = birthdaysInWeek([player('p1', 'Ali', '2008-02-29')], weekOf('2028-02-28'));
    expect(hits).toHaveLength(1);
    expect(hits[0].date).toBe('2028-02-29');
  });

  it('skips players with a missing or malformed date of birth', () => {
    const week = weekOf('2026-08-27');
    expect(birthdaysInWeek([
      player('p1', 'NoDob', ''),
      player('p2', 'Partial', '2010-08'),
    ], week)).toEqual([]);
  });

  it('reports a null age rather than a nonsense number when the year is unusable', () => {
    const week = weekOf('2026-08-27');
    const hits = birthdaysInWeek([player('p1', 'Ali', '0000-08-26')], week);
    expect(hits).toHaveLength(1);
    expect(hits[0].age).toBeNull();
  });

  it('covers the whole week for both week-start preferences', () => {
    // 30 Aug 2026 is a Sunday: last day of a Monday week, first of a Sunday week.
    const dob = [player('p1', 'Ali', '2010-08-30')];
    expect(birthdaysInWeek(dob, weekOf('2026-08-27', 'monday'))).toHaveLength(1);
    expect(birthdaysInWeek(dob, weekOf('2026-08-31', 'sunday'))).toHaveLength(1);
  });
});
