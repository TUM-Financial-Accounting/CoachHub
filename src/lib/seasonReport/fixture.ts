import type { SeasonReportInput } from './build';
import type { MatchDetails, MatchEvent, MatchRating, Player, TrainingSession, Exercise } from '../../types/models';
import { emptyExercise, emptyPlayer } from '../domain';

const player = (id: string, first: string, last: string, jersey: number, position: string, extra: Partial<Player> = {}): Player => ({
  ...emptyPlayer(), id, firstName: first, lastName: last, jerseyNumber: jersey, position, dateOfBirth: '2011-03-10', ...extra,
});

const lineup = (ids: string[], players: Player[]) =>
  JSON.stringify(ids.map((id, i) => {
    const p = players.find(x => x.id === id)!;
    return { slotId: `s${i}`, player: { id, firstName: p.firstName, lastName: p.lastName, jerseyNumber: p.jerseyNumber, position: p.position } };
  }));

const match = (id: string, date: string, opponent: string, gf: number | undefined, ga: number | undefined, formation: string, starters: string[], players: Player[]): MatchDetails => ({
  id, date, opponent, time: '15:00', location: 'Home', formation, lineup: lineup(starters, players), goalsFor: gf, goalsAgainst: ga, notes: '',
});

const ev = (id: string, matchId: string, playerId: string, eventType: 'Goal' | 'Assist', minute?: number): MatchEvent => ({ id, matchId, playerId, eventType, minute });

const rating = (matchId: string, playerId: string, value: number): MatchRating => ({ matchId, playerId, rating: value });

const session = (id: string, date: string, players: string[], exercises: string[], intensity = 'Medium', focus = 'Pressing'): TrainingSession => ({
  id, date, startTime: '17:00', endTime: '18:30', focus, intensity, selectedPlayers: players.join(','), selectedExercises: exercises.join(','),
});

// A small but complete season: three played matches, one upcoming, four sessions.
export function sampleSeason(): SeasonReportInput {
  const players = [
    player('p1', 'Jonas', 'Berger', 1, 'Goalkeeper', { performance: 7, strongFoot: 'Right', height: 178 }),
    player('p2', 'Elias', 'Schröder', 4, 'Defender', { performance: 6, strongFoot: 'Left', height: 172 }),
    player('p3', 'Anton', 'Lehmann', 10, 'Midfielder', { performance: 9, strongFoot: 'Right' }),
    player('p4', 'Leon', 'Sommer', 9, 'Forward', { performance: 8, status: 'Injured' }),
  ];
  const former = player('p9', 'Max', 'Weg', 11, 'Forward');
  const all = [...players, former];
  const exercises: Exercise[] = [
    { ...emptyExercise(), id: 'x1', name: 'Rondo 5v2', category: 'Technique' },
    { ...emptyExercise(), id: 'x2', name: 'Pressing Triggers', category: 'Tactical' },
  ];
  return {
    teamName: 'FC Test U15',
    seasonName: '2026/27',
    coachName: 'Demo Coach',
    today: '2026-10-31',
    players,
    matches: [
      match('m1', '2026-09-05', 'SV Nord', 3, 1, '4-3-3', ['p1', 'p2', 'p3', 'p4'], all),
      match('m2', '2026-09-12', 'TSV Süd', 0, 0, '4-3-3', ['p1', 'p2', 'p3', 'p9'], all),
      match('m3', '2026-10-03', 'FC Ost', 1, 4, '3-5-2', ['p1', 'p3', 'p4'], all),
      match('m4', '2026-11-20', 'SC West', undefined, undefined, '4-4-2', [], all),
    ],
    matchEvents: {
      m1: [ev('e1', 'm1', 'p4', 'Goal', 12), ev('e2', 'm1', 'p3', 'Assist', 12), ev('e3', 'm1', 'p4', 'Goal', 67), ev('e4', 'm1', 'p9', 'Goal')],
      m3: [ev('e5', 'm3', 'p3', 'Goal', 88), ev('e6', 'm3', 'p2', 'Assist', 88)],
    },
    // Shared MVPs in m1 and m2; p4's single 9 must not win highestRated; the upcoming m4 is ignored.
    ratings: [
      rating('m1', 'p1', 6), rating('m1', 'p2', 7), rating('m1', 'p3', 9), rating('m1', 'p4', 9),
      rating('m2', 'p1', 8), rating('m2', 'p2', 8), rating('m2', 'p3', 6), rating('m2', 'p9', 7),
      rating('m3', 'p1', 5), rating('m3', 'p3', 8),
      rating('m4', 'p4', 10),
    ],
    sessions: [
      session('s1', '2026-09-01', ['p1', 'p2', 'p3', 'p4'], ['x1', 'x2'], 'High'),
      session('s2', '2026-09-08', ['p1', 'p3', ' p4 '], ['x1'], 'Medium', 'Rondos'),
      session('s3', '2026-10-06', ['p1', 'p3'], ['x1'], 'Low', 'pressing'),
      session('s4', '2026-10-13', ['p3'], [], 'Medium'),
      session('s5', '2026-11-10', ['p1'], ['x2'], 'High'),
    ],
    exercises,
    calendarEvents: [{ id: 'c1', title: 'Team dinner', date: '2026-09-20', startTime: '19:00', endTime: '21:00' }],
  };
}
