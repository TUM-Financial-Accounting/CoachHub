import { Player } from '../types/models';
import { toISODate } from './dates';

export interface BirthdayHit {
  playerId: string;
  date: string;
  firstName: string;
  lastName: string;
  age: number | null;
}

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

// A 29 February birthday shows on 28 February in non-leap years.
export function birthdaysInWeek(players: Player[], weekDays: Date[]): BirthdayHit[] {
  const hits: BirthdayHit[] = [];

  for (const day of weekDays) {
    const date = toISODate(day);
    const monthDay = date.slice(5);
    const year = day.getFullYear();
    const leapFallbackDay = !isLeapYear(year) && monthDay === '02-28';

    for (const p of players) {
      // The API sends YYYY-MM-DD; slicing keeps a full ISO timestamp working too.
      const dob = (p.dateOfBirth || '').slice(0, 10);
      if (dob.length !== 10) continue;

      const dobMonthDay = dob.slice(5);
      const matches = dobMonthDay === monthDay || (leapFallbackDay && dobMonthDay === '02-29');
      if (!matches) continue;

      const birthYear = parseInt(dob.slice(0, 4), 10);
      hits.push({
        playerId: p.id,
        date,
        firstName: p.firstName,
        lastName: p.lastName,
        age: Number.isNaN(birthYear) || birthYear <= 0 ? null : year - birthYear,
      });
    }
  }

  return hits;
}
