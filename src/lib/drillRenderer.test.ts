import { describe, it, expect } from 'vitest';
import jsPDF from 'jspdf';
import { drawDrillDiagram, drawDiagramLegend } from './drillRenderer';
import { deriveDrillSpec } from './drillDiagram';
import type { DrillSpec } from './drillDiagram';
import type { Exercise } from '../types/models';

const exercise = (over: Partial<Exercise>): Exercise => ({
  id: 'e1', name: '', category: '', intensity: 'Medium', description: '', setup: '',
  variations: '', coachingPoints: '', goalkeepers: 0, equipment: [],
  linkedBasics: [], linkedPrinciples: [], linkedTactics: [], isCustom: false,
  ...over,
});

const page = () => new jsPDF({ orientation: 'landscape' });
const CARD = { x: 74, y: 8, w: 105, h: 94 };

describe('drawDrillDiagram', () => {
  it('draws every drill kind without throwing', () => {
    const doc = page();
    const categories = ['Technique', 'Passing', 'Warmup', 'Athletic', 'GameForm', 'Tactical', 'Finishing', 'SetPiece', ''];
    for (const category of categories) {
      const spec = deriveDrillSpec(exercise({ name: '5v5', category }));
      expect(() => drawDrillDiagram(doc, spec, CARD)).not.toThrow();
    }
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
  });

  it('draws the roles from the reference plan', () => {
    const doc = page();
    const specs = [
      deriveDrillSpec(exercise({ name: '6vs6+3N mit Aufladen', setup: '50x20 Schritte' })),
      deriveDrillSpec(exercise({ name: '5vs5+4WaSp', setup: '40x35 Schritte' })),
      deriveDrillSpec(exercise({ name: '3x3-Fussball', setup: '25x20 Schritte' })),
      deriveDrillSpec(exercise({ name: 'Transition (6v6+GK)', setup: '40x30m', equipment: ['Goals'] })),
    ];
    for (const spec of specs) {
      expect(() => drawDrillDiagram(doc, spec, CARD)).not.toThrow();
    }
  });

  it('survives degenerate specs', () => {
    const doc = page();
    const base = deriveDrillSpec(exercise({}));
    const odd: DrillSpec[] = [
      { ...base, teamA: 0, teamB: 0, neutrals: 0, wallPlayers: 0, keepers: 0, goals: 'none', ballStacks: 0 },
      { ...base, teamA: 11, teamB: 11, neutrals: 6, wallPlayers: 6, keepers: 2, goals: 'fourMini' },
      { ...base, length: 110, width: 4 },   // extreme aspect ratio
      { ...base, length: 6, width: 75 },
    ];
    for (const spec of odd) {
      expect(() => drawDrillDiagram(doc, spec, CARD)).not.toThrow();
    }
  });

  it('bails out quietly when the box is too small to draw in', () => {
    const doc = page();
    const spec = deriveDrillSpec(exercise({}));
    expect(() => drawDrillDiagram(doc, spec, { x: 10, y: 10, w: 8, h: 8 })).not.toThrow();
  });
});

describe('drawDiagramLegend', () => {
  it('draws every symbol row and returns the height it consumed', () => {
    const doc = page();
    const used = drawDiagramLegend(doc, 10, 10, {
      cone: 'Cone', player: 'Player', ball: 'Ball',
      run: 'Run', dribble: 'Dribble', pass: 'Pass', shot: 'Shot',
    });
    expect(used).toBeGreaterThan(20);
    expect(used).toBeLessThan(40);
  });
});
