import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { STORAGE_KEYS } from './storageKeys';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getStoredUserRole(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    if (!raw) return 'coach';
    const parsed = JSON.parse(raw);
    return typeof parsed?.role === 'string' ? parsed.role : 'coach';
  } catch {
    return 'coach';
  }
}
