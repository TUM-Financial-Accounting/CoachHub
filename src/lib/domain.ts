import type { Exercise, Player } from '../types/models';

// These are the choices the UI offers. Stored values stay plain strings: older
// rows may hold something else, and the mappers fill in defaults.

export const INTENSITIES = ['Low', 'Medium', 'High'] as const;
export type Intensity = (typeof INTENSITIES)[number];
export const DEFAULT_INTENSITY: Intensity = 'Medium';

const INTENSITY_META = {
  Low:    { labelKey: 'common.low',    badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', text: 'text-emerald-400', dot: 'bg-emerald-500', hex: '#10b981', width: '33%' },
  Medium: { labelKey: 'common.medium', badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',       text: 'text-amber-400',   dot: 'bg-amber-500',   hex: '#f59e0b', width: '66%' },
  High:   { labelKey: 'common.high',   badge: 'bg-rose-500/10 border-rose-500/20 text-rose-400',          text: 'text-rose-400',    dot: 'bg-rose-500',    hex: '#f43f5e', width: '100%' },
} as const;

const isIntensity = (value?: string): value is Intensity =>
  (INTENSITIES as readonly string[]).includes(value ?? '');

// Unknown values render as Medium, the same default the mappers use.
export const intensityMeta = (value?: string) =>
  INTENSITY_META[isIntensity(value) ? value : DEFAULT_INTENSITY];

export const PLAYER_STATUS = { Active: 'Active', Injured: 'Injured', Away: 'Away' } as const;
export type PlayerStatus = (typeof PLAYER_STATUS)[keyof typeof PLAYER_STATUS];
export const PLAYER_STATUSES: readonly PlayerStatus[] = Object.values(PLAYER_STATUS);

const STATUS_STYLES: Record<PlayerStatus, string> = {
  Active:  'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  Injured: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  Away:    'bg-amber-500/10 text-amber-500 border-amber-500/20',
};

export const statusStyle = (status?: string): string =>
  STATUS_STYLES[status as PlayerStatus] ?? 'bg-slate-500/10 text-slate-500 border-slate-500/20';

export const PLAYER_POSITIONS = ['Forward', 'Midfielder', 'Defender', 'Goalkeeper'] as const;
export const DEFAULT_POSITION = PLAYER_POSITIONS[0];

const PERF_GOOD = 7;
const PERF_OK = 4;

export const perfStyle = (score: number) => {
  if (score >= PERF_GOOD) return { bar: 'bg-emerald-500', glow: 'shadow-[0_0_10px_rgba(16,185,129,0.5)]', text: 'text-emerald-400' };
  if (score >= PERF_OK) return { bar: 'bg-amber-500', glow: 'shadow-[0_0_10px_rgba(245,158,11,0.5)]', text: 'text-amber-400' };
  return { bar: 'bg-rose-500', glow: 'shadow-[0_0_10px_rgba(239,68,68,0.5)]', text: 'text-rose-400' };
};

// Must match the event_type strings get_top_performers counts in backend/main.py.
export const MATCH_EVENT = { Goal: 'Goal', Assist: 'Assist' } as const;
export type MatchEventType = (typeof MATCH_EVENT)[keyof typeof MATCH_EVENT];

export const GAME_PHASES = [
  'In Possession',
  'Transition After Losing Possession',
  'Out of Possession',
  'Transition After Winning Possession',
  'Set Pieces',
] as const;
export type GamePhase = (typeof GAME_PHASES)[number];
export const DEFAULT_GAME_PHASE: GamePhase = GAME_PHASES[0];

const DEFAULT_PHASE_COLOR = {
  bg: "bg-zinc-500/10", border: "border-zinc-500/30", text: "text-zinc-400",
  badge: "text-zinc-300", badgeBg: "bg-zinc-500/10 border-zinc-500/20",
  dot: "bg-zinc-500", glow: "shadow-[0_0_8px_rgba(113,113,122,0.4)]",
  tabActive: "bg-zinc-500/15 border-zinc-500/50 text-zinc-400",
  tabHover: "hover:border-zinc-500/30 hover:text-zinc-400",
};

const PHASE_COLORS: Record<string, {
  bg: string; border: string; text: string; badge: string; badgeBg: string;
  dot: string; glow: string; tabActive: string; tabHover: string;
}> = {
  "In Possession": {
    bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400",
    badge: "text-emerald-300", badgeBg: "bg-emerald-500/10 border-emerald-500/20",
    dot: "bg-emerald-500", glow: "shadow-[0_0_8px_rgba(52,211,153,0.4)]",
    tabActive: "bg-emerald-500/15 border-emerald-500/50 text-emerald-400",
    tabHover: "hover:border-emerald-500/30 hover:text-emerald-400",
  },
  "Transition After Losing Possession": {
    bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400",
    badge: "text-amber-300", badgeBg: "bg-amber-500/10 border-amber-500/20",
    dot: "bg-amber-500", glow: "shadow-[0_0_8px_rgba(245,158,11,0.4)]",
    tabActive: "bg-amber-500/15 border-amber-500/50 text-amber-400",
    tabHover: "hover:border-amber-500/30 hover:text-amber-400",
  },
  "Out of Possession": {
    bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-400",
    badge: "text-rose-300", badgeBg: "bg-rose-500/10 border-rose-500/20",
    dot: "bg-rose-500", glow: "shadow-[0_0_8px_rgba(244,63,94,0.4)]",
    tabActive: "bg-rose-500/15 border-rose-500/50 text-rose-400",
    tabHover: "hover:border-rose-500/30 hover:text-rose-400",
  },
  "Transition After Winning Possession": {
    bg: "bg-sky-500/10", border: "border-sky-500/30", text: "text-sky-400",
    badge: "text-sky-300", badgeBg: "bg-sky-500/10 border-sky-500/20",
    dot: "bg-sky-500", glow: "shadow-[0_0_8px_rgba(14,165,233,0.4)]",
    tabActive: "bg-sky-500/15 border-sky-500/50 text-sky-400",
    tabHover: "hover:border-sky-500/30 hover:text-sky-400",
  },
  "Set Pieces": {
    bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-400",
    badge: "text-violet-300", badgeBg: "bg-violet-500/10 border-violet-500/20",
    dot: "bg-violet-500", glow: "shadow-[0_0_8px_rgba(139,92,246,0.4)]",
    tabActive: "bg-violet-500/15 border-violet-500/50 text-violet-400",
    tabHover: "hover:border-violet-500/30 hover:text-violet-400",
  },
};

export const phaseStyle = (phase: string) => PHASE_COLORS[phase] ?? DEFAULT_PHASE_COLOR;

const PHASE_META = {
  'In Possession':                       { shortKey: 'phases.inPossessionShort',      longKey: 'phases.inPossession' },
  'Transition After Losing Possession':  { shortKey: 'phases.transitionLosingShort',  longKey: 'phases.transitionLosing' },
  'Out of Possession':                   { shortKey: 'phases.outOfPossessionShort',   longKey: 'phases.outOfPossession' },
  'Transition After Winning Possession': { shortKey: 'phases.transitionWinningShort', longKey: 'phases.transitionWinning' },
  'Set Pieces':                          { shortKey: 'phases.setPiecesShort',         longKey: 'phases.setPieces' },
} as const;

export const phaseLabelKeys = (phase: string) =>
  (GAME_PHASES as readonly string[]).includes(phase) ? PHASE_META[phase as GamePhase] : null;

export const EQUIPMENT_OPTIONS = ['Balls', 'Cones', 'Bibs/Vests', 'Goals', 'Hurdles', 'Poles', 'Agility Ladder', 'Markers', 'Mannequins', 'Mini Goals'] as const;

export const emptyPlayer = (): Player => ({
  id: '', firstName: '', lastName: '', dateOfBirth: '', position: DEFAULT_POSITION, jerseyNumber: 0,
  status: PLAYER_STATUS.Active, playerPhone: '', height: 0, weight: 0, clothingSize: '', strongFoot: '',
  motherName: '', motherPhone: '', fatherName: '', fatherPhone: '', imageUrl: '', attendance: 0,
  performance: 0, isTrial: false, homeClub: '', trialRating: 0, trialNotes: '',
});

export const emptyExercise = (): Exercise => ({
  id: '', name: '', category: '', intensity: DEFAULT_INTENSITY, description: '', setup: '',
  variations: '', coachingPoints: '', goalkeepers: 0, equipment: [], linkedBasics: [],
  linkedPrinciples: [], linkedTactics: [], isCustom: true, mediaUrl: '', drawing: '',
});
