import { describe, it, expect } from 'vitest';
import { buildSeasonReport, type SeasonReport, type SeasonReportInput } from './build';
import { sampleSeason } from './fixture';
import type { MatchRating } from '../../types/models';

const report = () => buildSeasonReport(sampleSeason());
const line = (id: string) => report().players.find(p => p.id === id)!;

describe('team record', () => {
  it('counts only played matches and ignores the upcoming one', () => {
    const r = report();
    expect(r.record).toMatchObject({ played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 4, goalsAgainst: 5, goalDiff: -1, points: 4 });
    expect(r.record.ppg).toBe(1.3);
    expect(r.record.cleanSheets).toBe(1);
    expect(r.record.failedToScore).toBe(1);
    expect(r.upcomingMatches).toBe(1);
  });

  it('finds the biggest win, heaviest defeat and runs', () => {
    const r = report();
    expect(r.highlights.biggestWin?.opponent).toBe('SV Nord');
    expect(r.highlights.heaviestDefeat?.opponent).toBe('FC Ost');
    expect(r.highlights.longestUnbeaten).toBe(2);
    expect(r.highlights.longestWinning).toBe(1);
    expect(r.highlights.form).toEqual(['W', 'D', 'L']);
  });

  it('accumulates points match by match', () => {
    expect(report().pointsProgression.map(p => p.points)).toEqual([3, 4, 4]);
  });
});

describe('players', () => {
  it('counts starts from saved lineups', () => {
    expect(line('p1').starts).toBe(3);
    expect(line('p4').starts).toBe(2);
  });

  it('credits goals and assists from match events', () => {
    expect(line('p4')).toMatchObject({ goals: 2, assists: 0, contributions: 2, goalShare: 50 });
    expect(line('p3')).toMatchObject({ goals: 1, assists: 1, contributions: 2 });
  });

  it('keeps a player who left the squad but still played', () => {
    const former = line('p9');
    expect(former).toMatchObject({ inSquad: false, name: 'Max Weg', starts: 1, goals: 1 });
    expect(former.attendance.rate).toBeNull();
  });

  it('measures attendance against completed sessions only, trimming stored ids', () => {
    expect(line('p4').attendance).toEqual({ attended: 2, total: 4, rate: 50 });
    expect(line('p3').attendance.rate).toBe(100);
  });

  it('computes age on the report date', () => {
    expect(line('p1').age).toBe(15);
  });

  it('hands out awards to the leaders', () => {
    const { awards } = report();
    expect(awards.topScorer).toMatchObject({ playerId: 'p4', value: 2 });
    expect(awards.mostStarts).toMatchObject({ playerId: 'p1', value: 3 });
    expect(awards.bestAttendance).toMatchObject({ playerId: 'p3', value: 100 });
    expect(awards.highestRated).toMatchObject({ playerId: 'p3', value: 7.7 });
    expect(awards.mostMotm).toMatchObject({ playerId: 'p3', value: 2 });
  });
});

describe('match ratings', () => {
  it('averages per-match ratings of played matches only', () => {
    expect(line('p1')).toMatchObject({ avgRating: 6.3, ratedMatches: 3 });
    expect(line('p4')).toMatchObject({ avgRating: 9, ratedMatches: 1 });
    expect(line('p2').ratingLog.map(r => r.rating)).toEqual([7, 8]);
    expect(line('p4').rating).toBe(8);
  });

  it('shares the MVP on a tie', () => {
    const [m1, m2, m3] = report().matches;
    expect(m1.mvp.map(m => m.playerId)).toEqual(['p3', 'p4']);
    expect(m2.mvp.map(m => m.playerId)).toEqual(['p2', 'p1']);
    expect(m3.mvp).toEqual([{ playerId: 'p3', name: 'Anton Lehmann', rating: 8 }]);
    expect(line('p3').motm).toBe(2);
  });

  it('requires a minimum of rated matches for highest rated', () => {
    const r = report();
    expect(r).toMatchObject({ ratedMatches: 3, minRatedMatches: 2 });
    expect(r.awards.highestRated?.playerId).not.toBe('p4');
  });

  it('falls back to the season coach rating without match ratings', () => {
    const r = buildSeasonReport({ ...sampleSeason(), ratings: [] });
    expect(r.awards.highestRated).toMatchObject({ playerId: 'p3', value: 9 });
    expect(r.awards.mostMotm).toBeNull();
    expect(r.matches[0].mvp).toEqual([]);
    expect(r.players.every(p => p.avgRating === null)).toBe(true);
  });
});

