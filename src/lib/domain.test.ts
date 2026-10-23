import { describe, it, expect } from 'vitest';
import { intensityMeta, statusStyle, perfStyle, phaseLabelKeys, emptyPlayer, emptyExercise, EQUIPMENT_OPTIONS, equipmentKey } from './domain';
import { ALL_FORMATIONS, FORMATIONS, DEFAULT_FORMATION } from './formations';

describe('intensityMeta', () => {
  it('falls back to Medium for unknown or missing values', () => {
    expect(intensityMeta('Extreme')).toBe(intensityMeta('Medium'));
    expect(intensityMeta(undefined)).toBe(intensityMeta('Medium'));
    expect(intensityMeta('toString')).toBe(intensityMeta('Medium'));
  });

  it('returns the matching label key', () => {
    expect(intensityMeta('High').labelKey).toBe('common.high');
  });
});

describe('statusStyle', () => {
  it('uses a neutral style for unknown statuses', () => {
    expect(statusStyle('Suspended')).toContain('slate');
    expect(statusStyle('Injured')).toContain('rose');
  });
});

describe('perfStyle', () => {
  it('switches colour at 4 and 7', () => {
    expect(perfStyle(3).bar).toContain('rose');
    expect(perfStyle(4).bar).toContain('amber');
    expect(perfStyle(7).bar).toContain('emerald');
  });
});

describe('phaseLabelKeys', () => {
  it('returns null for a phase it does not know', () => {
    expect(phaseLabelKeys('Counter Press')).toBeNull();
    expect(phaseLabelKeys('Set Pieces')?.longKey).toBe('phases.setPieces');
  });
});

describe('empty forms', () => {
  it('never share arrays between calls', () => {
    const a = emptyExercise();
    a.equipment.push('Balls');
    expect(emptyExercise().equipment).toEqual([]);
    expect(emptyPlayer()).not.toBe(emptyPlayer());
  });
});

describe('formations', () => {
  it('has coordinates for every formation the pickers offer', () => {
    for (const name of ALL_FORMATIONS) expect(FORMATIONS[name], name).toBeDefined();
    expect(Object.keys(FORMATIONS).sort()).toEqual([...ALL_FORMATIONS].sort());
    expect(ALL_FORMATIONS).toContain(DEFAULT_FORMATION);
  });
});

describe('equipmentKey', () => {
  it('maps every offered option and older hand-typed spellings to a translation key', () => {
    expect(EQUIPMENT_OPTIONS.map(equipmentKey).every(Boolean)).toBe(true);
    expect(['cones', ' Bibs ', 'balls'].map(equipmentKey)).toEqual(['cones', 'bibs', 'balls']);
  });

  it('leaves unknown equipment untranslated', () => {
    expect(equipmentKey('Tennis balls')).toBeNull();
  });
});
