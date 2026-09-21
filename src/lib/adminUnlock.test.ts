import { describe, it, expect, afterEach, vi } from 'vitest';
import { saveAdminUnlock, getAdminToken, clearAdminUnlock } from './adminUnlock';

afterEach(() => {
  vi.useRealTimers();
});

describe('adminUnlock', () => {
  it('hands back a token that was just stored', () => {
    saveAdminUnlock('tok-123', 30);
    expect(getAdminToken()).toBe('tok-123');
  });

  it('keeps the unlock out of localStorage so it cannot outlive the tab', () => {
    saveAdminUnlock('tok-123', 30);
    expect(localStorage.getItem('admin_token')).toBeNull();
    expect(sessionStorage.getItem('admin_token')).not.toBeNull();
  });

  it('drops the token once it has expired', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T10:00:00Z'));
    saveAdminUnlock('tok-123', 30);

    vi.setSystemTime(new Date('2026-08-27T10:20:00Z'));
    expect(getAdminToken()).toBe('tok-123');

    vi.setSystemTime(new Date('2026-08-27T10:40:00Z'));
    expect(getAdminToken()).toBeNull();
    expect(sessionStorage.getItem('admin_token')).toBeNull();
  });

  it('expires the local copy a minute before the server would', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T10:00:00Z'));
    saveAdminUnlock('tok-123', 30);

    // The server would still accept it, but we expire a minute early.
    vi.setSystemTime(new Date('2026-08-27T10:29:30Z'));
    expect(getAdminToken()).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(getAdminToken()).toBeNull();
  });

  it('ignores a malformed entry instead of throwing', () => {
    sessionStorage.setItem('admin_token', 'not-json');
    expect(getAdminToken()).toBeNull();

    sessionStorage.setItem('admin_token', JSON.stringify({ token: 'x' }));
    expect(getAdminToken()).toBeNull();
  });

  it('clears on demand', () => {
    saveAdminUnlock('tok-123', 30);
    clearAdminUnlock();
    expect(getAdminToken()).toBeNull();
  });
});
