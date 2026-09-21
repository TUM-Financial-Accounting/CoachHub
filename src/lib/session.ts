import { SESSION_KEYS } from './storageKeys';
import { saveLastSelection } from './lastSelection';
import { clearAdminUnlock } from './adminUnlock';

export function clearSession(): void {
  // Must run first: it reads the user and selection keys cleared below.
  saveLastSelection();
  try {
    SESSION_KEYS.forEach(key => localStorage.removeItem(key));
  } catch {
    // Storage denied; there is nothing left to clear.
  }
  clearAdminUnlock();
}
