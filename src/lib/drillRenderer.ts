import type jsPDF from 'jspdf';
import { DrillSpec } from './drillDiagram';

type RGB = [number, number, number];

export const DRILL_COLORS: Record<string, RGB> = {
  teamA:   [59, 130, 246],
  teamB:   [236, 72, 153],
  neutral: [250, 204, 21],
  wall:    [34, 197, 94],
  keeper:  [148, 163, 184],
  pitch:   [37, 99, 235],
  ink:     [15, 23, 42],
  muted:   [148, 163, 184],
  ball:    [226, 232, 240],
};

export interface Box { x: number; y: number; w: number; h: number }

const MARKER = 2.2;      // triangle half-width, mm
const GOAL_W = 9;        // goal mouth, mm
const GOAL_D = 2.2;      // goal depth, mm

function marker(doc: jsPDF, cx: number, cy: number, color: RGB) {
  doc.setFillColor(color[0], color[1], color[2]);
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.2);
  doc.triangle(cx, cy - MARKER, cx - MARKER, cy + MARKER * 0.85, cx + MARKER, cy + MARKER * 0.85, 'FD');
}

function goal(doc: jsPDF, cx: number, edgeY: number, facing: 'up' | 'down') {
  const c = DRILL_COLORS.pitch;
  doc.setDrawColor(c[0], c[1], c[2]);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.5);
  const top = facing === 'up' ? edgeY - GOAL_D : edgeY;
  doc.rect(cx - GOAL_W / 2, top, GOAL_W, GOAL_D, 'FD');
}

function ballStack(doc: jsPDF, cx: number, cy: number, count = 4) {
  const r = 0.75;
  const gap = 2.1;
  const w = count * gap + 1.6;
  const c = DRILL_COLORS.pitch;
  doc.setDrawColor(c[0], c[1], c[2]);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.rect(cx - w / 2, cy - 1.7, w, 3.4, 'FD');
  doc.setFillColor(DRILL_COLORS.ball[0], DRILL_COLORS.ball[1], DRILL_COLORS.ball[2]);
  doc.setDrawColor(120, 130, 145);
  doc.setLineWidth(0.15);
  for (let i = 0; i < count; i++) {
    doc.circle(cx - w / 2 + 1.6 + i * gap, cy, r, 'FD');
  }
}

function gridPositions(area: Box, n: number): { x: number; y: number }[] {
  if (n <= 0) return [];
  const cols = Math.min(3, Math.max(1, Math.round(Math.sqrt(n))));
  const rows = Math.ceil(n / cols);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inRow = Math.min(cols, n - r * cols);
    out.push({
      x: area.x + (area.w * (c + 0.5)) / inRow,
      y: area.y + (area.h * (r + 0.5)) / rows,
    });
  }
  return out;
}

function spread(from: number, to: number, n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [(from + to) / 2];
  const step = (to - from) / (n + 1);
  return Array.from({ length: n }, (_, i) => from + step * (i + 1));
}

