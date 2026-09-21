// src/lib/data-mappers.ts
import { Player, TrainingSession, Basic, Principle, Tactic, Exercise, Match, MatchDetails, SelectorItem, CalendarEvent, AdminFeedbackItem, AdminUser, AdminStats, GoogleStatus, GoogleSyncResult } from '../types/models';
import { DEFAULT_INTENSITY } from './domain';
import { joinCsv, splitCsv } from './csv';
import { DEFAULT_FORMATION } from './formations';

/**
 * Maps a raw player object from the snake_case API response
 * to the camelCase Player model used in the frontend.
 * @param p - The raw player object from the API (any type).
 * @returns A clean, camelCase Player object.
 */
export const mapPlayerFromApi = (p: any): Player => ({
  id: p.id,
  firstName: p.first_name || '',
  lastName: p.last_name || '',
  dateOfBirth: p.date_of_birth || '',
  position: p.position || 'Unknown',
  jerseyNumber: p.jersey_number || 0,
  status: p.status || 'Unknown',
  playerPhone: p.player_phone || '',
  height: p.height || 0,
  weight: p.weight || 0,
  clothingSize: p.clothing_size || '',
  strongFoot: p.strong_foot || '',
  motherName: p.mother_name || '',
  motherPhone: p.mother_phone || '',
  fatherName: p.father_name || '',
  fatherPhone: p.father_phone || '',
  imageUrl: p.image_url || '',
  attendance: p.attendance || 0,
  performance: p.performance || 0,
  isTrial: !!p.is_trial,
  homeClub: p.home_club || '',
  trialRating: p.trial_rating || 0,
  trialNotes: p.trial_notes || '',
  teams: p.teams || [],
});

/**
 * Maps a raw training session object from the snake_case API response
 * to the camelCase TrainingSession model used in the frontend.
 * @param s - The raw session object from the API (any type).
 * @returns A clean, camelCase TrainingSession object.
 */
export const mapSessionFromApi = (s: any): TrainingSession => ({
  id: s.id,
  date: s.date || '',
  startTime: s.start_time || '',
  endTime: s.end_time || '',
  focus: s.focus || '',
  intensity: s.intensity || DEFAULT_INTENSITY,
  selectedPlayers: s.selected_players || '',
  selectedExercises: s.selected_exercises || '',
  seriesId: s.series_id || null,
  isModified: !!s.is_modified,
});

/**
 * Maps a raw basic library item from the snake_case API response.
 * @param b - The raw basic object from the API.
 * @returns A clean Basic object.
 */
export const mapBasicFromApi = (b: any): Basic => ({
  id: b.id,
  name: b.name || '',
  description: b.description || '',
  diagramUrl: b.diagram_url || '',
  isCustom: b.is_custom !== undefined ? b.is_custom : true,
});

/**
 * Maps a raw principle library item from the snake_case API response.
 * @param p - The raw principle object from the API.
 * @returns A clean Principle object.
 */
export const mapPrincipleFromApi = (p: any): Principle => ({
  id: p.id,
  name: p.name || '',
  gamePhase: p.game_phase || '',
  description: p.description || '',
  coachingNotes: p.coaching_notes || '',
  implementationTips: p.implementation_tips || '',
  mediaUrl: p.media_url || '',
  isCustom: p.is_custom !== undefined ? p.is_custom : true,
});

/**
 * Maps a raw tactic library item from the snake_case API response.
 * @param t - The raw tactic object from the API.
 * @returns A clean Tactic object.
 */
export const mapTacticFromApi = (t: any): Tactic => ({
  id: t.id,
  name: t.name || '',
  formation: t.formation || '',
  description: t.description || '',
  suggestedDrills: t.suggested_drills || '',
  isCustom: t.is_custom !== undefined ? t.is_custom : true,
});

/**
 * Maps a raw exercise library item from the snake_case API response.
 * @param e - The raw exercise object from the API.
 * @returns A clean Exercise object.
 */