describe('MVP', () => {
  const rate = (matchId: string, playerId: string, rating: number): MatchRating => ({ matchId, playerId, rating });
  const withRatings = (ratings: MatchRating[], extra: Partial<SeasonReportInput> = {}) =>
    buildSeasonReport({ ...sampleSeason(), ratings, ...extra });
  const mvpIds = (r: SeasonReport, i: number) => r.matches[i].mvp.map(m => m.playerId);

  it('gives a match without ratings no MVP', () => {
    const r = withRatings([rate('m1', 'p1', 7)]);
    expect(mvpIds(r, 0)).toEqual(['p1']);
    expect(mvpIds(r, 1)).toEqual([]);
    expect(mvpIds(r, 2)).toEqual([]);
    expect(r.ratedMatches).toBe(1);
  });

  it('ignores ratings of upcoming matches and zero ratings', () => {
    const r = withRatings([rate('m4', 'p4', 10), rate('m1', 'p1', 0), rate('m1', 'p2', 6)]);
    expect(mvpIds(r, 0)).toEqual(['p2']);
    expect(r.players.find(p => p.id === 'p4')).toMatchObject({ avgRating: null, motm: 0, ratedMatches: 0 });
    expect(r.players.find(p => p.id === 'p1')?.avgRating).toBeNull();
  });

  it('names every player on a full tie, sorted by name', () => {
    const r = withRatings([rate('m1', 'p1', 7), rate('m1', 'p2', 7), rate('m1', 'p3', 7)]);
    expect(r.matches[0].mvp.map(m => m.name)).toEqual(['Anton Lehmann', 'Elias Schröder', 'Jonas Berger']);
    expect(r.players.filter(p => p.motm === 1).map(p => p.id).sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('credits a player who has left the squad', () => {
    const r = withRatings([rate('m2', 'p9', 10), rate('m2', 'p1', 8)]);
    expect(r.matches[1].mvp).toEqual([{ playerId: 'p9', name: 'Max Weg', rating: 10 }]);
    expect(r.players.find(p => p.id === 'p9')).toMatchObject({ inSquad: false, motm: 1, avgRating: 10 });
  });

  it('keeps the first player in squad order when MVP counts tie', () => {
    const r = withRatings([rate('m1', 'p3', 9), rate('m2', 'p1', 9)]);
    expect(r.awards.mostMotm).toMatchObject({ playerId: 'p1', value: 1 });
  });

  it('rounds the average to one decimal and logs ratings in match order', () => {
    const p1 = withRatings([rate('m3', 'p1', 5), rate('m1', 'p1', 8), rate('m2', 'p1', 6)]).players.find(p => p.id === 'p1')!;
    expect(p1.avgRating).toBe(6.3);
    expect(p1.ratingLog.map(l => [l.date, l.rating])).toEqual([['2026-09-05', 8], ['2026-09-12', 6], ['2026-10-03', 5]]);
  });

  it('lets a single rated match decide highest rated', () => {
    const r = withRatings([rate('m1', 'p4', 9), rate('m1', 'p1', 6)]);
    expect(r).toMatchObject({ ratedMatches: 1, minRatedMatches: 1 });
    expect(r.awards.highestRated).toMatchObject({ playerId: 'p4', value: 9 });
  });

  it('needs a third of the rated matches once a season has many', () => {
    const base = sampleSeason();
    const template = base.matches[0];
    const matches = Array.from({ length: 9 }, (_, i) => ({ ...template, id: `k${i}`, date: `2026-09-${String(i + 1).padStart(2, '0')}` }));
    const ratings = [
      ...matches.map(m => rate(m.id, 'p3', 5)),
      rate('k0', 'p1', 7), rate('k1', 'p1', 7), rate('k2', 'p1', 7),
      rate('k3', 'p2', 9), rate('k4', 'p2', 9),
    ];
    const r = withRatings(ratings, { matches, matchEvents: {} });
    expect(r).toMatchObject({ ratedMatches: 9, minRatedMatches: 3 });
    expect(r.awards.highestRated).toMatchObject({ playerId: 'p1', value: 7 });
  });
});

describe('analysis', () => {
  it('buckets goals by minute and reports how many had one', () => {
    const { goalTiming } = report();
    expect(goalTiming.buckets).toEqual([1, 0, 0, 0, 1, 1]);
    expect(goalTiming).toMatchObject({ withMinute: 3, recorded: 4 });
  });

  it('summarises results per formation', () => {
    const f = report().formations;
    expect(f[0]).toMatchObject({ formation: '4-3-3', played: 2, won: 1, drawn: 1, ppg: 2 });
    expect(f[1]).toMatchObject({ formation: '3-5-2', played: 1, lost: 1, ppg: 0 });
  });

  it('groups matches and sessions by month', () => {
    const [sep, oct] = report().months;
    expect(sep).toMatchObject({ month: '2026-09', played: 2, points: 4, sessions: 2 });
    expect(oct).toMatchObject({ month: '2026-10', played: 1, points: 0, sessions: 2 });
  });
});

describe('training', () => {
  it('summarises completed sessions and keeps planned ones apart', () => {
    const { training } = report();
    expect(training).toMatchObject({ completed: 4, planned: 1, hours: 6, avgMinutes: 90 });
    expect(training.intensity).toEqual({ Low: 1, Medium: 2, High: 1 });
  });

  it('groups focus themes case-insensitively and ranks drills', () => {
    const { training } = report();
    expect(training.topFocus[0]).toEqual({ label: 'Pressing', count: 3 });
    expect(training.topExercises[0]).toMatchObject({ name: 'Rondo 5v2', count: 3 });
    expect(training.categories).toEqual([{ label: 'Technique', count: 3 }, { label: 'Tactical', count: 1 }]);
  });
});

describe('squad profile and meta', () => {
  it('describes the current squad', () => {
    const { squad } = report();
    expect(squad).toMatchObject({ size: 4, avgAge: 15, avgHeight: 175, unavailable: 1 });
  });

  it('spans the period from first to last activity', () => {
    expect(report().period).toEqual({ from: '2026-09-01', to: '2026-10-13' });
    expect(report().teamEvents).toBe(1);
  });

  it('copes with an empty season', () => {
    const empty = buildSeasonReport({ ...sampleSeason(), matches: [], sessions: [], matchEvents: {} });
    expect(empty.record.played).toBe(0);
    expect(empty.period).toBeNull();
    expect(empty.awards.topScorer).toBeNull();
  });
});
