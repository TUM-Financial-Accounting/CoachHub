import { STORAGE_KEYS } from './storageKeys';
// Remembers each user's last active season and team ("Altersklasse") across
// logout/login cycles.
//
// Logout intentionally clears the live `activeSeasonId` / `activeTeamId` keys
// so the next user on a shared browser never inherits the previous user's
// view. To still land the *same* user back where they left off, we stash the
// selection under a per-account key at logout and copy it back to the live
// keys when that account signs in again. The stash only holds opaque ids —
// stale ones (deleted season/team) are discarded by the context providers,
// which fall back to the first available entry.

const stashKey = (email: string) => `lastSelection:${email.trim().toLowerCase()}`;

/**
 * Snapshot the current selection for the currently signed-in user.
 * Reads the user's email from the `user` localStorage entry, so it must be
 * called BEFORE logout clears that entry. Safe no-op if anything is missing.
 */
export function saveLastSelection(): void {
  try {
    const rawUser = localStorage.getItem(STORAGE_KEYS.user);
    if (!rawUser) return;
    const email: string = JSON.parse(rawUser)?.email || '';
    if (!email) return;

    const seasonId = localStorage.getItem(STORAGE_KEYS.activeSeasonId);
    const teamId = localStorage.getItem(STORAGE_KEYS.activeTeamId);
    if (!seasonId && !teamId) return;

    localStorage.setItem(stashKey(email), JSON.stringify({ seasonId, teamId }));
  } catch {
    // Corrupt JSON or full storage — remembering the selection is best-effort.
  }
}

/**
 * Restore a previously stashed selection for `email` into the live keys.
 * Must run before the season/team context providers mount (they read the
 * live keys in their state initializers) and before the post-login prefetch.
 */
export function restoreLastSelection(email: string): void {
  try {
    const raw = localStorage.getItem(stashKey(email));
    if (!raw) return;
    const { seasonId, teamId } = JSON.parse(raw) as { seasonId?: string | null; teamId?: string | null };
    if (seasonId) localStorage.setItem(STORAGE_KEYS.activeSeasonId, seasonId);
    if (teamId) localStorage.setItem(STORAGE_KEYS.activeTeamId, teamId);
  } catch {
    // Ignore a corrupt stash — the providers will pick sensible defaults.
  }
}
