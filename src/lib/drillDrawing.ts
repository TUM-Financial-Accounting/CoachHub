// Stored as JSON in Exercise.drawing. Coordinates are canvas units (300x200).
export const CANVAS_W = 300;
export const CANVAS_H = 200;
export const DRAWING_VERSION = 1;

export const DRILL_PALETTE = {
  blue:    '#2F80ED',
  magenta: '#D41C8C',
  yellow:  '#F2C200',
  green:   '#2FB344',
  gray:    '#8C96A3',
  red:     '#E03B3B',
  white:   '#FFFFFF',
  black:   '#1A1F26',
} as const;

export type DrillColor = keyof typeof DRILL_PALETTE;
export const DRILL_COLOR_KEYS = Object.keys(DRILL_PALETTE) as DrillColor[];

export type ArrowKind = 'run' | 'dribble' | 'pass' | 'shot';
export type GoalSize = 'full' | 'mini';
export type Rotation = 0 | 90 | 180 | 270;
export type DrillBackground = 'blank' | 'pitch' | 'half';

interface Positioned { id: string; x: number; y: number }

export type DrillElement =
  | (Positioned & { kind: 'cone'; color: DrillColor })
  | (Positioned & { kind: 'player'; color: DrillColor; label: string })
  | (Positioned & { kind: 'coach' })
  | (Positioned & { kind: 'figure'; color: DrillColor })
  | (Positioned & { kind: 'pole'; color: DrillColor })
  | (Positioned & { kind: 'ball'; color: DrillColor })
  | (Positioned & { kind: 'zone'; w: number; h: number; color: DrillColor })
  | (Positioned & { kind: 'goal'; size: GoalSize; rotation: Rotation })
  | (Positioned & { kind: 'arrow'; arrow: ArrowKind; x2: number; y2: number })
  | (Positioned & { kind: 'text'; text: string });

export type DrillElementKind = DrillElement['kind'];

export interface DrillDrawing {
  version: number;
  background: DrillBackground;
  elements: DrillElement[];
}

export const emptyDrawing = (): DrillDrawing => ({
  version: DRAWING_VERSION,
  background: 'blank',
  elements: [],
});

const COLOR_SET = new Set<string>(DRILL_COLOR_KEYS);
const ARROWS = new Set<string>(['run', 'dribble', 'pass', 'shot']);
const BACKGROUNDS = new Set<string>(['blank', 'pitch', 'half']);
const ROTATIONS = new Set<number>([0, 90, 180, 270]);

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const color = (v: unknown, fallback: DrillColor): DrillColor =>
  typeof v === 'string' && COLOR_SET.has(v) ? (v as DrillColor) : fallback;

function normaliseElement(raw: unknown, index: number): DrillElement | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' && r.id ? r.id : `el-${index}`;
  const base = { id, x: num(r.x, 0), y: num(r.y, 0) };
  switch (r.kind) {
    case 'cone':   return { ...base, kind: 'cone', color: color(r.color, 'blue') };
    case 'player': return { ...base, kind: 'player', color: color(r.color, 'blue'), label: typeof r.label === 'string' ? r.label.slice(0, 3) : '' };
    case 'coach':  return { ...base, kind: 'coach' };
    case 'figure': return { ...base, kind: 'figure', color: color(r.color, 'yellow') };
    case 'pole':   return { ...base, kind: 'pole', color: color(r.color, 'yellow') };
    case 'ball':   return { ...base, kind: 'ball', color: color(r.color, 'white') };
    case 'zone':   return { ...base, kind: 'zone', w: Math.max(4, num(r.w, 40)), h: Math.max(4, num(r.h, 30)), color: color(r.color, 'blue') };
    case 'goal':   return { ...base, kind: 'goal', size: r.size === 'mini' ? 'mini' : 'full', rotation: ROTATIONS.has(num(r.rotation, 0)) ? (num(r.rotation, 0) as Rotation) : 0 };
    case 'arrow':  return ARROWS.has(String(r.arrow)) ? { ...base, kind: 'arrow', arrow: r.arrow as ArrowKind, x2: num(r.x2, base.x + 30), y2: num(r.y2, base.y) } : null;
    case 'text':   return { ...base, kind: 'text', text: typeof r.text === 'string' ? r.text.slice(0, 60) : '' };
    default:       return null;
  }
}

export function parseDrawing(json?: string | null): DrillDrawing | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    if (!raw || !Array.isArray(raw.elements)) return null;
    return {
      version: DRAWING_VERSION,
      background: BACKGROUNDS.has(String(raw.background)) ? (raw.background as DrillBackground) : 'blank',
      elements: raw.elements.map(normaliseElement).filter((e): e is DrillElement => e !== null),
    };
  } catch {
    return null;
  }
}

export const serializeDrawing = (drawing: DrillDrawing): string => JSON.stringify(drawing);

export const hasDrawing = (json?: string | null): boolean => {
  const d = parseDrawing(json);
  return !!d && d.elements.length > 0;
};

export const clampPoint = (x: number, y: number): { x: number; y: number } => ({
  x: Math.min(CANVAS_W, Math.max(0, x)),
  y: Math.min(CANVAS_H, Math.max(0, y)),
});

let counter = 0;
export const nextElementId = (): string => `d${Date.now().toString(36)}${(counter++).toString(36)}`;
