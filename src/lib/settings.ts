// Account-scoped key, so logout needn't clear it. Theme and language are owned by ThemeContext and i18next.

import { Page } from '../types/ui';
import { STORAGE_KEYS } from './storageKeys';

export type WeekStart = 'monday' | 'sunday';

export const START_PAGES = ['dashboard', 'calendar', 'team', 'session-planner', 'statistics'] as const;
export type StartPage = Extract<Page, (typeof START_PAGES)[number]>;

export interface AppSettings {
  showBirthdays: boolean;
  showTrainings: boolean;
  showMatches: boolean;
  showEvents: boolean;
  weekStartsOn: WeekStart;
  dayStartHour: number;
  dayEndHour: number;
  startPage: StartPage;
}

export const DEFAULT_SETTINGS: AppSettings = {
  showBirthdays: true,
  showTrainings: true,
  showMatches: true,
  showEvents: true,
  weekStartsOn: 'monday',
  dayStartHour: 7,
  dayEndHour: 22,
  startPage: 'dashboard',
};

const KEY_PREFIX = 'settings:';

const accountKey = (): string => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    const email: string = raw ? JSON.parse(raw)?.email || '' : '';
    return KEY_PREFIX + (email.trim().toLowerCase() || 'anonymous');
  } catch {
    return KEY_PREFIX + 'anonymous';
  }
};

const clampHour = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof value === 'number' ? Math.round(value) : NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

// Values come from localStorage and may be stale or hand-edited, so every field is re-validated.
function normalise(raw: Partial<AppSettings>): AppSettings {
  const dayStartHour = clampHour(raw.dayStartHour, 0, 23, DEFAULT_SETTINGS.dayStartHour);
  let dayEndHour = clampHour(raw.dayEndHour, 1, 24, DEFAULT_SETTINGS.dayEndHour);
  if (dayEndHour <= dayStartHour) dayEndHour = Math.min(24, dayStartHour + 1);

  return {
    showBirthdays: raw.showBirthdays !== false,
    showTrainings: raw.showTrainings !== false,
    showMatches: raw.showMatches !== false,
    showEvents: raw.showEvents !== false,
    weekStartsOn: raw.weekStartsOn === 'sunday' ? 'sunday' : 'monday',
    dayStartHour,
    dayEndHour,
    startPage: (START_PAGES as readonly string[]).includes(raw.startPage as string)
      ? (raw.startPage as StartPage)
      : DEFAULT_SETTINGS.startPage,
  };
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(accountKey());
    if (!raw) return { ...DEFAULT_SETTINGS };
    return normalise(JSON.parse(raw) as Partial<AppSettings>);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(accountKey(), JSON.stringify(settings));
  } catch {
  }
}

export function weekStartOf(input: Date, weekStartsOn: WeekStart): Date {
  const d = new Date(input);
  const offset = weekStartsOn === 'sunday' ? d.getDay() : (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}
