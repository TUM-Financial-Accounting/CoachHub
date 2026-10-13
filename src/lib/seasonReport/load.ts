import { EventService, ExerciseService, MatchService, PlayerService, TrainingService } from '../../services';
import { STORAGE_KEYS } from '../storageKeys';
import { todayISO } from '../dates';
import { buildSeasonReport, isPlayed, type SeasonReport } from './build';

function storedCoachName(): string {
  try {
    const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || '{}');
    return typeof user?.full_name === 'string' ? user.full_name : '';
  } catch {
    return '';
  }
}

export async function loadSeasonReport(team: { id: string; name: string }, season: { id: string; name: string }): Promise<SeasonReport> {
  const today = todayISO();
  const [players, matches, sessions, exercises, calendarEvents, ratings] = await Promise.all([
    PlayerService.getAll(team.id, season.id),
    MatchService.getAll(team.id, season.id),
    TrainingService.getAll(team.id, season.id),
    ExerciseService.getAll(),
    EventService.getAll(team.id, season.id),
    MatchService.getSeasonRatings(team.id, season.id),
  ]);
  const played = matches.filter(m => isPlayed(m, today));
  const eventLists = await Promise.all(played.map(m => MatchService.getEvents(m.id)));

  return buildSeasonReport({
    teamName: team.name,
    seasonName: season.name,
    coachName: storedCoachName(),
    today,
    players,
    matches,
    matchEvents: Object.fromEntries(played.map((m, i) => [m.id, eventLists[i]])),
    ratings,
    sessions,
    exercises,
    calendarEvents,
  });
}
