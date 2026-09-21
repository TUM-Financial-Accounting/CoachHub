import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format an ISO date string (YYYY-MM-DD) to DD/MM/YYYY for display.
 * Works purely with string slicing to avoid timezone drift.
 */
export function formatDate(isoDate?: string | null): string {
  if (!isoDate || isoDate.length < 10) return '';
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}/${isoDate.slice(0, 4)}`;
}
export function getStoredUserRole(): string {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return 'coach';
    const parsed = JSON.parse(raw);
    return typeof parsed?.role === 'string' ? parsed.role : 'coach';
  } catch {
    return 'coach';
  }
}

// ISO-8601 week ("KW 29"): Monday start, week 1 holds the first Thursday.
export function isoWeekNumber(date: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  // The Thursday of this week decides which year the week belongs to.
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const firstThursday = new Date(d.getFullYear(), 0, 4, 12);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}
