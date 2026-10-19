import type { Intensity, MatchEventType } from '../lib/domain';
// src/types/models.ts

export interface Season {
  id: string;
  name: string;
}

export interface Team {
  id: string;
  name: string;
  formation: string;
  seasonId?: string;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  position: string;
  jerseyNumber: number;
  status: string;
  playerPhone: string;
  height: number;
  weight: number;
  clothingSize: string;
  strongFoot: string;
  motherName: string;
  motherPhone: string;
  fatherName: string;
  fatherPhone: string;
  imageUrl: string;
  attendance: number;
  performance: number;
  // Trial players ("Probespieler"): tracked with their current club and a
  // short scouting evaluation until they are signed to a squad.
  isTrial: boolean;
  homeClub: string;
  trialRating: number; // 0 = unrated, 1-5 stars
  trialNotes: string;
  teams?: Team[];
}

export interface TrainingSession {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  focus: string;
  intensity: string;
  selectedPlayers: string;
  selectedExercises: string;
  // Set when this session was materialised from a recurring series. UI uses
  // these to show a "series" badge and to offer the scope dialog on edit/delete.
  seriesId?: string | null;
  isModified?: boolean;
}

export interface Match {
  id: string;
  opponent: string;
  date: string;
  time: string;
  location: string;
  formation: string;
}

export interface MatchDetails {
  id: string;
  opponent: string;
  date: string;
  time: string;
  location: string;
  formation: string; 
  lineup?: string; // JSON String from backend
  goalsFor?: number;
  goalsAgainst?: number;
  notes?: string;
  bench?: string[];
  duration?: number; // minutes
}

export interface MatchSubstitution {
  id: string;
  matchId: string;
  playerInId: string;
  playerOutId: string | null; // null = came on without replacing anyone (e.g. extra player)
  minute: number;
}

export type AttendanceStatus = 'present' | 'absent';
export type AbsenceReason = 'injury' | 'illness' | 'school' | 'excused' | 'unexcused';

export interface TrainingAttendance {
  sessionId: string;
  playerId: string;
  status: AttendanceStatus;
  reason: AbsenceReason | null;
}

export interface MatchEvent {
  id: string;
  matchId: string;
  playerId: string;
  eventType: MatchEventType;
  minute?: number;
}

// Per-match coach rating (1-10). Unrated players have no entry.
export interface MatchRating {
  matchId: string;
  playerId: string;
  rating: number;
}

export interface Exercise {
  id: string;
  name: string;
  // Training focus / drill type (technique, tactical, athletic, game form…).
  // Empty string for exercises created before this field existed.
  category: string;
  intensity: Intensity;
  description: string;
  setup: string;
  variations: string;
  coachingPoints: string;
  goalkeepers: number;
  equipment: string[];
  linkedBasics: string[];
  linkedPrinciples: string[];
  linkedTactics: string[];
  mediaUrl?: string;
  drawing?: string; // JSON, see lib/drillDrawing.ts
  isCustom: boolean;
}

export interface Basic {
  id: string; name: string; description: string; diagramUrl?: string; isCustom: boolean;
}

export interface Principle {
  id: string; 
  name: string; 
  gamePhase: string; 
  description: string;
  coachingNotes?: string; 
  implementationTips?: string; 
  mediaUrl?: string; 
  isCustom: boolean;
}

export interface Tactic {
  id: string; 
  name: string; 
  formation: string; 
  description: string;
  suggestedDrills?: string; 
  isCustom: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
  seriesId?: string | null;
}

export interface SelectorItem {
  id: string; name: string;
}

export interface PositionSlot { id: string; position: string; x: number; y: number; }

export interface CustomFormation {
  id: string;
  name: string;
  positions: string; // JSON string of PositionSlot[]
}

export interface LineupPlayer extends Player { positionSlot: string; isStarter: boolean; }

export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  googleEmail: string;
  calendarId: string;
  timeZone: string;
  pushEnabled: boolean;
  lastSyncedAt: string;
  lastError: string;
}

export interface GoogleSyncResult {
  pulled: number;
  pushed: number;
  removed: number;
}

export type FeedbackType = 'bug' | 'feature' | 'question';
export type FeedbackStatus = 'new' | 'in_progress' | 'resolved';

export interface Feedback {
  id: string;
  type: FeedbackType;
  title: string;
  description: string;
  screenshotUrls: string[];
  status: FeedbackStatus;
  createdAt: string;
}

export interface AdminFeedbackItem extends Feedback {
  coachEmail: string;
  coachName: string;
}

export interface Vision {
  id: string;
  title: string;
  filename: string;
  uploadedAt: string;
}

export interface FormationSource {
  kind: 'default' | 'saved' | 'manual' | 'custom' | 'training';
  sessionDate?: string;
  exerciseName?: string;
}

export interface SuggestedFormation {
  formation: string;
  source: FormationSource;
}

export interface TopPerformer {
  playerId: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  goals: number;
  assists: number;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isVerified: boolean;
  createdAt: string;
  teamCount: number;
  feedbackCount: number;
}

export interface AdminStats {
  users: number;
  teams: number;
  players: number;
  trainingSessions: number;
  matches: number;
  feedbackTotal: number;
  feedbackNew: number;
  feedbackInProgress: number;
  feedbackResolved: number;
}