export const mapExerciseFromApi = (e: any): Exercise => ({
  id: e.id,
  name: e.name || '',
  category: e.category || '',
  intensity: e.intensity || DEFAULT_INTENSITY,
  description: e.description || '',
  setup: e.setup || '',
  variations: e.variations || '',
  coachingPoints: e.coaching_points || '',
  goalkeepers: e.goalkeepers || 0,
  equipment: splitCsv(e.equipment),
  linkedBasics: splitCsv(e.linked_basics),
  linkedPrinciples: splitCsv(e.linked_principles),
  linkedTactics: splitCsv(e.linked_tactics),
  mediaUrl: e.media_url || '',
  drawing: e.drawing || '',
  isCustom: e.is_custom !== undefined ? e.is_custom : true,
});

/**
 * Maps a raw match object from the snake_case API response.
 * @param m - The raw match object from the API.
 * @returns A clean Match object.
 */
export const mapMatchFromApi = (m: any): Match => ({
  id: m.id,
  opponent: m.opponent || '',
  date: m.date || '',
  time: m.time || '',
  location: m.location || '',
  formation: m.formation || DEFAULT_FORMATION,
});

/**
 * Maps a raw match details object from the snake_case API response.
 * @param m - The raw match details object from the API.
 * @returns A clean MatchDetails object.
 */
export const mapMatchDetailsFromApi = (m: any): MatchDetails => ({
  id: m.id,
  opponent: m.opponent || '',
  date: m.date || '',
  time: m.time || '',
  location: m.location || '',
  formation: m.formation || DEFAULT_FORMATION,
  lineup: m.lineup,
  // Keep unrecorded scores as undefined — coercing to 0 made every
  // unrecorded past match look like a played 0–0 draw in the statistics.
  goalsFor: m.goals_for ?? undefined,
  goalsAgainst: m.goals_against ?? undefined,
  notes: m.notes || '',
});

/**
 * Maps a raw match event from the snake_case API response.
 */
export const mapMatchEventFromApi = (e: any): any => ({
  id: e.id,
  matchId: e.match_id,
  playerId: e.player_id,
  eventType: e.event_type,
  minute: e.minute,
});

/**
 * Maps a clean Player model back to the snake_case format
 * expected by the API.
 * @param p - The Player object.
 * @returns A snake_case object for the API.
 */
export const mapPlayerToApi = (p: Player) => ({
  first_name: p.firstName,
  last_name: p.lastName,
  date_of_birth: p.dateOfBirth,
  position: p.position,
  jersey_number: p.jerseyNumber,
  status: p.status,
  player_phone: p.playerPhone,
  height: p.height,
  weight: p.weight,
  clothing_size: p.clothingSize,
  strong_foot: p.strongFoot,
  mother_name: p.motherName,
  mother_phone: p.motherPhone,
  father_name: p.fatherName,
  father_phone: p.fatherPhone,
  image_url: p.imageUrl,
  attendance: p.attendance,
  is_trial: p.isTrial,
  home_club: p.homeClub,
  trial_rating: p.trialRating,
  trial_notes: p.trialNotes,
});

/**
 * Maps a clean TrainingSession model back to the snake_case format.
 */
export const mapSessionToApi = (s: TrainingSession) => ({
  date: s.date,
  start_time: s.startTime,
  end_time: s.endTime,
  focus: s.focus,
  intensity: s.intensity,
  selected_players: s.selectedPlayers,
  selected_exercises: s.selectedExercises,
});

/**
 * Maps a clean Basic model back to the snake_case format.
 */
export const mapBasicToApi = (b: Basic) => ({
  name: b.name,
  description: b.description,
  diagram_url: b.diagramUrl,
});

/**
 * Maps a clean Principle model back to the snake_case format.
 */
export const mapPrincipleToApi = (p: Principle) => ({
  name: p.name,
  game_phase: p.gamePhase,
  description: p.description,
  coaching_notes: p.coachingNotes,
  implementation_tips: p.implementationTips,
  media_url: p.mediaUrl,
});

/**
 * Maps a clean Tactic model back to the snake_case format. `id` is forwarded
 * if present so the backend can honor a client-minted UUID.
 */
export const mapTacticToApi = (t: Tactic) => {
  const out: any = {
    name: t.name,
    formation: t.formation,
    description: t.description,
    suggested_drills: t.suggestedDrills,
  };
  if (t.id) out.id = t.id;
  return out;
};

