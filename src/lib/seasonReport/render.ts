import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Award, MatchResult, PlayerLine, SeasonReport } from './build';
import { GOAL_BUCKETS } from './build';
import { formatDate, parseLocalDate } from '../dates';

export type Translate = (key: string, options?: Record<string, unknown>) => string;

type RGB = [number, number, number];
const C: Record<string, RGB> = {
  ink: [15, 23, 42],
  text: [51, 65, 85],
  muted: [100, 116, 139],
  faint: [148, 163, 184],
  line: [226, 232, 240],
  panel: [241, 245, 249],
  brand: [37, 99, 235],
  brandSoft: [219, 234, 254],
  navy: [15, 23, 42],
  navyTile: [30, 41, 59],
  win: [16, 185, 129],
  draw: [245, 158, 11],
  loss: [244, 63, 94],
  white: [255, 255, 255],
};

const PAGE = { w: 210, h: 297, m: 14 };
const CW = PAGE.w - 2 * PAGE.m;
const BOTTOM = PAGE.h - 16;

interface Ctx { doc: jsPDF; t: Translate; lang: string; r: SeasonReport; y: number }

// --- primitives ---
const fill = (doc: jsPDF, c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
const stroke = (doc: jsPDF, c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
const ink = (doc: jsPDF, c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

function write(doc: jsPDF, s: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: RGB; align?: 'left' | 'center' | 'right' } = {}) {
  doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
  doc.setFontSize(o.size ?? 9);
  ink(doc, o.color ?? C.text);
  doc.text(s, x, y, { align: o.align ?? 'left' });
}

function fit(doc: jsPDF, s: string, maxW: number): string {
  if (doc.getTextWidth(s) <= maxW) return s;
  let out = s;
  while (out.length > 1 && doc.getTextWidth(`${out}...`) > maxW) out = out.slice(0, -1);
  return `${out.trimEnd()}...`;
}

const resultColor = (r: MatchResult): RGB => (r === 'W' ? C.win : r === 'D' ? C.draw : C.loss);
const pct = (v: number | null) => (v === null ? '-' : `${v}%`);
const outOf10 = (v: number | null) => (v === null ? '-' : `${v}/10`);
const avgRating = (p: PlayerLine) => (p.avgRating === null ? '-' : `${p.avgRating.toFixed(1)} (${p.ratedMatches})`);
const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);
const minuteMark = (m: number | null) => (m === null ? '' : ` ${m}'`);

function newPage(ctx: Ctx) {
  ctx.doc.addPage();
  ctx.y = PAGE.m + 4;
}

function ensure(ctx: Ctx, needed: number) {
  if (ctx.y + needed > BOTTOM) newPage(ctx);
}

function section(ctx: Ctx, title: string, note?: string) {
  ensure(ctx, 24);
  const { doc } = ctx;
  fill(doc, C.brand);
  doc.rect(PAGE.m, ctx.y - 4.6, 1.3, 6, 'F');
  write(doc, title, PAGE.m + 4, ctx.y, { size: 13, bold: true, color: C.ink });
  if (note) write(doc, note, PAGE.m + CW, ctx.y, { size: 7.5, color: C.muted, align: 'right' });
  ctx.y += 7;
}

function subTitle(ctx: Ctx, title: string, x = PAGE.m, y = ctx.y) {
  ctx.doc.setCharSpace(0.4);
  write(ctx.doc, title.toUpperCase(), x, y, { size: 7, bold: true, color: C.muted });
  ctx.doc.setCharSpace(0);
}

function kpiGrid(ctx: Ctx, items: { label: string; value: string; color?: RGB }[], cols: number, h = 16) {
  const { doc } = ctx;
  const gap = 2.5;
  const w = (CW - gap * (cols - 1)) / cols;
  const rows = Math.ceil(items.length / cols);
  ensure(ctx, rows * (h + gap));
  items.forEach((it, i) => {
    const x = PAGE.m + (i % cols) * (w + gap);
    const y = ctx.y + Math.floor(i / cols) * (h + gap);
    fill(doc, C.panel);
    doc.roundedRect(x, y, w, h, 1.5, 1.5, 'F');
    write(doc, it.value, x + 3, y + 8, { size: 13, bold: true, color: it.color ?? C.ink });
    let size = 6.8;
    doc.setFont('helvetica', 'normal');
    while (size > 5.6 && (doc.setFontSize(size), doc.getTextWidth(it.label)) > w - 6) size -= 0.2;
    doc.setFontSize(size);
    write(doc, fit(doc, it.label, w - 6), x + 3, y + h - 3, { size, color: C.muted });
  });
  ctx.y += rows * (h + gap) + 2;
}

function formStrip(doc: jsPDF, results: MatchResult[], x: number, y: number, t: Translate, size = 6.4) {
  results.forEach((r, i) => {
    const cx = x + i * (size + 1.2);
    fill(doc, resultColor(r));
    doc.roundedRect(cx, y, size, size, 1, 1, 'F');
    write(doc, t(`seasonReport.result.${r}`), cx + size / 2, y + size / 2 + 1.3, { size: 7, bold: true, color: C.white, align: 'center' });
  });
}

// --- charts ---
interface Box { x: number; y: number; w: number; h: number }

function gridY(doc: jsPDF, box: Box, max: number, steps = 4) {
  doc.setLineWidth(0.15);
  for (let i = 0; i <= steps; i++) {
    const y = box.y + box.h - (box.h * i) / steps;
    stroke(doc, i === 0 ? C.faint : C.line);
    doc.line(box.x, y, box.x + box.w, y);
    const v = (max * i) / steps;
    write(doc, Number.isInteger(v) ? String(v) : v.toFixed(1), box.x - 1.5, y + 1, { size: 6, color: C.faint, align: 'right' });
  }
}

const niceMax = (v: number) => {
  if (v <= 4) return 4;
  const step = v <= 20 ? 4 : v <= 40 ? 8 : 20;
  return Math.ceil(v / step) * step;
};

function lineChart(doc: jsPDF, box: Box, series: { values: number[]; color: RGB; dashed?: boolean }[], labels: string[], scale?: { max: number; steps: number }) {
  const max = scale?.max ?? niceMax(Math.max(1, ...series.flatMap(s => s.values)));
  gridY(doc, box, max, scale?.steps);
  const n = labels.length;
  const xAt = (i: number) => box.x + (n === 1 ? box.w / 2 : (box.w * i) / (n - 1));
  const yAt = (v: number) => box.y + box.h - (box.h * v) / max;
  for (const s of series) {
    stroke(doc, s.color);
    doc.setLineWidth(s.dashed ? 0.3 : 0.7);
    if (s.dashed) doc.setLineDashPattern([1, 1], 0);
    for (let i = 1; i < s.values.length; i++) doc.line(xAt(i - 1), yAt(s.values[i - 1]), xAt(i), yAt(s.values[i]));
    doc.setLineDashPattern([], 0);
    if (!s.dashed) {
      fill(doc, s.color);
      s.values.forEach((v, i) => doc.circle(xAt(i), yAt(v), 0.9, 'F'));
    }
  }
  const every = Math.max(1, Math.ceil(n / 10));
  labels.forEach((l, i) => { if (i % every === 0 || i === n - 1) write(doc, l, xAt(i), box.y + box.h + 4, { size: 5.8, color: C.muted, align: 'center' }); });
}

function pairedBars(doc: jsPDF, box: Box, rows: { label: string; a: number; b: number }[]) {
  const max = niceMax(Math.max(1, ...rows.flatMap(r => [r.a, r.b])));
  gridY(doc, box, max);
  const slot = box.w / Math.max(rows.length, 1);
  const bw = Math.min(4, slot * 0.34);
  const every = Math.max(1, Math.ceil(rows.length / 10));
  rows.forEach((r, i) => {
    const cx = box.x + slot * i + slot / 2;
    const hA = (box.h * r.a) / max;
    const hB = (box.h * r.b) / max;
    fill(doc, C.win);
    if (hA > 0) doc.rect(cx - bw - 0.3, box.y + box.h - hA, bw, hA, 'F');
    fill(doc, C.loss);
    if (hB > 0) doc.rect(cx + 0.3, box.y + box.h - hB, bw, hB, 'F');
    if (i % every === 0) write(doc, r.label, cx, box.y + box.h + 4, { size: 5.8, color: C.muted, align: 'center' });
  });
}

function hBars(doc: jsPDF, box: Box, rows: { label: string; value: number; display?: string }[], color: RGB, labelW = 34) {
  if (!rows.length) return;
  const max = Math.max(1, ...rows.map(r => r.value));
  const rowH = Math.min(7, box.h / rows.length);
  const barW = box.w - labelW - 12;
  rows.forEach((r, i) => {
    const y = box.y + i * rowH;
    write(doc, fit(doc, r.label, labelW - 2), box.x, y + rowH / 2 + 1.2, { size: 7.2, color: C.text });
    fill(doc, C.panel);
    doc.roundedRect(box.x + labelW, y + rowH * 0.22, barW, rowH * 0.56, 0.8, 0.8, 'F');
    const w = (barW * r.value) / max;
    if (w > 0) {
      fill(doc, color);
      doc.roundedRect(box.x + labelW, y + rowH * 0.22, Math.max(w, 1.2), rowH * 0.56, 0.8, 0.8, 'F');
    }
    write(doc, r.display ?? String(r.value), box.x + labelW + barW + 2, y + rowH / 2 + 1.2, { size: 7.2, bold: true, color: C.ink });
  });
}

function vBars(doc: jsPDF, box: Box, rows: { label: string; value: number }[], color: RGB) {
  const max = niceMax(Math.max(1, ...rows.map(r => r.value)));
  gridY(doc, box, max);
  const slot = box.w / rows.length;
  const bw = slot * 0.55;
  rows.forEach((r, i) => {
    const x = box.x + slot * i + (slot - bw) / 2;
    const h = (box.h * r.value) / max;
    fill(doc, color);
    if (h > 0) doc.rect(x, box.y + box.h - h, bw, h, 'F');
    if (r.value > 0) write(doc, String(r.value), x + bw / 2, box.y + box.h - h - 1.2, { size: 6.5, bold: true, color: C.ink, align: 'center' });
    write(doc, r.label, x + bw / 2, box.y + box.h + 4, { size: 6, color: C.muted, align: 'center' });
  });
}

function legend(doc: jsPDF, x: number, y: number, items: { label: string; color: RGB; dashed?: boolean }[]) {
  let cx = x;
  for (const it of items) {
    if (it.dashed) {
      stroke(doc, it.color);
      doc.setLineWidth(0.3);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(cx, y - 1, cx + 4, y - 1);
      doc.setLineDashPattern([], 0);
    } else {
      fill(doc, it.color);
      doc.roundedRect(cx, y - 2.2, 3, 2.4, 0.5, 0.5, 'F');
    }
    write(doc, it.label, cx + 5, y, { size: 6.8, color: C.muted });
    cx += 7 + doc.getTextWidth(it.label) + 4;
  }
}

function table(ctx: Ctx, head: string[], body: (string | number)[][], opts: Record<string, any> = {}) {
  autoTable(ctx.doc, {
    startY: ctx.y,
    head: [head],
    body,
    theme: 'plain',
    margin: { left: PAGE.m, right: PAGE.m, bottom: 18 },
    styles: { font: 'helvetica', fontSize: 7.4, cellPadding: { top: 1.6, bottom: 1.6, left: 1.8, right: 1.8 }, textColor: C.text, overflow: 'linebreak' },
    headStyles: { fillColor: C.ink, textColor: C.white, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    ...opts,
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 7;
}

// --- labels ---
const playerName = (ctx: Ctx, p: { name: string }) => p.name || ctx.t('seasonReport.unknownPlayer');
const position = (ctx: Ctx, pos: string) => (pos ? ctx.t(`positions.${pos}`, { defaultValue: pos }) : '-');
const monthLabel = (ctx: Ctx, ym: string) => parseLocalDate(`${ym}-15`).toLocaleDateString(ctx.lang, { month: 'short', year: 'numeric' });
const shortDate = (ctx: Ctx, iso: string) => parseLocalDate(iso).toLocaleDateString(ctx.lang, { day: 'numeric', month: 'numeric' });

function awardValue(ctx: Ctx, kind: string, a: Award) {
  if (kind === 'bestAttendance') return `${a.value}%`;
  if (kind === 'highestRated') return `${a.value}/10`;
  if (kind === 'mostMotm') return ctx.t('seasonReport.unit.mostMotm', { count: a.value });
  return ctx.t(`seasonReport.unit.${kind}`, { count: a.value });
}

// --- pages ---
function cover(ctx: Ctx) {
  const { doc, t, r } = ctx;
  fill(doc, C.navy);
  doc.rect(0, 0, PAGE.w, 112, 'F');
  fill(doc, C.brand);
  doc.rect(0, 112, PAGE.w, 1.4, 'F');

  doc.setCharSpace(1.2);
  write(doc, 'COACHHUB', PAGE.m, 20, { size: 8, bold: true, color: [147, 197, 253] });
  write(doc, t('seasonReport.title').toUpperCase(), PAGE.m, 28, { size: 9, bold: true, color: C.faint });
  doc.setCharSpace(0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  const teamLines = doc.splitTextToSize(r.teamName || '-', CW).slice(0, 2);
  ink(doc, C.white);
  doc.text(teamLines, PAGE.m, 46);
  const afterTeam = 46 + (teamLines.length - 1) * 11;
  write(doc, r.seasonName || '', PAGE.m, afterTeam + 10, { size: 15, color: [203, 213, 225] });

  const meta = [
    r.period ? `${t('seasonReport.period')}: ${formatDate(r.period.from)} - ${formatDate(r.period.to)}` : null,
    r.coachName ? `${t('seasonReport.coach')}: ${r.coachName}` : null,
  ].filter(Boolean).join('   |   ');
  write(doc, meta, PAGE.m, afterTeam + 18, { size: 8.5, color: C.faint });

  const tiles = [
    { value: String(r.record.points), label: t('seasonReport.kpi.points') },
    { value: `${r.record.won}-${r.record.drawn}-${r.record.lost}`, label: t('seasonReport.kpi.record') },
    { value: `${r.record.goalsFor}:${r.record.goalsAgainst}`, label: t('seasonReport.kpi.goals') },
    { value: String(r.record.played), label: t('seasonReport.kpi.played') },
  ];
  const tw = (CW - 3 * 3) / 4;
  tiles.forEach((tile, i) => {
    const x = PAGE.m + i * (tw + 3);
    fill(doc, C.navyTile);
    doc.roundedRect(x, 82, tw, 22, 2, 2, 'F');
    write(doc, tile.value, x + 4, 94, { size: 16, bold: true, color: C.white });
    write(doc, tile.label, x + 4, 100.5, { size: 7, color: C.faint });
  });

  ctx.y = 126;
  section(ctx, t('seasonReport.sections.glance'));
  kpiGrid(ctx, [
    { label: t('seasonReport.kpi.ppg'), value: r.record.ppg.toFixed(1) },
    { label: t('seasonReport.kpi.winRate'), value: `${r.record.winRate}%` },
    { label: t('seasonReport.kpi.goalDiff'), value: signed(r.record.goalDiff), color: r.record.goalDiff >= 0 ? C.win : C.loss },
    { label: t('seasonReport.kpi.cleanSheets'), value: String(r.record.cleanSheets) },
    { label: t('seasonReport.kpi.sessions'), value: String(r.training.completed) },
    { label: t('seasonReport.kpi.avgAttendance'), value: pct(r.training.avgAttendance) },
    { label: t('seasonReport.kpi.squadSize'), value: String(r.squad.size) },
    { label: t('seasonReport.kpi.upcoming'), value: String(r.upcomingMatches) },
  ], 4);

  section(ctx, t('seasonReport.sections.awards'));
  const kinds = ['topScorer', 'topAssister', 'mostContributions', 'mostStarts', 'bestAttendance', 'highestRated', 'mostMotm'] as const;
  const gap = 3;
  const cols = 4;
  const aw = (CW - (cols - 1) * gap) / cols;
  const ah = 21;
  kinds.forEach((kind, i) => {
    const a = r.awards[kind];
    const x = PAGE.m + (i % cols) * (aw + gap);
    const y = ctx.y + Math.floor(i / cols) * (ah + gap);
    stroke(doc, C.line);
    doc.setLineWidth(0.3);
    fill(doc, C.white);
    doc.roundedRect(x, y, aw, ah, 1.8, 1.8, 'FD');
    fill(doc, C.brand);
    doc.rect(x, y + 3, 0.9, ah - 6, 'F');
    write(doc, fit(doc, t(`seasonReport.award.${kind}`).toUpperCase(), aw - 6), x + 4, y + 5.8, { size: 6.2, bold: true, color: C.muted });
    write(doc, a ? fit(doc, a.name, aw - 8) : '-', x + 4, y + 12.5, { size: 10.5, bold: true, color: C.ink });
    if (a) write(doc, awardValue(ctx, kind, a), x + 4, y + 18, { size: 8, bold: true, color: C.brand });
  });
  ctx.y += Math.ceil(kinds.length / cols) * (ah + gap) + 4;

  if (r.highlights.form.length) {
    subTitle(ctx, t('seasonReport.sections.form'));
    const all = r.matches.map(m => m.result).slice(-24);
    formStrip(doc, all, PAGE.m, ctx.y + 2.5, t);
    ctx.y += 14;
  }
  write(doc, t('seasonReport.generatedOn', { date: formatDate(r.generatedOn) }), PAGE.m, BOTTOM + 4, { size: 7, color: C.faint });
}

function overview(ctx: Ctx) {
  const { doc, t, r } = ctx;
  newPage(ctx);
  section(ctx, t('seasonReport.sections.overview'));
  const rec = r.record;
  kpiGrid(ctx, [
    { label: t('seasonReport.kpi.played'), value: String(rec.played) },
    { label: t('seasonReport.kpi.won'), value: String(rec.won), color: C.win },
    { label: t('seasonReport.kpi.drawn'), value: String(rec.drawn), color: C.draw },
    { label: t('seasonReport.kpi.lost'), value: String(rec.lost), color: C.loss },
    { label: t('seasonReport.kpi.goalsFor'), value: String(rec.goalsFor) },
    { label: t('seasonReport.kpi.goalsAgainst'), value: String(rec.goalsAgainst) },
    { label: t('seasonReport.kpi.goalDiff'), value: signed(rec.goalDiff), color: rec.goalDiff >= 0 ? C.win : C.loss },
    { label: t('seasonReport.kpi.points'), value: String(rec.points) },
    { label: t('seasonReport.kpi.avgFor'), value: rec.avgFor.toFixed(1) },
    { label: t('seasonReport.kpi.avgAgainst'), value: rec.avgAgainst.toFixed(1) },
    { label: t('seasonReport.kpi.cleanSheets'), value: String(rec.cleanSheets) },
    { label: t('seasonReport.kpi.failedToScore'), value: String(rec.failedToScore) },
  ], 6);

  if (!r.matches.length) {
    write(doc, t('seasonReport.noMatches'), PAGE.m, ctx.y + 4, { size: 9, color: C.muted });
    ctx.y += 12;
    return;
  }

  const labels = r.pointsProgression.map(p => shortDate(ctx, p.date));
  ensure(ctx, 62);
  subTitle(ctx, t('seasonReport.sections.pointsProgression'));
  legend(doc, PAGE.m + CW - 70, ctx.y, [
    { label: t('seasonReport.chart.points'), color: C.brand },
    { label: t('seasonReport.chart.maxPoints'), color: C.faint, dashed: true },
  ]);
  lineChart(doc, { x: PAGE.m + 8, y: ctx.y + 5, w: CW - 10, h: 42 }, [
    { values: r.pointsProgression.map((_, i) => (i + 1) * 3), color: C.faint, dashed: true },
    { values: r.pointsProgression.map(p => p.points), color: C.brand },
  ], labels);
  ctx.y += 58;

  ensure(ctx, 62);
  subTitle(ctx, t('seasonReport.sections.goalsPerMatch'));
  legend(doc, PAGE.m + CW - 70, ctx.y, [
    { label: t('seasonReport.chart.scored'), color: C.win },
    { label: t('seasonReport.chart.conceded'), color: C.loss },
  ]);
  pairedBars(doc, { x: PAGE.m + 8, y: ctx.y + 5, w: CW - 10, h: 40 }, r.matches.map(m => ({ label: shortDate(ctx, m.date), a: m.goalsFor, b: m.goalsAgainst })));
  ctx.y += 56;

  ensure(ctx, 36);
  subTitle(ctx, t('seasonReport.sections.highlights'));
  ctx.y += 3;
  const h = r.highlights;
  const matchLine = (m: typeof h.biggestWin) => (m ? `${m.goalsFor}:${m.goalsAgainst} vs ${m.opponent} (${formatDate(m.date)})` : '-');
  const items = [
    [t('seasonReport.highlight.biggestWin'), matchLine(h.biggestWin)],
    [t('seasonReport.highlight.heaviestDefeat'), matchLine(h.heaviestDefeat)],
    [t('seasonReport.highlight.longestUnbeaten'), t('seasonReport.unit.matches', { count: h.longestUnbeaten })],
    [t('seasonReport.highlight.longestWinning'), t('seasonReport.unit.matches', { count: h.longestWinning })],
  ];
  const colW = CW / 2;
  items.forEach(([label, value], i) => {
    const x = PAGE.m + (i % 2) * colW;
    const y = ctx.y + Math.floor(i / 2) * 11;
    write(doc, label, x, y, { size: 7, color: C.muted });
    write(doc, fit(doc, value, colW - 4), x, y + 5, { size: 9.5, bold: true, color: C.ink });
  });
  ctx.y += 26;
}

function results(ctx: Ctx) {
  const { t, r } = ctx;
  if (!r.matches.length) return;
  newPage(ctx);
  section(ctx, t('seasonReport.sections.results'), t('seasonReport.unit.matches', { count: r.matches.length }));
  const names = (list: { name: string; minute: number | null }[]) =>
    list.map(g => `${(g.name.split(' ').pop() || g.name) || t('seasonReport.unknownPlayer')}${minuteMark(g.minute)}`).join(', ') || '-';
  table(ctx,
    [t('seasonReport.col.date'), t('seasonReport.col.opponent'), t('seasonReport.col.venue'), t('seasonReport.col.score'), '', t('seasonReport.col.formation'), t('seasonReport.col.scorers'), t('seasonReport.col.assists'), t('seasonReport.col.mvp')],
    r.matches.map(m => [
      formatDate(m.date), m.opponent, m.location || '-', `${m.goalsFor}:${m.goalsAgainst}`, t(`seasonReport.result.${m.result}`), m.formation || '-',
      names(m.scorers), names(m.assists),
      m.mvp.length ? `${names(m.mvp.map(v => ({ name: v.name, minute: null })))} (${m.mvp[0].rating})` : '-',
    ]),
    {
      columnStyles: {
        0: { cellWidth: 17 }, 1: { cellWidth: 28, fontStyle: 'bold', textColor: C.ink }, 2: { cellWidth: 17 },
        3: { cellWidth: 12, halign: 'center', fontStyle: 'bold' }, 4: { cellWidth: 7, halign: 'center', fontStyle: 'bold' },
        5: { cellWidth: 15 }, 6: { cellWidth: 'auto' }, 7: { cellWidth: 28 }, 8: { cellWidth: 26 },
      },
      didParseCell: (d: any) => {
        if (d.section === 'body' && d.column.index === 4) {
          d.cell.styles.fillColor = resultColor(r.matches[d.row.index].result);
          d.cell.styles.textColor = C.white;
        }
      },
    });
}

function squadTable(ctx: Ctx) {
  const { doc, t, r } = ctx;
  newPage(ctx);
  section(ctx, t('seasonReport.sections.squad'), t('seasonReport.unit.players', { count: r.players.length }));
  table(ctx,
    ['#', t('seasonReport.col.player'), t('seasonReport.col.position'), t('seasonReport.col.age'), t('seasonReport.col.starts'), t('seasonReport.col.goals'), t('seasonReport.col.assists'), t('seasonReport.col.contributions'), t('seasonReport.col.share'), t('seasonReport.col.minutes'), t('seasonReport.col.attendance'), t('seasonReport.col.matchRating'), t('seasonReport.col.rating')],
    r.players.map(p => [
      p.jersey ?? '-',
      `${playerName(ctx, p)}${p.inSquad ? '' : ' *'}`,
      position(ctx, p.position),
      p.age ?? '-',
      p.starts,
      p.goals,
      p.assists,
      p.contributions,
      pct(p.goalShare),
      p.minutes ? `${p.minutes}'` : '-',
      pct(p.attendance.rate),
      avgRating(p),
      outOf10(p.rating),
    ]),
    {
      columnStyles: {
        0: { cellWidth: 8, halign: 'center', fontStyle: 'bold' }, 1: { cellWidth: 'auto', fontStyle: 'bold', textColor: C.ink },
        2: { cellWidth: 18 }, 3: { cellWidth: 10, halign: 'center' }, 4: { cellWidth: 11, halign: 'center' },
        5: { cellWidth: 11, halign: 'center' }, 6: { cellWidth: 11, halign: 'center' }, 7: { cellWidth: 11, halign: 'center', fontStyle: 'bold' },
        8: { cellWidth: 12, halign: 'center' }, 9: { cellWidth: 12, halign: 'center' }, 10: { cellWidth: 13, halign: 'center' },
        11: { cellWidth: 15, halign: 'center', fontStyle: 'bold' }, 12: { cellWidth: 12, halign: 'center' },
      },
    });
  ctx.y -= 3;
  const notes = [t('seasonReport.note.starts'), t('seasonReport.note.share'), t('seasonReport.note.minutes'),
    t('seasonReport.note.attendanceRecorded', { count: r.training.recordedSessions, total: r.training.completed }),
    t('seasonReport.note.rating'), t('seasonReport.note.mvp')];
  if (r.ratedMatches) notes.push(t('seasonReport.note.highestRated', { count: r.minRatedMatches }));
  if (r.players.some(p => !p.inSquad)) notes.push(t('seasonReport.note.former'));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  ink(doc, C.muted);
  const noteLines = doc.splitTextToSize(notes.join('   '), CW);
  ensure(ctx, noteLines.length * 3 + 4);
  doc.text(noteLines, PAGE.m, ctx.y);
  ctx.y += noteLines.length * 3 + 6;

  ensure(ctx, 52);
  section(ctx, t('seasonReport.sections.squadProfile'));
  const s = r.squad;
  kpiGrid(ctx, [
    { label: t('seasonReport.kpi.squadSize'), value: String(s.size) },
    { label: t('seasonReport.kpi.avgAge'), value: s.avgAge === null ? '-' : s.avgAge.toFixed(1) },
    { label: t('seasonReport.kpi.avgHeight'), value: s.avgHeight === null ? '-' : `${s.avgHeight} cm` },
    { label: t('seasonReport.kpi.unavailable'), value: String(s.unavailable), color: s.unavailable ? C.loss : C.ink },
  ], 4);
  const half = (CW - 8) / 2;
  ensure(ctx, 40);
  subTitle(ctx, t('seasonReport.sections.positions'));
  subTitle(ctx, t('seasonReport.sections.feet'), PAGE.m + half + 8);
  const posRows = s.positions.map(p => ({ label: position(ctx, p.label), value: p.count }));
  const footRows = s.feet.map(f => ({ label: t(`seasonReport.foot.${f.label}`, { defaultValue: f.label }), value: f.count }));
  hBars(doc, { x: PAGE.m, y: ctx.y + 2, w: half, h: posRows.length * 7 }, posRows, C.brand, 28);
  hBars(doc, { x: PAGE.m + half + 8, y: ctx.y + 2, w: half, h: footRows.length * 7 }, footRows, C.brand, 28);
  ctx.y += Math.max(posRows.length, footRows.length, 1) * 7 + 8;
}

function attack(ctx: Ctx) {
  const { doc, t, r } = ctx;
  newPage(ctx);
  section(ctx, t('seasonReport.sections.attack'));
  const half = (CW - 8) / 2;
  const scorers = [...r.players].filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 8);
  const assisters = [...r.players].filter(p => p.assists > 0).sort((a, b) => b.assists - a.assists || b.goals - a.goals).slice(0, 8);
  const rowsH = Math.max(scorers.length, assisters.length, 1) * 7;
  subTitle(ctx, t('seasonReport.sections.topScorers'));
  subTitle(ctx, t('seasonReport.sections.topAssists'), PAGE.m + half + 8);
  if (!scorers.length) write(doc, t('seasonReport.noGoals'), PAGE.m, ctx.y + 7, { size: 8, color: C.muted });
  hBars(doc, { x: PAGE.m, y: ctx.y + 2, w: half, h: scorers.length * 7 }, scorers.map(p => ({ label: playerName(ctx, p), value: p.goals })), C.win);
  hBars(doc, { x: PAGE.m + half + 8, y: ctx.y + 2, w: half, h: assisters.length * 7 }, assisters.map(p => ({ label: playerName(ctx, p), value: p.assists })), C.brand);
  ctx.y += rowsH + 10;

  ensure(ctx, 58);
  const tm = r.goalTiming;
  subTitle(ctx, t('seasonReport.sections.goalTiming'));
  write(doc, t('seasonReport.note.timing', { count: tm.withMinute, total: tm.recorded }), PAGE.m + CW, ctx.y, { size: 6.8, color: C.muted, align: 'right' });
  vBars(doc, { x: PAGE.m + 8, y: ctx.y + 6, w: CW - 10, h: 36 }, GOAL_BUCKETS.map((label, i) => ({ label: `${label}'`, value: tm.buckets[i] })), C.win);
  ctx.y += 52;

  if (r.formations.length) {
    ensure(ctx, 30);
    section(ctx, t('seasonReport.sections.formations'));
    table(ctx,
      [t('seasonReport.col.formation'), t('seasonReport.kpi.played'), t('seasonReport.kpi.won'), t('seasonReport.kpi.drawn'), t('seasonReport.kpi.lost'), t('seasonReport.kpi.ppg')],
      r.formations.map(f => [f.formation, f.played, f.won, f.drawn, f.lost, f.ppg.toFixed(1)]),
      { columnStyles: { 0: { fontStyle: 'bold', textColor: C.ink }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center', fontStyle: 'bold' } } });
  }

  if (r.months.length) {
    ensure(ctx, 30);
    section(ctx, t('seasonReport.sections.months'));
    table(ctx,
      [t('seasonReport.col.month'), t('seasonReport.kpi.played'), t('seasonReport.kpi.won'), t('seasonReport.kpi.drawn'), t('seasonReport.kpi.lost'), t('seasonReport.col.goals'), t('seasonReport.kpi.points'), t('seasonReport.kpi.sessions')],
      r.months.map(m => [monthLabel(ctx, m.month), m.played, m.won, m.drawn, m.lost, `${m.goalsFor}:${m.goalsAgainst}`, m.points, m.sessions]),
      { columnStyles: { 0: { fontStyle: 'bold', textColor: C.ink }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center', fontStyle: 'bold' }, 7: { halign: 'center' } } });
  }
}

function training(ctx: Ctx) {
  const { doc, t, r } = ctx;
  const tr = r.training;
  newPage(ctx);
  section(ctx, t('seasonReport.sections.training'));
  kpiGrid(ctx, [
    { label: t('seasonReport.kpi.sessions'), value: String(tr.completed) },
    { label: t('seasonReport.kpi.hours'), value: tr.hours.toFixed(1) },
    { label: t('seasonReport.kpi.avgDuration'), value: tr.avgMinutes ? `${tr.avgMinutes} min` : '-' },
    { label: t('seasonReport.kpi.avgAttendance'), value: pct(tr.avgAttendance) },
    { label: t('seasonReport.kpi.plannedSessions'), value: String(tr.planned) },
    { label: t('seasonReport.kpi.teamEvents'), value: String(r.teamEvents) },
  ], 6);
  if (!tr.completed) {
    write(doc, t('seasonReport.noSessions'), PAGE.m, ctx.y + 4, { size: 9, color: C.muted });
    ctx.y += 12;
    return;
  }

  subTitle(ctx, t('seasonReport.sections.intensity'));
  const total = tr.intensity.Low + tr.intensity.Medium + tr.intensity.High;
  const parts: { key: 'Low' | 'Medium' | 'High'; color: RGB; label: string }[] = [
    { key: 'Low', color: C.win, label: t('common.low') },
    { key: 'Medium', color: C.draw, label: t('common.medium') },
    { key: 'High', color: C.loss, label: t('common.high') },
  ];
  let x = PAGE.m;
  const by = ctx.y + 3;
  for (const p of parts) {
    const w = total ? (CW * tr.intensity[p.key]) / total : 0;
    if (w > 0) {
      fill(doc, p.color);
      doc.rect(x, by, w, 6, 'F');
      if (w > 12) write(doc, `${Math.round((tr.intensity[p.key] / total) * 100)}%`, x + w / 2, by + 4.2, { size: 7, bold: true, color: C.white, align: 'center' });
      x += w;
    }
  }
  legend(doc, PAGE.m, by + 12, parts.map(p => ({ label: `${p.label} (${tr.intensity[p.key]})`, color: p.color })));
  ctx.y = by + 20;

  const half = (CW - 8) / 2;
  ensure(ctx, 52);
  subTitle(ctx, t('seasonReport.sections.focus'));
  subTitle(ctx, t('seasonReport.sections.weekdays'), PAGE.m + half + 8);
  hBars(doc, { x: PAGE.m, y: ctx.y + 2, w: half, h: tr.topFocus.length * 7 }, tr.topFocus.map(f => ({ label: f.label, value: f.count })), C.brand, 32);
  const weekdayNames = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(ctx.lang, { weekday: 'short' }));
  vBars(doc, { x: PAGE.m + half + 14, y: ctx.y + 4, w: half - 6, h: 30 }, weekdayNames.map((label, i) => ({ label, value: tr.weekdays[i] })), C.brand);
  ctx.y += Math.max(tr.topFocus.length * 7, 36) + 10;

  if (tr.topExercises.length) {
    ensure(ctx, 30);
    section(ctx, t('seasonReport.sections.exercises'));
    table(ctx,
      [t('seasonReport.col.drill'), t('seasonReport.col.category'), t('seasonReport.col.uses')],
      tr.topExercises.map(e => [e.name, e.category ? t(`exerciseCategories.${e.category}`, { defaultValue: e.category }) : t('seasonReport.uncategorized'), e.count]),
      { columnStyles: { 0: { fontStyle: 'bold', textColor: C.ink }, 2: { cellWidth: 16, halign: 'center', fontStyle: 'bold' } } });
  }

  if (tr.categories.length) {
    ensure(ctx, tr.categories.length * 7 + 14);
    subTitle(ctx, t('seasonReport.sections.categories'));
    hBars(doc, { x: PAGE.m, y: ctx.y + 2, w: CW, h: tr.categories.length * 7 },
      tr.categories.map(c => ({ label: c.label ? t(`exerciseCategories.${c.label}`, { defaultValue: c.label }) : t('seasonReport.uncategorized'), value: c.count })), C.brand, 40);
    ctx.y += tr.categories.length * 7 + 8;
  }

  const ranked = r.players.filter(p => p.inSquad && p.attendance.rate !== null).sort((a, b) => (b.attendance.rate ?? 0) - (a.attendance.rate ?? 0));
  if (ranked.length) {
    ensure(ctx, 20 + ranked.length * 7);
    section(ctx, t('seasonReport.sections.attendance'), t('seasonReport.note.attendanceShort', { total: tr.completed }));
    hBars(doc, { x: PAGE.m, y: ctx.y, w: CW, h: ranked.length * 7 },
      ranked.map(p => ({ label: playerName(ctx, p), value: p.attendance.rate ?? 0, display: `${p.attendance.rate}%  (${p.attendance.attended}/${p.attendance.total})` })), C.win, 42);
    ctx.y += ranked.length * 7 + 6;
  }
}

const CARD_H = 124;
const CARD_STEP = 129;

function playerCard(ctx: Ctx, p: PlayerLine, top: number) {
  const { doc, t, r } = ctx;
  const h = CARD_H;
  stroke(doc, C.line);
  doc.setLineWidth(0.3);
  doc.roundedRect(PAGE.m, top, CW, h, 2.5, 2.5, 'S');
  fill(doc, C.panel);
  doc.roundedRect(PAGE.m, top, CW, 24, 2.5, 2.5, 'F');
  doc.rect(PAGE.m, top + 20, CW, 4, 'F');

  fill(doc, p.inSquad ? C.brand : C.faint);
  doc.circle(PAGE.m + 12, top + 12, 7, 'F');
  write(doc, p.jersey === null ? '-' : String(p.jersey), PAGE.m + 12, top + 14.3, { size: 12, bold: true, color: C.white, align: 'center' });
  write(doc, fit(doc, playerName(ctx, p), CW - 70), PAGE.m + 24, top + 11, { size: 14, bold: true, color: C.ink });
  const facts = [
    position(ctx, p.position),
    p.age !== null ? t('seasonReport.years', { count: p.age }) : null,
    p.strongFoot ? t(`seasonReport.foot.${p.strongFoot}`, { defaultValue: p.strongFoot }) : null,
    p.height ? `${p.height} cm` : null,
  ].filter(Boolean).join('  |  ');
  write(doc, facts, PAGE.m + 24, top + 17.5, { size: 8, color: C.muted });
  if (!p.inSquad || (p.status && p.status !== 'Active')) {
    const label = p.inSquad ? t(`status.${p.status}`, { defaultValue: p.status }) : t('seasonReport.formerPlayer');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    const w = doc.getTextWidth(label) + 6;
    fill(doc, p.inSquad ? C.loss : C.faint);
    doc.roundedRect(PAGE.m + CW - w - 5, top + 8, w, 6, 1.5, 1.5, 'F');
    write(doc, label, PAGE.m + CW - w / 2 - 5, top + 12.2, { size: 7, bold: true, color: C.white, align: 'center' });
  }

  const stats = [
    { label: t('seasonReport.col.starts'), value: p.subApps ? `${p.starts} (+${p.subApps})` : String(p.starts) },
    { label: t('seasonReport.col.minutes'), value: p.minutes ? String(p.minutes) : '-' },
    { label: t('seasonReport.col.goals'), value: String(p.goals), color: p.goals ? C.win : C.ink },
    { label: t('seasonReport.col.assists'), value: String(p.assists), color: p.assists ? C.brand : C.ink },
    { label: t('seasonReport.col.contributions'), value: String(p.contributions) },
    { label: t('seasonReport.col.attendance'), value: pct(p.attendance.rate) },
    { label: t('seasonReport.col.matchRating'), value: p.avgRating === null ? '-' : p.avgRating.toFixed(1) },
    { label: t('seasonReport.col.mvp'), value: String(p.motm), color: p.motm ? C.brand : C.ink },
  ];
  const gap = 2.5;
  const bw = (CW - 12 - gap * (stats.length - 1)) / stats.length;
  stats.forEach((s, i) => {
    const x = PAGE.m + 6 + i * (bw + gap);
    fill(doc, C.panel);
    doc.roundedRect(x, top + 29, bw, 16, 1.5, 1.5, 'F');
    write(doc, s.value, x + bw / 2, top + 37, { size: 13, bold: true, color: s.color ?? C.ink, align: 'center' });
    write(doc, fit(doc, s.label, bw - 2), x + bw / 2, top + 42.5, { size: 6.4, color: C.muted, align: 'center' });
  });

  let y = top + 53;
  if (p.inSquad && p.attendance.rate !== null) {
    write(doc, t('seasonReport.sections.attendance').toUpperCase(), PAGE.m + 6, y, { size: 6.5, bold: true, color: C.muted });
    const barX = PAGE.m + 6;
    const barW = CW - 12;
    fill(doc, C.panel);
    doc.roundedRect(barX, y + 2.5, barW, 4, 1, 1, 'F');
    fill(doc, C.win);
    if (p.attendance.rate > 0) doc.roundedRect(barX, y + 2.5, Math.max((barW * p.attendance.rate) / 100, 1.5), 4, 1, 1, 'F');
    if (r.training.avgAttendance !== null) {
      const ax = barX + (barW * r.training.avgAttendance) / 100;
      stroke(doc, C.ink);
      doc.setLineWidth(0.5);
      doc.line(ax, y + 1.5, ax, y + 7.5);
      write(doc, t('seasonReport.chart.teamAvg', { value: r.training.avgAttendance }), ax, y + 11, { size: 6.2, color: C.muted, align: ax > barX + barW - 20 ? 'right' : 'center' });
    }
    write(doc, `${p.attendance.attended}/${p.attendance.total} ${t('seasonReport.kpi.sessions')}`, barX + barW, y, { size: 6.5, color: C.muted, align: 'right' });
    y += 17;
  }

  if (p.ratingLog.length >= 2) {
    write(doc, t('seasonReport.sections.ratingTrend').toUpperCase(), PAGE.m + 6, y, { size: 6.5, bold: true, color: C.muted });
    lineChart(doc, { x: PAGE.m + 12, y: y + 3, w: CW - 20, h: 14 }, [{ values: p.ratingLog.map(l => l.rating), color: C.brand }],
      p.ratingLog.map(l => shortDate(ctx, l.date)), { max: 10, steps: 2 });
    y += 26;
  }

  write(doc, t('seasonReport.sections.contributions').toUpperCase(), PAGE.m + 6, y, { size: 6.5, bold: true, color: C.muted });
  if (p.goalShare !== null && p.goals > 0) write(doc, t('seasonReport.note.shareOfGoals', { value: p.goalShare }), PAGE.m + CW - 6, y, { size: 6.5, color: C.muted, align: 'right' });
  y += 4;
  if (!p.goalLog.length) {
    write(doc, t('seasonReport.noContributions'), PAGE.m + 6, y + 4, { size: 8, color: C.faint });
    return;
  }
  const maxRows = Math.max(1, Math.floor((top + h - 4 - y) / 5.2));
  const cols = p.goalLog.length > maxRows ? 2 : 1;
  const colW = (CW - 12) / cols;
  const visible = p.goalLog.slice(0, maxRows * cols);
  visible.forEach((g, i) => {
    const cx = PAGE.m + 6 + Math.floor(i / maxRows) * colW;
    const cy = y + (i % maxRows) * 5.2 + 3.5;
    fill(doc, g.kind === 'goal' ? C.win : C.brand);
    doc.circle(cx + 1.2, cy - 1, 1.1, 'F');
    const kind = t(`seasonReport.kind.${g.kind}`);
    const text = `${formatDate(g.date)}  vs ${g.opponent}${minuteMark(g.minute)}`;
    write(doc, fit(doc, text, colW - 26), cx + 4, cy, { size: 7.4, color: C.text });
    write(doc, kind, cx + colW - 4, cy, { size: 7, bold: true, color: g.kind === 'goal' ? C.win : C.brand, align: 'right' });
  });
  if (p.goalLog.length > visible.length) {
    write(doc, t('seasonReport.more', { count: p.goalLog.length - visible.length }), PAGE.m + CW - 6, top + h - 3, { size: 6.5, color: C.muted, align: 'right' });
  }
}

function profiles(ctx: Ctx) {
  const { t, r } = ctx;
  const list = r.players;
  for (let i = 0; i < list.length; i += 2) {
    newPage(ctx);
    if (i === 0) section(ctx, t('seasonReport.sections.players'));
    const top = i === 0 ? ctx.y : PAGE.m;
    playerCard(ctx, list[i], top);
    if (list[i + 1]) playerCard(ctx, list[i + 1], top + CARD_STEP);
  }
}

function footers(ctx: Ctx) {
  const { doc, t, r } = ctx;
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    stroke(doc, C.line);
    doc.setLineWidth(0.2);
    doc.line(PAGE.m, PAGE.h - 11, PAGE.m + CW, PAGE.h - 11);
    write(doc, fit(doc, `${r.teamName}  |  ${r.seasonName}  |  ${t('seasonReport.title')}`, CW - 30), PAGE.m, PAGE.h - 7, { size: 6.8, color: C.faint });
    write(doc, t('seasonReport.page', { page: i, total }), PAGE.m + CW, PAGE.h - 7, { size: 6.8, color: C.faint, align: 'right' });
  }
}

export function renderSeasonReport(report: SeasonReport, t: Translate, lang: string): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const ctx: Ctx = { doc, t, lang, r: report, y: PAGE.m };
  cover(ctx);
  overview(ctx);
  results(ctx);
  squadTable(ctx);
  attack(ctx);
  training(ctx);
  profiles(ctx);
  footers(ctx);
  return doc;
}

export const reportFileName = (r: SeasonReport) =>
  `Season_Report_${`${r.teamName}_${r.seasonName}`.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '')}.pdf`;
