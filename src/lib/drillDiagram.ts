import { Exercise } from '../types/models';

export type DrillKind =
  | 'smallSided'
  | 'grid'
  | 'finishing'
  | 'setPiece'
  | 'lineDrill';

export type GoalLayout = 'none' | 'two' | 'one' | 'fourMini';

export interface DrillSpec {
  kind: DrillKind;
  length: number;
  width: number;
  unit: 'm' | 'steps';
  teamA: number;
  teamB: number;
  neutrals: number;
  wallPlayers: number;
  keepers: number;
  goals: GoalLayout;
  ballStacks: number;
  inferred: boolean;
}

const DEFAULTS: Record<DrillKind, Pick<DrillSpec, 'length' | 'width' | 'teamA' | 'teamB' | 'goals' | 'ballStacks'>> = {
  smallSided: { length: 40, width: 30, teamA: 5, teamB: 5, goals: 'two', ballStacks: 2 },
  grid:       { length: 15, width: 15, teamA: 4, teamB: 2, goals: 'none', ballStacks: 1 },
  finishing:  { length: 30, width: 25, teamA: 4, teamB: 0, goals: 'one', ballStacks: 2 },
  setPiece:   { length: 40, width: 40, teamA: 6, teamB: 5, goals: 'one', ballStacks: 1 },
  lineDrill:  { length: 25, width: 12, teamA: 6, teamB: 0, goals: 'none', ballStacks: 1 },
};