/**
 * Maps a clean Match model back to the snake_case format.
 */
export const mapMatchToApi = (m: Match) => ({
  opponent: m.opponent,
  date: m.date,
  time: m.time,
  location: m.location,
  formation: m.formation,
});

/**
 * Maps a clean MatchDetails model back to the snake_case format.
 */
export const mapMatchDetailsToApi = (m: MatchDetails) => ({
  opponent: m.opponent,
  date: m.date,
  time: m.time,
  location: m.location,
  formation: m.formation,
  lineup: m.lineup,
  goals_for: m.goalsFor,
  goals_against: m.goalsAgainst,
  notes: m.notes,
});

/**
 * Maps a raw calendar event from the snake_case API response.
 */
export const mapEventFromApi = (e: any): CalendarEvent => ({
  id: e.id,
  title: e.title || '',
  description: e.description || '',
  location: e.location || '',
  date: e.date || '',
  startTime: e.start_time || '',
  endTime: e.end_time || '',
});

/**
 * Maps a clean CalendarEvent back to the snake_case format expected by the API.
 */
export const mapEventToApi = (e: CalendarEvent) => ({
  title: e.title,
  description: e.description,
  location: e.location,
  date: e.date,
  start_time: e.startTime,
  end_time: e.endTime,
});

/**
 * Maps a raw object to a SelectorItem.
 * @param item - Any object with id and name (or similar fields).
 * @returns A clean SelectorItem object.
 */
export const mapSelectorItemFromApi = (item: any): SelectorItem => ({
  id: item.id,
  name: item.name || '',
});

/**
 * Maps a clean Exercise model back to the snake_case format.
 */
export const mapExerciseToApi = (e: Exercise) => ({
  name: e.name,
  category: e.category,
  intensity: e.intensity,
  description: e.description,
  setup: e.setup,
  variations: e.variations,
  coaching_points: e.coachingPoints,
  goalkeepers: e.goalkeepers,
  equipment: joinCsv(e.equipment),
  linked_basics: joinCsv(e.linkedBasics),
  linked_principles: joinCsv(e.linkedPrinciples),
  linked_tactics: joinCsv(e.linkedTactics),
  media_url: e.mediaUrl,
  drawing: e.drawing || null,
});

export const mapGoogleStatusFromApi = (s: any): GoogleStatus => ({
  configured: !!s.configured,
  connected: !!s.connected,
  googleEmail: s.google_email || '',
  calendarId: s.calendar_id || '',
  timeZone: s.time_zone || '',
  pushEnabled: !!s.push_enabled,
  lastSyncedAt: s.last_synced_at || '',
  lastError: s.last_error || '',
});

export const mapGoogleSyncResultFromApi = (s: any): GoogleSyncResult => ({
  pulled: s.pulled || 0,
  pushed: s.pushed || 0,
  removed: s.removed || 0,
});

export const mapAdminFeedbackFromApi = (f: any): AdminFeedbackItem => ({
  id: f.id,
  type: f.type || 'question',
  title: f.title || '',
  description: f.description || '',
  screenshotUrls: f.screenshot_urls || [],
  status: f.status || 'new',
  createdAt: f.created_at || '',
  coachEmail: f.coach_email || '',
  coachName: f.coach_name || '',
});

export const mapAdminUserFromApi = (u: any): AdminUser => ({
  id: u.id,
  email: u.email || '',
  fullName: u.full_name || '',
  role: u.role || 'coach',
  isVerified: !!u.is_verified,
  createdAt: u.created_at || '',
  teamCount: u.team_count || 0,
  feedbackCount: u.feedback_count || 0,
});

export const mapAdminStatsFromApi = (s: any): AdminStats => ({
  users: s.users || 0,
  teams: s.teams || 0,
  players: s.players || 0,
  trainingSessions: s.training_sessions || 0,
  matches: s.matches || 0,
  feedbackTotal: s.feedback_total || 0,
  feedbackNew: s.feedback_new || 0,
  feedbackInProgress: s.feedback_in_progress || 0,
  feedbackResolved: s.feedback_resolved || 0,
});
