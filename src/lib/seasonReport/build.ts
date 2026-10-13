import type { CalendarEvent, Exercise, MatchDetails, MatchEvent, MatchRating, Player, TrainingSession } from '../../types/models';
import { MATCH_EVENT } from '../domain';
import { splitCsv } from '../csv';
import { parseLocalDate, toMinutes } from '../dates';

export type MatchResult = 'W' | 'D' | 'L';

export interface SeasonReportInput {
  teamName: string;
  seasonName: string;
  coachName: string;
  today: string;
  players: Player[];
  matches: MatchDetails[];
  matchEvents: Record<string, MatchEvent[]>;
  ratings: MatchRating[];
  sessions: TrainingSession[];
  exercises: Exercise[];
  calendarEvents: CalendarEvent[];
}

export interface GoalEntry { playerId: string; name: string; minute: number | null }

export interface MvpEntry { playerId: string; name: string; rating: number }

export interface MatchRow {
  id: string;
  date: string;
  opponent: string;
  location: string;
  formation: string;
  goalsFor: number;
  goalsAgainst: number;
  result: MatchResult;
  scorers: GoalEntry[];
  assists: GoalEntry[];
  mvp: MvpEntry[];
}

export interface TeamRecord {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  ppg: number;
  winRate: number;
  cleanSheets: number;
  failedToScore: number;
  avgFor: number;
  avgAgainst: number;
}

export interface Highlights {
  biggestWin: MatchRow | null;
  heaviestDefeat: MatchRow | null;
  longestUnbeaten: number;
  longestWinning: number;
  form: MatchResult[];
}

export interface Attendance { attended: number; total: number; rate: number | null }

export interface PlayerLine {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  jersey: number | null;
  position: string;
  age: number | null;
  strongFoot: string;
  height: number;
  status: string;
  inSquad: boolean;
  starts: number;
  goals: number;
  assists: number;
  contributions: number;
  goalShare: number | null;
  rating: number | null; // season coach rating from the squad page
  avgRating: number | null;
  ratedMatches: number;
  motm: number;
  ratingLog: { date: string; opponent: string; rating: number }[];
  attendance: Attendance;
  goalLog: { date: string; opponent: string; minute: number | null; kind: 'goal' | 'assist' }[];
}

export interface Award { playerId: string; name: string; value: number }

export interface Awards {
  topScorer: Award | null;
  topAssister: Award | null;
  mostContributions: Award | null;
  mostStarts: Award | null;
  bestAttendance: Award | null;
  highestRated: Award | null;
  mostMotm: Award | null;
}

export interface CountRow { label: string; count: number }

export interface TrainingSummary {
  completed: number;
  planned: number;
  hours: number;
  avgMinutes: number;
  avgAttendance: number | null;
  intensity: { Low: number; Medium: number; High: number };
  topFocus: CountRow[];
  topExercises: { name: string; category: string; count: number }[];
  categories: CountRow[];
  weekdays: number[];
}

export interface SquadProfile {
  size: number;
  avgAge: number | null;
  avgHeight: number | null;
  positions: CountRow[];
  feet: CountRow[];
  unavailable: number;
}

export interface MonthRow {
  month: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  sessions: number;
}

export interface FormationRow { formation: string; played: number; won: number; drawn: number; lost: number; ppg: number }

export interface SeasonReport {
  teamName: string;
  seasonName: string;
  coachName: string;
  generatedOn: string;
  period: { from: string; to: string } | null;
  record: TeamRecord;
  highlights: Highlights;
  matches: MatchRow[];
  upcomingMatches: number;
  pointsProgression: { date: string; opponent: string; result: MatchResult; points: number }[];
  goalTiming: { buckets: number[]; withMinute: number; recorded: number };
  formations: FormationRow[];
  months: MonthRow[];
  players: PlayerLine[];
  awards: Awards;
  // Played matches with at least one rating, and the minimum a player needs for highestRated
  ratedMatches: number;
  minRatedMatches: number;
  training: TrainingSummary;
  squad: SquadProfile;
  teamEvents: number;
}