const KIND_BY_CATEGORY: Record<string, DrillKind> = {
  Technique: 'grid',
  Passing: 'grid',
  Warmup: 'lineDrill',
  Athletic: 'lineDrill',
  GameForm: 'smallSided',
  Tactical: 'smallSided',
  Finishing: 'finishing',
  SetPiece: 'setPiece',
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// Understands "40x30m", "40 x 30 m", "10x10m grid" and "50 Schritte" / "20 Schritte" pairs.
function parseDimensions(text: string): { length: number; width: number; unit: 'm' | 'steps' } | null {
  // The paired "50x20 Schritte" form first, so it isn't read as a single measurement.
  const stepPair = text.match(/(\d{1,3})\s*[x×]\s*(\d{1,3})\s*Schritte/i);
  if (stepPair) {
    const a = Number(stepPair[1]);
    const b = Number(stepPair[2]);
    return { length: Math.max(a, b), width: Math.min(a, b), unit: 'steps' };
  }

  const metres = text.match(/(\d{1,3})\s*[x×]\s*(\d{1,3})\s*(?:m\b|meter|metre)/i);
  if (metres) {
    const a = Number(metres[1]);
    const b = Number(metres[2]);
    return { length: Math.max(a, b), width: Math.min(a, b), unit: 'm' };
  }

  const steps = [...text.matchAll(/(\d{1,3})\s*Schritte/gi)].map(m => Number(m[1]));
  if (steps.length >= 2) {
    return { length: Math.max(steps[0], steps[1]), width: Math.min(steps[0], steps[1]), unit: 'steps' };
  }
  if (steps.length === 1) {
    return { length: steps[0], width: Math.round(steps[0] * 0.75), unit: 'steps' };
  }

  // A bare "40x30" is a pitch only when both numbers are pitch-sized; small ones are a matchup like 4x2.
  const bare = text.match(/(\d{1,3})\s*[x×]\s*(\d{1,3})(?!\s*\d)/);
  if (bare) {
    const a = Number(bare[1]);
    const b = Number(bare[2]);
    if (a >= 8 && b >= 8) return { length: Math.max(a, b), width: Math.min(a, b), unit: 'm' };
  }
  return null;
}

// "x" only counts next to a football word, so the "10x10m" in a setup is never a 10-a-side game.
function parseMatchup(text: string): { teamA: number; teamB: number } | null {
  const vs = text.match(/(\d{1,2})\s*(?:vs\.?|v|gegen)\s*(\d{1,2})/i);
  if (vs) return { teamA: Number(vs[1]), teamB: Number(vs[2]) };

  const cross = text.match(/(\d{1,2})\s*[x×]\s*(\d{1,2})\s*-?\s*(?:fu[sß]{1,2}ball|football|soccer|spiel)/i);
  if (cross) return { teamA: Number(cross[1]), teamB: Number(cross[2]) };

  return null;
}

/** "+3N", "+ 2 Neutrale", "plus 3 neutral" → 3. */
function parseNeutrals(text: string): number {
  const m = text.match(/\+\s*(\d{1,2})\s*(?:N\b|Neutrale?n?\b|Anspieler)/i);
  if (m) return Number(m[1]);
  return /\bneutral/i.test(text) ? 1 : 0;
}

/** "+4WaSp", "+2 Wandspieler", "with wall players" → count (default 2). */
function parseWallPlayers(text: string): number {
  const m = text.match(/\+\s*(\d{1,2})\s*(?:WaSp|Wandspieler|wall)/i);
  if (m) return Number(m[1]);
  return /WaSp|Wandspieler|wall player/i.test(text) ? 2 : 0;
}

function parseKeepers(text: string): number {
  const counted = text.match(/(?:\+\s*)?(\d{1,2})\s*(?:GKs?\b|TW\b|Torw(?:art|arte|ärte)?|keepers?)/i);
  if (counted) return Number(counted[1]);
  if (/\btwo\s+gks?\b|beide\s+torw|two\s+keepers/i.test(text)) return 2;
  if (/\bGK\b|\bTW\b|Torwart|keeper|goalkeeper/i.test(text)) return 1;
  return 0;
}

function parseGoals(text: string, equipment: string[], kind: DrillKind): GoalLayout | null {
  const haystack = `${text} ${equipment.join(' ')}`;
  if (/full goals both ends|beide (?:seiten|enden)|zwei (?:gro[sß]e )?tore|two (?:full )?goals/i.test(haystack)) return 'two';
  if (/4\s*(?:mini|klein)|four mini|minitore/i.test(haystack)) return 'fourMini';
  if (/\bgoals\b|\btore\b/i.test(haystack)) return 'two';
  if (/\bgoal\b|\btor\b/i.test(haystack)) return kind === 'smallSided' ? 'two' : 'one';
  return null;
}

export function deriveDrillSpec(exercise: Exercise): DrillSpec {
  const name = exercise.name || '';
  const setup = exercise.setup || '';
  const description = exercise.description || '';
  const equipment = exercise.equipment || [];

  const kind = KIND_BY_CATEGORY[exercise.category || ''] || 'smallSided';
  const base = DEFAULTS[kind];

  // Title first, so a stray number in a long description can't outvote the name.
  const titleFirst = `${name} ${setup} ${description}`;
  const setupFirst = `${setup} ${name} ${description}`;

  const dims = parseDimensions(setupFirst);
  const matchup = parseMatchup(titleFirst);
  const neutrals = parseNeutrals(titleFirst);
  const wallPlayers = parseWallPlayers(titleFirst);

  const parsedKeepers = parseKeepers(titleFirst);
  const keepers = clamp(Math.max(parsedKeepers, exercise.goalkeepers || 0), 0, 2);

  const goals = parseGoals(`${name} ${setup} ${description}`, equipment, kind) ?? base.goals;

  return {
    kind,
    length: clamp(dims?.length ?? base.length, 6, 110),
    width: clamp(dims?.width ?? base.width, 4, 75),
    unit: dims?.unit ?? 'm',
    teamA: clamp(matchup?.teamA ?? base.teamA, 0, 11),
    teamB: clamp(matchup?.teamB ?? base.teamB, 0, 11),
    neutrals: clamp(neutrals, 0, 6),
    wallPlayers: clamp(wallPlayers, 0, 6),
    keepers,
    // Keepers imply goals to defend, whatever the text said.
    goals: keepers >= 2 ? (goals === 'none' ? 'two' : goals) : goals,
    ballStacks: base.ballStacks,
    inferred: !dims && !matchup,
  };
}

export function describeDrillSpec(spec: DrillSpec): string {
  const parts: string[] = [];
  if (spec.teamA && spec.teamB) parts.push(`${spec.teamA}v${spec.teamB}`);
  else if (spec.teamA) parts.push(`${spec.teamA}`);
  if (spec.neutrals) parts.push(`+${spec.neutrals}N`);
  if (spec.wallPlayers) parts.push(`+${spec.wallPlayers}W`);
  if (spec.keepers) parts.push(`+${spec.keepers}TW`);
  const unit = spec.unit === 'steps' ? '' : 'm';
  return `${parts.join(' ')} · ${spec.length}x${spec.width}${unit}`.trim();
}