export function drawDrillDiagram(doc: jsPDF, spec: DrillSpec, box: Box): void {
  const padTop = 4.5;
  const padRight = 8;
  const padOther = 5;
  const availW = box.w - padOther - padRight;
  const availH = box.h - padTop - padOther;
  if (availW <= 10 || availH <= 10) return;

  const ratio = spec.length / Math.max(1, spec.width);
  let pw = availW;
  let ph = pw / ratio;
  if (ph > availH) { ph = availH; pw = ph * ratio; }
  // Very long, thin areas would otherwise collapse to an unreadable sliver.
  ph = Math.max(ph, Math.min(availH, 22));

  const px = box.x + padOther + (availW - pw) / 2;
  const py = box.y + padTop + (availH - ph) / 2;
  const pc = DRILL_COLORS.pitch;
  doc.setDrawColor(pc[0], pc[1], pc[2]);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.6);
  doc.rect(px, py, pw, ph, 'FD');

  const unit = spec.unit === 'steps' ? ' Schritte' : ' m';
  doc.setFontSize(6.5);
  doc.setTextColor(DRILL_COLORS.muted[0], DRILL_COLORS.muted[1], DRILL_COLORS.muted[2]);
  doc.text(`${spec.length}${unit}`, px + 1.5, py - 1.2);
  doc.text(`${spec.width}${unit}`, px + pw + 2.4, py + ph / 2, { angle: 270 });

  const keeperSpots: { x: number; y: number }[] = [];
  if (spec.goals === 'two') {
    goal(doc, px + pw / 2, py, 'up');
    goal(doc, px + pw / 2, py + ph, 'down');
    keeperSpots.push({ x: px + pw / 2, y: py + 3.2 }, { x: px + pw / 2, y: py + ph - 3.2 });
  } else if (spec.goals === 'one') {
    goal(doc, px + pw / 2, py, 'up');
    keeperSpots.push({ x: px + pw / 2, y: py + 3.2 });
  } else if (spec.goals === 'fourMini') {
    [0.28, 0.72].forEach(f => {
      goal(doc, px + pw * f, py, 'up');
      goal(doc, px + pw * f, py + ph, 'down');
    });
  }

  const inset = 5.5;
  const inner: Box = {
    x: px + inset,
    y: py + inset,
    w: Math.max(4, pw - inset * 2),
    h: Math.max(4, ph - inset * 2),
  };

  if (spec.kind === 'lineDrill' || spec.kind === 'finishing') {
    // A queue lines up on the bottom edge, working towards the goal.
    const xs = spread(px, px + pw, Math.max(1, spec.teamA));
    xs.forEach(x => marker(doc, x, py + ph - inset * 0.8, DRILL_COLORS.teamA));
    if (spec.teamB > 0) {
      spread(px, px + pw, spec.teamB).forEach(x => marker(doc, x, py + ph / 2, DRILL_COLORS.teamB));
    }
  } else {
    // Adjacent pairs, the way a printed plan shows who marks whom.
    const pairs = Math.max(spec.teamA, spec.teamB);
    const spots = gridPositions(inner, pairs);
    const offset = spec.teamA > 0 && spec.teamB > 0 ? 1.7 : 0;
    spots.forEach((p, i) => {
      if (i < spec.teamA) marker(doc, p.x - offset, p.y, DRILL_COLORS.teamA);
      if (i < spec.teamB) marker(doc, p.x + offset, p.y, DRILL_COLORS.teamB);
    });
  }

  if (spec.neutrals > 0) {
    const onTop = Math.ceil(spec.neutrals / 2);
    const onSides = spec.neutrals - onTop;
    spread(px, px + pw, onTop).forEach(x => marker(doc, x, py - 3, DRILL_COLORS.neutral));
    if (onSides >= 1) marker(doc, px - 3, py + ph / 2, DRILL_COLORS.neutral);
    if (onSides >= 2) marker(doc, px + pw + 3, py + ph / 2, DRILL_COLORS.neutral);
    if (onSides > 2) {
      spread(px, px + pw, onSides - 2).forEach(x => marker(doc, x, py + ph + 3, DRILL_COLORS.neutral));
    }
  }

  if (spec.wallPlayers > 0) {
    const top = Math.ceil(spec.wallPlayers / 2);
    spread(px, px + pw, top).forEach(x => marker(doc, x, py - 3, DRILL_COLORS.wall));
    spread(px, px + pw, spec.wallPlayers - top).forEach(x => marker(doc, x, py + ph + 3, DRILL_COLORS.wall));
  }

  keeperSpots.slice(0, spec.keepers).forEach(p => marker(doc, p.x, p.y, DRILL_COLORS.keeper));

  if (spec.ballStacks >= 1) ballStack(doc, px + pw / 2, py + ph + (spec.wallPlayers ? 7.5 : 4));
  if (spec.ballStacks >= 2) ballStack(doc, px + pw / 2, py - (spec.neutrals || spec.wallPlayers ? 7.5 : 4));
}

export interface DiagramLegendLabels {
  cone: string; player: string; ball: string;
  run: string; dribble: string; pass: string; shot: string;
}

function legendArrow(doc: jsPDF, x: number, y: number, kind: 'run' | 'dribble' | 'pass' | 'shot') {
  const ink = DRILL_COLORS.ink;
  doc.setDrawColor(ink[0], ink[1], ink[2]);
  doc.setFillColor(ink[0], ink[1], ink[2]);
  doc.setLineWidth(kind === 'shot' ? 0.7 : 0.4);
  if (kind === 'run') doc.setLineDashPattern([1.2, 0.8], 0);
  else if (kind === 'dribble') doc.setLineDashPattern([0.3, 0.7], 0);
  else doc.setLineDashPattern([], 0);
  doc.line(x, y, x + 6.5, y);
  doc.setLineDashPattern([], 0);
  doc.triangle(x + 6.2, y - 1, x + 8, y, x + 6.2, y + 1, 'F');
  if (kind === 'shot') doc.circle(x + 0.4, y, 0.6, 'F');
}

export function drawDiagramLegend(doc: jsPDF, x: number, y: number, labels: DiagramLegendLabels): number {
  const ink = DRILL_COLORS.ink;
  const ROW = 4.2;
  doc.setFontSize(6.5);
  const rows: { label: string; draw: (ry: number) => void }[] = [
    { label: labels.cone, draw: ry => marker(doc, x + 4, ry, DRILL_COLORS.teamA) },
    { label: labels.player, draw: ry => { doc.setFillColor(47, 128, 237); doc.setDrawColor(ink[0], ink[1], ink[2]); doc.setLineWidth(0.2); doc.circle(x + 4, ry, 1.6, 'FD'); } },
    { label: labels.ball, draw: ry => { doc.setFillColor(255, 255, 255); doc.setDrawColor(ink[0], ink[1], ink[2]); doc.setLineWidth(0.25); doc.circle(x + 4, ry, 0.9, 'FD'); } },
    { label: labels.run, draw: ry => legendArrow(doc, x, ry, 'run') },
    { label: labels.dribble, draw: ry => legendArrow(doc, x, ry, 'dribble') },
    { label: labels.pass, draw: ry => legendArrow(doc, x, ry, 'pass') },
    { label: labels.shot, draw: ry => legendArrow(doc, x, ry, 'shot') },
  ];
  rows.forEach((row, i) => {
    const ry = y + i * ROW;
    row.draw(ry);
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text(row.label, x + 10, ry + 1.2);
  });
  return rows.length * ROW;
}