export const GOAL_BUCKETS = ['1-15', '16-30', '31-45', '46-60', '61-75', '76-90+'] as const;

const round1 = (n: number) => Math.round(n * 10) / 10;
const pointsFor = (r: MatchResult) => (r === 'W' ? 3 : r === 'D' ? 1 : 0);
const resultOf = (gf: number, ga: number): MatchResult => (gf > ga ? 'W' : gf < ga ? 'L' : 'D');

// Same definition as the statistics page: in the past and with a recorded score.
export const isPlayed = (m: MatchDetails, today: string) =>
  m.date <= today && (m.goalsFor !== undefined || m.goalsAgainst !== undefined);

function ageOn(dob: string, on: string): number | null {
  const birth = parseLocalDate(dob);
  const ref = parseLocalDate(on);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(ref.getTime())) return null;
  let age = ref.getFullYear() - birth.getFullYear();
  const beforeBirthday = ref.getMonth() < birth.getMonth()
    || (ref.getMonth() === birth.getMonth() && ref.getDate() < birth.getDate());
  if (beforeBirthday) age--;
  return age >= 0 && age < 100 ? age : null;
}

interface LineupSnapshot { id: string; firstName: string; lastName: string; jersey: number | null; position: string }

function lineupOf(match: MatchDetails): LineupSnapshot[] {
  if (!match.lineup) return [];
  try {
    const parsed = JSON.parse(match.lineup);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((slot: any) => slot?.player)
      .filter((p: any) => p && typeof p.id === 'string')
      .map((p: any) => ({
        id: p.id,
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        jersey: typeof p.jerseyNumber === 'number' ? p.jerseyNumber : null,
        position: p.position || '',
      }));
  } catch {
    return [];
  }
}

