import { PositionSlot } from '../types/models';

export const DEFAULT_FORMATION = '4-4-2';

// Digits sum to the outfield players, so 11v11, 9v9 and 7v7 names never collide.
export const FORMATION_GROUPS = [
  { labelKey: 'matches.fourDefenders',  formations: ['4-4-2', '4-3-3', '4-2-3-1', '4-3-2-1', '4-1-4-1', '4-1-2-1-2', '4-4-2 DM'] },
  { labelKey: 'matches.threeDefenders', formations: ['3-5-2', '3-4-3', '3-4-1-2'] },
  { labelKey: 'matches.fiveDefenders',  formations: ['5-3-2', '5-4-1'] },
  { labelKey: 'matches.nineASide',      formations: ['3-2-3', '3-3-2', '2-3-3', '4-3-1'] },
  { labelKey: 'matches.sevenASide',     formations: ['2-3-1', '3-2-1', '3-1-2', '2-2-2'] },
] as const;

export const ALL_FORMATIONS: readonly string[] = FORMATION_GROUPS.flatMap(g => g.formations);

export const FORMATIONS: Record<string, PositionSlot[]> = {
  '4-4-2': [
    { id: 'gk', position: 'GK', x: 50, y: 90 },
    { id: 'lb', position: 'LB', x: 15, y: 72 }, { id: 'lcb', position: 'CB', x: 38, y: 76 }, { id: 'rcb', position: 'CB', x: 62, y: 76 }, { id: 'rb', position: 'RB', x: 85, y: 72 },
    { id: 'lm', position: 'LM', x: 12, y: 48 }, { id: 'lcm', position: 'CM', x: 37, y: 52 }, { id: 'rcm', position: 'CM', x: 63, y: 52 }, { id: 'rm', position: 'RM', x: 88, y: 48 },
    { id: 'lst', position: 'ST', x: 35, y: 20 }, { id: 'rst', position: 'ST', x: 65, y: 20 },
  ],
  '4-3-3': [
    { id: 'gk', position: 'GK', x: 50, y: 90 },
    { id: 'lb', position: 'LB', x: 15, y: 72 }, { id: 'lcb', position: 'CB', x: 38, y: 76 }, { id: 'rcb', position: 'CB', x: 62, y: 76 }, { id: 'rb', position: 'RB', x: 85, y: 72 },
    { id: 'lcm', position: 'CM', x: 25, y: 56 }, { id: 'cdm', position: 'CM', x: 50, y: 60 }, { id: 'rcm', position: 'CM', x: 75, y: 56 },
    { id: 'lw', position: 'LW', x: 15, y: 25 }, { id: 'st', position: 'ST', x: 50, y: 15 }, { id: 'rw', position: 'RW', x: 85, y: 25 },
  ],
  '4-2-3-1': [
    { id: 'gk', position: 'GK', x: 50, y: 90 },
    { id: 'lb', position: 'LB', x: 15, y: 72 }, { id: 'lcb', position: 'CB', x: 38, y: 76 }, { id: 'rcb', position: 'CB', x: 62, y: 76 }, { id: 'rb', position: 'RB', x: 85, y: 72 },
    { id: 'lcdm', position: 'CDM', x: 35, y: 60 }, { id: 'rcdm', position: 'CDM', x: 65, y: 60 },
    { id: 'lam', position: 'LAM', x: 18, y: 40 }, { id: 'cam', position: 'CAM', x: 50, y: 38 }, { id: 'ram', position: 'RAM', x: 82, y: 40 },
    { id: 'st', position: 'ST', x: 50, y: 18 },
  ],
  '4-3-2-1': [
    { id: 'gk', position: 'GK', x: 50, y: 90 },
    { id: 'lb', position: 'LB', x: 15, y: 72 }, { id: 'lcb', position: 'CB', x: 38, y: 76 }, { id: 'rcb', position: 'CB', x: 62, y: 76 }, { id: 'rb', position: 'RB', x: 85, y: 72 },
    { id: 'lcm', position: 'CM', x: 25, y: 58 }, { id: 'cm', position: 'CM', x: 50, y: 62 }, { id: 'rcm', position: 'CM', x: 75, y: 58 },
    { id: 'lam', position: 'AM', x: 35, y: 38 }, { id: 'ram', position: 'AM', x: 65, y: 38 },
    { id: 'st', position: 'ST', x: 50, y: 18 },
  ],
  '4-1-4-1': [
    { id: 'gk', position: 'GK', x: 50, y: 90 },
    { id: 'lb', position: 'LB', x: 15, y: 72 }, { id: 'lcb', position: 'CB', x: 38, y: 76 }, { id: 'rcb', position: 'CB', x: 62, y: 76 }, { id: 'rb', position: 'RB', x: 85, y: 72 },
    { id: 'cdm', position: 'CDM', x: 50, y: 62 },
    { id: 'lm', position: 'LM', x: 12, y: 46 }, { id: 'lcm', position: 'CM', x: 35, y: 50 }, { id: 'rcm', position: 'CM', x: 65, y: 50 }, { id: 'rm', position: 'RM', x: 88, y: 46 },
    { id: 'st', position: 'ST', x: 50, y: 18 },
  ],
  '4-1-2-1-2': [
    { id: 'gk', position: 'GK', x: 50, y: 90 },
    { id: 'lb', position: 'LB', x: 15, y: 72 }, { id: 'lcb', position: 'CB', x: 38, y: 76 }, { id: 'rcb', position: 'CB', x: 62, y: 76 }, { id: 'rb', position: 'RB', x: 85, y: 72 },
    { id: 'cdm', position: 'CDM', x: 50, y: 62 },
    { id: 'lcm', position: 'CM', x: 32, y: 50 }, { id: 'rcm', position: 'CM', x: 68, y: 50 },
    { id: 'cam', position: 'CAM', x: 50, y: 37 },
    { id: 'lst', position: 'ST', x: 35, y: 20 }, { id: 'rst', position: 'ST', x: 65, y: 20 },
  ],
  '4-4-2 DM': [
    { id: 'gk', position: 'GK', x: 50, y: 90 },
    { id: 'lb', position: 'LB', x: 15, y: 72 }, { id: 'lcb', position: 'CB', x: 38, y: 76 }, { id: 'rcb', position: 'CB', x: 62, y: 76 }, { id: 'rb', position: 'RB', x: 85, y: 72 },
    { id: 'cdm', position: 'CDM', x: 50, y: 60 },
    { id: 'lm', position: 'LM', x: 15, y: 46 }, { id: 'rcm', position: 'CM', x: 72, y: 50 },
    { id: 'cam', position: 'CAM', x: 50, y: 36 },
    { id: 'lst', position: 'ST', x: 35, y: 20 }, { id: 'rst', position: 'ST', x: 65, y: 20 },
  ],
  '3-5-2': [
    { id: 'gk', position: 'GK', x: 50, y: 90 },
    { id: 'lcb', position: 'CB', x: 25, y: 76 }, { id: 'cb', position: 'CB', x: 50, y: 80 }, { id: 'rcb', position: 'CB', x: 75, y: 76 },
    { id: 'lwb', position: 'LWB', x: 8, y: 52 }, { id: 'lcm', position: 'CM', x: 32, y: 56 }, { id: 'cdm', position: 'CDM', x: 50, y: 62 }, { id: 'rcm', position: 'CM', x: 68, y: 56 }, { id: 'rwb', position: 'RWB', x: 92, y: 52 },
    { id: 'lst', position: 'ST', x: 38, y: 20 }, { id: 'rst', position: 'ST', x: 62, y: 20 },
  ],
  '3-4-3': [
    { id: 'gk', position: 'GK', x: 50, y: 90 },
    { id: 'lcb', position: 'CB', x: 25, y: 76 }, { id: 'cb', position: 'CB', x: 50, y: 80 }, { id: 'rcb', position: 'CB', x: 75, y: 76 },
    { id: 'lm', position: 'LM', x: 12, y: 54 }, { id: 'lcm', position: 'CM', x: 35, y: 58 }, { id: 'rcm', position: 'CM', x: 65, y: 58 }, { id: 'rm', position: 'RM', x: 88, y: 54 },
    { id: 'lw', position: 'LW', x: 18, y: 22 }, { id: 'st', position: 'ST', x: 50, y: 15 }, { id: 'rw', position: 'RW', x: 82, y: 22 },
  ],
  '3-4-1-2': [
    { id: 'gk', position: 'GK', x: 50, y: 90 },
    { id: 'lcb', position: 'CB', x: 22, y: 76 }, { id: 'cb', position: 'CB', x: 50, y: 80 }, { id: 'rcb', position: 'CB', x: 78, y: 76 },
    { id: 'lm', position: 'LM', x: 12, y: 56 }, { id: 'lcm', position: 'CM', x: 35, y: 60 }, { id: 'rcm', position: 'CM', x: 65, y: 60 }, { id: 'rm', position: 'RM', x: 88, y: 56 },
    { id: 'cam', position: 'CAM', x: 50, y: 40 },
    { id: 'lst', position: 'ST', x: 35, y: 20 }, { id: 'rst', position: 'ST', x: 65, y: 20 },
  ],
  '5-3-2': [
    { id: 'gk', position: 'GK', x: 50, y: 90 },
    { id: 'lwb', position: 'LWB', x: 8, y: 68 }, { id: 'lcb', position: 'CB', x: 28, y: 76 }, { id: 'cb', position: 'CB', x: 50, y: 80 }, { id: 'rcb', position: 'CB', x: 72, y: 76 }, { id: 'rwb', position: 'RWB', x: 92, y: 68 },
    { id: 'lcm', position: 'CM', x: 28, y: 52 }, { id: 'cm', position: 'CM', x: 50, y: 56 }, { id: 'rcm', position: 'CM', x: 72, y: 52 },
    { id: 'lst', position: 'ST', x: 38, y: 20 }, { id: 'rst', position: 'ST', x: 62, y: 20 },
  ],
  '5-4-1': [
    { id: 'gk', position: 'GK', x: 50, y: 90 },
    { id: 'lwb', position: 'LWB', x: 8, y: 68 }, { id: 'lcb', position: 'CB', x: 28, y: 76 }, { id: 'cb', position: 'CB', x: 50, y: 80 }, { id: 'rcb', position: 'CB', x: 72, y: 76 }, { id: 'rwb', position: 'RWB', x: 92, y: 68 },
    { id: 'lm', position: 'LM', x: 12, y: 48 }, { id: 'lcm', position: 'CM', x: 35, y: 52 }, { id: 'rcm', position: 'CM', x: 65, y: 52 }, { id: 'rm', position: 'RM', x: 88, y: 48 },
    { id: 'st', position: 'ST', x: 50, y: 18 },
  ],
  // --- 9v9 youth formats (GK + 8 outfield) ---
  '3-2-3': [
    { id: 'gk', position: 'GK', x: 50, y: 90 },
    { id: 'lcb', position: 'CB', x: 22, y: 74 }, { id: 'cb', position: 'CB', x: 50, y: 78 }, { id: 'rcb', position: 'CB', x: 78, y: 74 },
    { id: 'lcm', position: 'CM', x: 35, y: 52 }, { id: 'rcm', position: 'CM', x: 65, y: 52 },
    { id: 'lw', position: 'LW', x: 20, y: 26 }, { id: 'st', position: 'ST', x: 50, y: 20 }, { id: 'rw', position: 'RW', x: 80, y: 26 },
  ],
  '3-3-2': [
    { id: 'gk', position: 'GK', x: 50, y: 90 },
    { id: 'lcb', position: 'CB', x: 22, y: 74 }, { id: 'cb', position: 'CB', x: 50, y: 78 }, { id: 'rcb', position: 'CB', x: 78, y: 74 },
    { id: 'lm', position: 'LM', x: 20, y: 50 }, { id: 'cm', position: 'CM', x: 50, y: 54 }, { id: 'rm', position: 'RM', x: 80, y: 50 },
    { id: 'lst', position: 'ST', x: 38, y: 22 }, { id: 'rst', position: 'ST', x: 62, y: 22 },
  ],
  '2-3-3': [
    { id: 'gk', position: 'GK', x: 50, y: 90 },
    { id: 'lcb', position: 'CB', x: 35, y: 76 }, { id: 'rcb', position: 'CB', x: 65, y: 76 },
    { id: 'lm', position: 'LM', x: 20, y: 52 }, { id: 'cm', position: 'CM', x: 50, y: 56 }, { id: 'rm', position: 'RM', x: 80, y: 52 },
    { id: 'lw', position: 'LW', x: 20, y: 26 }, { id: 'st', position: 'ST', x: 50, y: 20 }, { id: 'rw', position: 'RW', x: 80, y: 26 },
  ],
  '4-3-1': [
    { id: 'gk', position: 'GK', x: 50, y: 90 },
    { id: 'lb', position: 'LB', x: 15, y: 72 }, { id: 'lcb', position: 'CB', x: 38, y: 76 }, { id: 'rcb', position: 'CB', x: 62, y: 76 }, { id: 'rb', position: 'RB', x: 85, y: 72 },
    { id: 'lcm', position: 'CM', x: 28, y: 50 }, { id: 'cm', position: 'CM', x: 50, y: 54 }, { id: 'rcm', position: 'CM', x: 72, y: 50 },
    { id: 'st', position: 'ST', x: 50, y: 22 },
  ],
  // --- 7v7 youth formats (GK + 6 outfield) ---
  '2-3-1': [
    { id: 'gk', position: 'GK', x: 50, y: 90 },
    { id: 'lcb', position: 'CB', x: 35, y: 72 }, { id: 'rcb', position: 'CB', x: 65, y: 72 },
    { id: 'lm', position: 'LM', x: 20, y: 48 }, { id: 'cm', position: 'CM', x: 50, y: 52 }, { id: 'rm', position: 'RM', x: 80, y: 48 },
    { id: 'st', position: 'ST', x: 50, y: 22 },
  ],
  '3-2-1': [
    { id: 'gk', position: 'GK', x: 50, y: 90 },
    { id: 'lcb', position: 'CB', x: 25, y: 72 }, { id: 'cb', position: 'CB', x: 50, y: 76 }, { id: 'rcb', position: 'CB', x: 75, y: 72 },
    { id: 'lcm', position: 'CM', x: 35, y: 48 }, { id: 'rcm', position: 'CM', x: 65, y: 48 },
    { id: 'st', position: 'ST', x: 50, y: 22 },
  ],
  '3-1-2': [
    { id: 'gk', position: 'GK', x: 50, y: 90 },
    { id: 'lcb', position: 'CB', x: 25, y: 72 }, { id: 'cb', position: 'CB', x: 50, y: 76 }, { id: 'rcb', position: 'CB', x: 75, y: 72 },
    { id: 'cm', position: 'CM', x: 50, y: 50 },
    { id: 'lst', position: 'ST', x: 35, y: 24 }, { id: 'rst', position: 'ST', x: 65, y: 24 },
  ],
  '2-2-2': [
    { id: 'gk', position: 'GK', x: 50, y: 90 },
    { id: 'lcb', position: 'CB', x: 35, y: 74 }, { id: 'rcb', position: 'CB', x: 65, y: 74 },
    { id: 'lcm', position: 'CM', x: 35, y: 50 }, { id: 'rcm', position: 'CM', x: 65, y: 50 },
    { id: 'lst', position: 'ST', x: 35, y: 24 }, { id: 'rst', position: 'ST', x: 65, y: 24 },
  ],
};
