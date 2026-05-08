// src/lib/data-mappers.ts
import { Player, TrainingSession, Basic, Principle, Tactic, Exercise, Match, MatchDetails, SelectorItem } from '../types/models';

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
  motherName: p.mother_name || '',
  motherPhone: p.mother_phone || '',
  fatherName: p.father_name || '',
  fatherPhone: p.father_phone || '',
  imageUrl: p.image_url || '',
  attendance: p.attendance || 0,
  performance: p.performance || 0,
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
  intensity: s.intensity || 'Medium',
  selectedPlayers: s.selected_players || '',
  selectedExercises: s.selected_exercises || '',
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
  intensity: e.intensity || 'Medium',
  description: e.description || '',
  setup: e.setup || '',
  variations: e.variations || '',
  coachingPoints: e.coaching_points || '',
  goalkeepers: e.goalkeepers || 0,
  equipment: e.equipment ? e.equipment.split(',') : [],
  linkedBasics: e.linked_basics ? e.linked_basics.split(',') : [],
  linkedPrinciples: e.linked_principles ? e.linked_principles.split(',') : [],
  linkedTactics: e.linked_tactics ? e.linked_tactics.split(',') : [],
  mediaUrl: e.media_url || '',
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
  formation: m.formation || '4-4-2',
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
  formation: m.formation || '4-4-2',
  lineup: m.lineup,
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
  mother_name: p.motherName,
  mother_phone: p.motherPhone,
  father_name: p.fatherName,
  father_phone: p.fatherPhone,
  image_url: p.imageUrl,
  attendance: p.attendance,
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
 * Maps a clean Tactic model back to the snake_case format.
 */
export const mapTacticToApi = (t: Tactic) => ({
  name: t.name,
  formation: t.formation,
  description: t.description,
  suggested_drills: t.suggestedDrills,
});

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
  intensity: e.intensity,
  description: e.description,
  setup: e.setup,
  variations: e.variations,
  coaching_points: e.coachingPoints,
  goalkeepers: e.goalkeepers,
  equipment: e.equipment.join(','),
  linked_basics: e.linkedBasics.join(','),
  linked_principles: e.linkedPrinciples.join(','),
  linked_tactics: e.linkedTactics.join(','),
  media_url: e.mediaUrl,
});