function longestRun(results: MatchResult[], keep: (r: MatchResult) => boolean): number {
  let best = 0;
  let run = 0;
  for (const r of results) {
    run = keep(r) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

function topCounts(values: string[], limit: number): CountRow[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const raw of values) {
    const label = raw.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    const cur = counts.get(key);
    if (cur) cur.count++;
    else counts.set(key, { label, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit);
}

function bestBy(players: PlayerLine[], value: (p: PlayerLine) => number | null): Award | null {
  let best: Award | null = null;
  for (const p of players) {
    const v = value(p);
    if (v === null || v <= 0) continue;
    if (!best || v > best.value) best = { playerId: p.id, name: p.name, value: v };
  }
  return best;
}

export function buildSeasonReport(input: SeasonReportInput): SeasonReport {
  const { today } = input;

  const played = input.matches.filter(m => isPlayed(m, today)).sort((a, b) => a.date.localeCompare(b.date));
  const upcomingMatches = input.matches.filter(m => m.date > today).length;
  const completedSessions = input.sessions.filter(s => s.date <= today);
  const plannedSessions = input.sessions.filter(s => s.date > today);

  // --- who played: the current squad plus anyone found only in old lineups or events ---
  const snapshots = new Map<string, LineupSnapshot>();
  for (const m of played) for (const s of lineupOf(m)) if (!snapshots.has(s.id)) snapshots.set(s.id, s);

  const lines = new Map<string, PlayerLine>();
  const blankLine = (id: string, first: string, last: string, extra: Partial<PlayerLine>): PlayerLine => ({
    id, firstName: first, lastName: last, name: `${first} ${last}`.trim(),
    jersey: null, position: '', age: null, strongFoot: '', height: 0, status: '', inSquad: false,
    starts: 0, goals: 0, assists: 0, contributions: 0, goalShare: null, rating: null,
    avgRating: null, ratedMatches: 0, motm: 0, ratingLog: [],
    attendance: { attended: 0, total: 0, rate: null }, goalLog: [], ...extra,
  });
  for (const p of input.players) {
    lines.set(p.id, blankLine(p.id, p.firstName, p.lastName, {
      jersey: p.jerseyNumber || null,
      position: p.position,
      age: ageOn(p.dateOfBirth, input.today),
      strongFoot: p.strongFoot,
      height: p.height,
      status: p.status,
      inSquad: true,
      rating: p.performance > 0 ? p.performance : null,
    }));
  }
  const lineFor = (id: string): PlayerLine => {
    let line = lines.get(id);
    if (!line) {
      const s = snapshots.get(id);
      line = blankLine(id, s?.firstName ?? '', s?.lastName ?? '', { jersey: s?.jersey ?? null, position: s?.position ?? '' });
      lines.set(id, line);
    }
    return line;
  };

  // --- matches ---
  const ratingsByMatch = new Map<string, MatchRating[]>();
  for (const r of input.ratings) {
    if (r.rating < 1) continue;
    const list = ratingsByMatch.get(r.matchId) ?? [];
    list.push(r);
    ratingsByMatch.set(r.matchId, list);
  }
  const rows: MatchRow[] = played.map(m => {
    const gf = m.goalsFor ?? 0;
    const ga = m.goalsAgainst ?? 0;
    const events = input.matchEvents[m.id] ?? [];
    const entry = (e: MatchEvent): GoalEntry => ({ playerId: e.playerId, name: lineFor(e.playerId).name, minute: typeof e.minute === 'number' ? e.minute : null });
    const byMinute = (a: GoalEntry, b: GoalEntry) => (a.minute ?? 999) - (b.minute ?? 999);
    const matchRatings = ratingsByMatch.get(m.id) ?? [];
    const top = Math.max(0, ...matchRatings.map(r => r.rating));
    return {
      id: m.id,
      date: m.date,
      opponent: m.opponent,
      location: m.location,
      formation: m.formation,
      goalsFor: gf,
      goalsAgainst: ga,
      result: resultOf(gf, ga),
      scorers: events.filter(e => e.eventType === MATCH_EVENT.Goal).map(entry).sort(byMinute),
      assists: events.filter(e => e.eventType === MATCH_EVENT.Assist).map(entry).sort(byMinute),
      // Ties share the MVP
      mvp: matchRatings.filter(r => r.rating === top)
        .map(r => ({ playerId: r.playerId, name: lineFor(r.playerId).name, rating: r.rating }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  });

  for (const m of played) for (const s of lineupOf(m)) lineFor(s.id).starts++;
  for (const row of rows) {
    for (const g of row.scorers) {
      const line = lineFor(g.playerId);
      line.goals++;
      line.goalLog.push({ date: row.date, opponent: row.opponent, minute: g.minute, kind: 'goal' });
    }
    for (const a of row.assists) {
      const line = lineFor(a.playerId);
      line.assists++;
      line.goalLog.push({ date: row.date, opponent: row.opponent, minute: a.minute, kind: 'assist' });
    }
    for (const r of ratingsByMatch.get(row.id) ?? []) {
      lineFor(r.playerId).ratingLog.push({ date: row.date, opponent: row.opponent, rating: r.rating });
    }
    for (const mvp of row.mvp) lineFor(mvp.playerId).motm++;
  }

  // --- team record ---
  const results = rows.map(r => r.result);
  const won = results.filter(r => r === 'W').length;
  const drawn = results.filter(r => r === 'D').length;
  const lost = results.filter(r => r === 'L').length;
  const goalsFor = rows.reduce((s, r) => s + r.goalsFor, 0);
  const goalsAgainst = rows.reduce((s, r) => s + r.goalsAgainst, 0);
  const points = won * 3 + drawn;
  const n = rows.length;
  const record: TeamRecord = {
    played: n, won, drawn, lost, goalsFor, goalsAgainst, goalDiff: goalsFor - goalsAgainst, points,
    ppg: n ? round1(points / n) : 0,
    winRate: n ? Math.round((won / n) * 100) : 0,
    cleanSheets: rows.filter(r => r.goalsAgainst === 0).length,
    failedToScore: rows.filter(r => r.goalsFor === 0).length,
    avgFor: n ? round1(goalsFor / n) : 0,
    avgAgainst: n ? round1(goalsAgainst / n) : 0,
  };

  const margin = (r: MatchRow) => r.goalsFor - r.goalsAgainst;
  const wins = rows.filter(r => r.result === 'W');
  const defeats = rows.filter(r => r.result === 'L');
  const highlights: Highlights = {
    biggestWin: wins.reduce<MatchRow | null>((b, r) => (!b || margin(r) > margin(b) || (margin(r) === margin(b) && r.goalsFor > b.goalsFor) ? r : b), null),
    heaviestDefeat: defeats.reduce<MatchRow | null>((b, r) => (!b || margin(r) < margin(b) || (margin(r) === margin(b) && r.goalsAgainst > b.goalsAgainst) ? r : b), null),
    longestUnbeaten: longestRun(results, r => r !== 'L'),
    longestWinning: longestRun(results, r => r === 'W'),
    form: results.slice(-5),
  };

  let cumulative = 0;
  const pointsProgression = rows.map(r => {
    cumulative += pointsFor(r.result);
    return { date: r.date, opponent: r.opponent, result: r.result, points: cumulative };
  });

  // --- when we score ---
  const buckets = [0, 0, 0, 0, 0, 0];
  let withMinute = 0;
  let recorded = 0;
  for (const r of rows) for (const g of r.scorers) {
    recorded++;
    if (g.minute === null || g.minute < 1) continue;
    withMinute++;
    buckets[Math.min(5, Math.floor((g.minute - 1) / 15))]++;
  }

  // --- formations and months ---
  const formationMap = new Map<string, FormationRow>();
  for (const r of rows) {
    const key = r.formation || '—';
    const f = formationMap.get(key) ?? { formation: key, played: 0, won: 0, drawn: 0, lost: 0, ppg: 0 };
    f.played++;
    if (r.result === 'W') f.won++; else if (r.result === 'D') f.drawn++; else f.lost++;
    formationMap.set(key, f);
  }
  const formations = [...formationMap.values()]
    .map(f => ({ ...f, ppg: round1((f.won * 3 + f.drawn) / f.played) }))
    .sort((a, b) => b.played - a.played || b.ppg - a.ppg);

  const monthMap = new Map<string, MonthRow>();
  const monthRow = (month: string) => {
    let m = monthMap.get(month);
    if (!m) { m = { month, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, sessions: 0 }; monthMap.set(month, m); }
    return m;
  };
  for (const r of rows) {
    const m = monthRow(r.date.slice(0, 7));
    m.played++;
    m.goalsFor += r.goalsFor;
    m.goalsAgainst += r.goalsAgainst;
    m.points += pointsFor(r.result);
    if (r.result === 'W') m.won++; else if (r.result === 'D') m.drawn++; else m.lost++;
  }
  for (const s of completedSessions) monthRow(s.date.slice(0, 7)).sessions++;
  const months = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));

  // --- training ---
  const totalSessions = completedSessions.length;
  for (const s of completedSessions) for (const id of new Set(splitCsv(s.selectedPlayers))) {
    if (lines.has(id)) lines.get(id)!.attendance.attended++;
  }
  for (const line of lines.values()) {
    if (!line.inSquad) continue;
    line.attendance.total = totalSessions;
    line.attendance.rate = totalSessions ? Math.round((line.attendance.attended / totalSessions) * 100) : null;
  }

  let minutes = 0;
  let timed = 0;
  const intensity = { Low: 0, Medium: 0, High: 0 };
  const weekdays = [0, 0, 0, 0, 0, 0, 0];
  const exerciseUse = new Map<string, number>();
  for (const s of completedSessions) {
    const len = toMinutes(s.endTime) - toMinutes(s.startTime);
    if (len > 0) { minutes += len; timed++; }
    if (s.intensity === 'Low' || s.intensity === 'Medium' || s.intensity === 'High') intensity[s.intensity]++;
    const day = parseLocalDate(s.date);
    if (!Number.isNaN(day.getTime())) weekdays[(day.getDay() + 6) % 7]++;
    for (const id of splitCsv(s.selectedExercises)) exerciseUse.set(id, (exerciseUse.get(id) ?? 0) + 1);
  }
  const exercisesById = new Map(input.exercises.map(e => [e.id, e]));
  const usedExercises = [...exerciseUse.entries()]
    .map(([id, count]) => ({ exercise: exercisesById.get(id), count }))
    .filter((x): x is { exercise: Exercise; count: number } => !!x.exercise);
  const categoryCounts = new Map<string, number>();
  for (const { exercise, count } of usedExercises) {
    const key = exercise.category || '';
    categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + count);
  }
  const squadLines = [...lines.values()].filter(l => l.inSquad);
  const rates = squadLines.map(l => l.attendance.rate).filter((r): r is number => r !== null);

  const training: TrainingSummary = {
    completed: totalSessions,
    planned: plannedSessions.length,
    hours: round1(minutes / 60),
    avgMinutes: timed ? Math.round(minutes / timed) : 0,
    avgAttendance: rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null,
    intensity,
    topFocus: topCounts(completedSessions.map(s => s.focus), 6),
    topExercises: usedExercises
      .sort((a, b) => b.count - a.count || a.exercise.name.localeCompare(b.exercise.name))
      .slice(0, 8)
      .map(({ exercise, count }) => ({ name: exercise.name, category: exercise.category, count })),
    categories: [...categoryCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    weekdays,
  };

  // --- players ---
  for (const line of lines.values()) {
    line.contributions = line.goals + line.assists;
    line.goalShare = goalsFor ? Math.round((line.goals / goalsFor) * 100) : null;
    line.ratedMatches = line.ratingLog.length;
    line.avgRating = line.ratedMatches ? round1(line.ratingLog.reduce((s, r) => s + r.rating, 0) / line.ratedMatches) : null;
    line.goalLog.sort((a, b) => a.date.localeCompare(b.date) || (a.minute ?? 999) - (b.minute ?? 999));
  }
  const players = [...lines.values()]
    .filter(l => l.inSquad || l.starts > 0 || l.contributions > 0 || l.ratedMatches > 0)
    .sort((a, b) => Number(b.inSquad) - Number(a.inSquad)
      || (a.jersey ?? 999) - (b.jersey ?? 999)
      || a.lastName.localeCompare(b.lastName));

  // A third of the rated matches (at least 2, at most all of them), so one 10/10 cameo can't win.
  const ratedMatches = rows.filter(r => r.mvp.length > 0).length;
  const minRatedMatches = Math.min(ratedMatches, Math.max(2, Math.ceil(ratedMatches / 3)));
  const awards: Awards = {
    topScorer: bestBy(players, p => p.goals),
    topAssister: bestBy(players, p => p.assists),
    mostContributions: bestBy(players, p => p.contributions),
    mostStarts: bestBy(players, p => p.starts),
    bestAttendance: bestBy(squadLines, p => p.attendance.rate),
    highestRated: ratedMatches
      ? bestBy(players, p => (p.ratedMatches >= minRatedMatches ? p.avgRating : null))
      : bestBy(squadLines, p => p.rating),
    mostMotm: bestBy(players, p => p.motm),
  };

  // --- squad profile ---
  const ages = squadLines.map(l => l.age).filter((a): a is number => a !== null);
  const heights = squadLines.map(l => l.height).filter(h => h > 0);
  const squad: SquadProfile = {
    size: squadLines.length,
    avgAge: ages.length ? round1(ages.reduce((a, b) => a + b, 0) / ages.length) : null,
    avgHeight: heights.length ? Math.round(heights.reduce((a, b) => a + b, 0) / heights.length) : null,
    positions: topCounts(squadLines.map(l => l.position), 10),
    feet: topCounts(squadLines.map(l => l.strongFoot), 5),
    unavailable: squadLines.filter(l => l.status && l.status !== 'Active').length,
  };

  const dates = [...played.map(m => m.date), ...completedSessions.map(s => s.date)].filter(Boolean).sort();
  return {
    teamName: input.teamName,
    seasonName: input.seasonName,
    coachName: input.coachName,
    generatedOn: today,
    period: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
    record,
    highlights,
    matches: rows,
    upcomingMatches,
    pointsProgression,
    goalTiming: { buckets, withMinute, recorded },
    formations,
    months,
    players,
    awards,
    ratedMatches,
    minRatedMatches,
    training,
    squad,
    teamEvents: input.calendarEvents.length,
  };
}
