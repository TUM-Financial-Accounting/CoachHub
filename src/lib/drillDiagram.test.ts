import { describe, it, expect } from 'vitest';
import { deriveDrillSpec, describeDrillSpec } from './drillDiagram';
import type { Exercise } from '../types/models';

const exercise = (over: Partial<Exercise>): Exercise => ({
  id: 'e1', name: '', category: '', intensity: 'Medium', description: '', setup: '',
  variations: '', coachingPoints: '', goalkeepers: 0, equipment: [],
  linkedBasics: [], linkedPrinciples: [], linkedTactics: [], isCustom: false,
  ...over,
});

describe('deriveDrillSpec — matchups', () => {
  it('reads "4v2" out of a title', () => {
    const s = deriveDrillSpec(exercise({ name: '4v2 Rondo (Possession)', category: 'Passing' }));
    expect(s.teamA).toBe(4);
    expect(s.teamB).toBe(2);
  });

  it('reads the "vs" and "gegen" spellings', () => {
    expect(deriveDrillSpec(exercise({ name: '6vs6 Spielform' })).teamB).toBe(6);
    expect(deriveDrillSpec(exercise({ name: '5 gegen 5 auf Tore' })).teamA).toBe(5);
  });

  it('reads "3x3-Fussball" but never mistakes "10x10m" for a matchup', () => {
    const cross = deriveDrillSpec(exercise({ name: '3x3-Fussball Mit Aufladen' }));
    expect([cross.teamA, cross.teamB]).toEqual([3, 3]);

    // The grid default is 4v2; the 10x10 must land on the pitch, not the teams.
    const grid = deriveDrillSpec(exercise({
      name: 'Rondo', category: 'Passing', setup: '10x10m grid. 4 cones to mark corners.',
    }));
    expect(grid.length).toBe(10);
    expect(grid.width).toBe(10);
    expect([grid.teamA, grid.teamB]).toEqual([4, 2]);
  });
});

describe('deriveDrillSpec — extra roles', () => {
  it('counts neutrals from "+3N"', () => {
    expect(deriveDrillSpec(exercise({ name: '6vs6+3N mit Aufladen' })).neutrals).toBe(3);
  });

  it('counts wall players from "+4WaSp"', () => {
    const s = deriveDrillSpec(exercise({ name: '5vs5+4WaSp' }));
    expect(s.wallPlayers).toBe(4);
    expect(s.teamA).toBe(5);
  });

  it('counts keepers from the title and from the goalkeepers field', () => {
    expect(deriveDrillSpec(exercise({ name: 'Transition (6v6+GK)' })).keepers).toBe(1);
    expect(deriveDrillSpec(exercise({ name: '6v6', goalkeepers: 2 })).keepers).toBe(2);
    expect(deriveDrillSpec(exercise({ setup: 'Full goals both ends. Two GKs.' })).keepers).toBe(2);
  });

  it('never returns more than two keepers', () => {
    expect(deriveDrillSpec(exercise({ name: 'Shooting', goalkeepers: 5 })).keepers).toBe(2);
  });
});

describe('deriveDrillSpec — pitch dimensions', () => {
  it('reads metres from the setup', () => {
    const s = deriveDrillSpec(exercise({ setup: '40x30m pitch. Full goals both ends.' }));
    expect(s.length).toBe(40);
    expect(s.width).toBe(30);
    expect(s.unit).toBe('m');
  });

  it('reads a pair of "Schritte" measurements', () => {
    const s = deriveDrillSpec(exercise({ setup: '50 Schritte lang, 20 Schritte breit' }));
    expect(s.length).toBe(50);
    expect(s.width).toBe(20);
    expect(s.unit).toBe('steps');
  });

  it('always reports the long side as length', () => {
    const s = deriveDrillSpec(exercise({ setup: '20x45m channel' }));
    expect(s.length).toBe(45);
    expect(s.width).toBe(20);
  });
});

describe('deriveDrillSpec — goals', () => {
  it('draws two goals when the equipment lists goals', () => {
    expect(deriveDrillSpec(exercise({ category: 'GameForm', equipment: ['Goals', 'Balls'] })).goals).toBe('two');
  });

  it('draws one goal for a finishing drill with a single goal', () => {
    expect(deriveDrillSpec(exercise({ category: 'Finishing', equipment: ['Goal', 'Balls'] })).goals).toBe('one');
  });

  it('gives a rondo no goals at all', () => {
    expect(deriveDrillSpec(exercise({ category: 'Passing', equipment: ['Cones', 'Bibs'] })).goals).toBe('none');
  });

  it('adds goals when two keepers are present regardless of the text', () => {
    expect(deriveDrillSpec(exercise({ category: 'Passing', goalkeepers: 2 })).goals).toBe('two');
  });
});

describe('deriveDrillSpec — fallbacks', () => {
  it('picks a layout from the category when the text says nothing', () => {
    expect(deriveDrillSpec(exercise({ category: 'Warmup' })).kind).toBe('lineDrill');
    expect(deriveDrillSpec(exercise({ category: 'Finishing' })).kind).toBe('finishing');
    expect(deriveDrillSpec(exercise({ category: 'SetPiece' })).kind).toBe('setPiece');
    expect(deriveDrillSpec(exercise({ category: '' })).kind).toBe('smallSided');
  });

  it('flags a spec that rests entirely on defaults', () => {
    expect(deriveDrillSpec(exercise({ name: 'Passing pattern', category: 'Passing' })).inferred).toBe(true);
    expect(deriveDrillSpec(exercise({ name: '4v2 Rondo', category: 'Passing' })).inferred).toBe(false);
  });

  it('survives a completely empty exercise', () => {
    const s = deriveDrillSpec(exercise({}));
    expect(s.length).toBeGreaterThan(0);
    expect(s.width).toBeGreaterThan(0);
    expect(s.teamA).toBeGreaterThanOrEqual(0);
  });

  it('clamps absurd numbers to something drawable', () => {
    const s = deriveDrillSpec(exercise({ name: '99v99', setup: '500x400m' }));
    expect(s.teamA).toBeLessThanOrEqual(11);
    expect(s.length).toBeLessThanOrEqual(110);
    expect(s.width).toBeLessThanOrEqual(75);
  });
});

describe('describeDrillSpec', () => {
  it('summarises the format for the card caption', () => {
    const s = deriveDrillSpec(exercise({ name: '6vs6+3N', setup: '50x20 Schritte', goalkeepers: 2 }));
    expect(describeDrillSpec(s)).toBe('6v6 +3N +2TW · 50x20');
  });

  it('appends the metre unit when the pitch is in metres', () => {
    const s = deriveDrillSpec(exercise({ name: '4v2 Rondo', category: 'Passing', setup: '10x10m grid' }));
    expect(describeDrillSpec(s)).toBe('4v2 · 10x10m');
  });
});
