// src/types/models.ts

export interface Team {
  id: string;
  name: string;
  formation: string;
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
  motherName: string;
  motherPhone: string;
  fatherName: string;
  fatherPhone: string;
  imageUrl: string;
  attendance: number;
  performance: number;
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
}

export interface Exercise {
  id: string;
  name: string;
  intensity: 'Low' | 'Medium' | 'High';
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

export interface SelectorItem {
  id: string; name: string; 
}

export interface PositionSlot { id: string; position: string; x: number; y: number; }

export interface LineupPlayer extends Player { positionSlot: string; isStarter: boolean; }
