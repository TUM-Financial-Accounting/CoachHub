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
