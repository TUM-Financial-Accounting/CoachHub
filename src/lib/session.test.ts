import { describe, it, expect } from 'vitest';
import { clearSession } from './session';
import { SESSION_KEYS, STORAGE_KEYS } from './storageKeys';
import { saveAdminUnlock, getAdminToken } from './adminUnlock';

function signedIn() {
  localStorage.setItem(STORAGE_KEYS.isAuthenticated, 'true');
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify({ email: 'coach@club.de' }));
  localStorage.setItem(STORAGE_KEYS.accessToken, 'jwt-123');
  localStorage.setItem(STORAGE_KEYS.seasonsCache, '[]');
  localStorage.setItem(STORAGE_KEYS.teamsCache, '{}');
  localStorage.setItem(STORAGE_KEYS.activeSeasonId, 'season-1');
  localStorage.setItem(STORAGE_KEYS.activeTeamId, 'team-1');
}

describe('clearSession', () => {
  it('removes every account-scoped key', () => {
    signedIn();
    clearSession();
    for (const key of SESSION_KEYS) expect(localStorage.getItem(key)).toBeNull();
  });

  it('stashes the active season and team before clearing them', () => {
    signedIn();
    clearSession();
    expect(JSON.parse(localStorage.getItem('lastSelection:coach@club.de')!)).toEqual({
      seasonId: 'season-1',
      teamId: 'team-1',
    });
  });

  it('drops the admin unlock', () => {
    signedIn();
    saveAdminUnlock('admin-jwt', 30);
    clearSession();
    expect(getAdminToken()).toBeNull();
  });

  it('keeps per-browser preferences', () => {
    signedIn();
    localStorage.setItem(STORAGE_KEYS.theme, 'dark');
    localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, 'true');
    clearSession();
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEYS.sidebarCollapsed)).toBe('true');
  });
});
