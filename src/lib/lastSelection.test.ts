import { describe, it, expect } from 'vitest';
import { saveLastSelection, restoreLastSelection } from './lastSelection';

const STASH = 'lastSelection:coach@club.de';

function signIn(email = 'coach@club.de') {
  localStorage.setItem('user', JSON.stringify({ email, full_name: 'Coach' }));
}

describe('saveLastSelection', () => {
  it('stashes the live selection under a per-account key', () => {
    signIn();
    localStorage.setItem('activeSeasonId', 'season-1');
    localStorage.setItem('activeTeamId', 'team-1');

    saveLastSelection();

    expect(JSON.parse(localStorage.getItem(STASH)!)).toEqual({
      seasonId: 'season-1',
      teamId: 'team-1',
    });
  });

  it('normalises the email so casing and whitespace map to one stash', () => {
    signIn('  Coach@Club.DE ');
    localStorage.setItem('activeSeasonId', 'season-1');

    saveLastSelection();

    expect(localStorage.getItem(STASH)).not.toBeNull();
  });

  it('is a no-op when nobody is signed in', () => {
    localStorage.setItem('activeSeasonId', 'season-1');
    saveLastSelection();
    expect(localStorage.getItem(STASH)).toBeNull();
  });

  it('is a no-op when the stored user has no email', () => {
    localStorage.setItem('user', JSON.stringify({ full_name: 'Coach' }));
    localStorage.setItem('activeSeasonId', 'season-1');
    saveLastSelection();
    expect(localStorage.getItem(STASH)).toBeNull();
  });

  it('writes nothing when there is no selection to remember', () => {
    signIn();
    saveLastSelection();
    expect(localStorage.getItem(STASH)).toBeNull();
  });

  it('still stashes when only one of the two ids is set', () => {
    signIn();
    localStorage.setItem('activeTeamId', 'team-1');
    saveLastSelection();
    expect(JSON.parse(localStorage.getItem(STASH)!)).toEqual({
      seasonId: null,
      teamId: 'team-1',
    });
  });

  it('swallows a corrupt user entry instead of throwing during logout', () => {
    localStorage.setItem('user', 'not json');
    localStorage.setItem('activeSeasonId', 'season-1');
    expect(() => saveLastSelection()).not.toThrow();
    expect(localStorage.getItem(STASH)).toBeNull();
  });
});

describe('restoreLastSelection', () => {
  it('copies a stashed selection back into the live keys', () => {
    localStorage.setItem(STASH, JSON.stringify({ seasonId: 'season-9', teamId: 'team-9' }));

    restoreLastSelection('coach@club.de');

    expect(localStorage.getItem('activeSeasonId')).toBe('season-9');
    expect(localStorage.getItem('activeTeamId')).toBe('team-9');
  });

  it('matches the stash regardless of how the email was typed at login', () => {
    localStorage.setItem(STASH, JSON.stringify({ seasonId: 'season-9', teamId: null }));

    restoreLastSelection(' COACH@club.de ');

    expect(localStorage.getItem('activeSeasonId')).toBe('season-9');
  });

  it('leaves the live keys untouched when the account has no stash', () => {
    restoreLastSelection('someone-else@club.de');
    expect(localStorage.getItem('activeSeasonId')).toBeNull();
    expect(localStorage.getItem('activeTeamId')).toBeNull();
  });

  it('does not clear a live key when the stashed counterpart is missing', () => {
    localStorage.setItem('activeTeamId', 'team-current');
    localStorage.setItem(STASH, JSON.stringify({ seasonId: 'season-9' }));

    restoreLastSelection('coach@club.de');

    expect(localStorage.getItem('activeSeasonId')).toBe('season-9');
    expect(localStorage.getItem('activeTeamId')).toBe('team-current');
  });

  it('ignores a corrupt stash rather than blocking login', () => {
    localStorage.setItem(STASH, '{{{');
    expect(() => restoreLastSelection('coach@club.de')).not.toThrow();
    expect(localStorage.getItem('activeSeasonId')).toBeNull();
  });
});

describe('logout → login round trip', () => {
  it('returns the same coach to the view they left', () => {
    signIn();
    localStorage.setItem('activeSeasonId', 'season-1');
    localStorage.setItem('activeTeamId', 'team-1');

    // What App.handleLogout does, in order.
    saveLastSelection();
    for (const key of ['isAuthenticated', 'user', 'access_token', 'activeSeasonId', 'activeTeamId']) {
      localStorage.removeItem(key);
    }
    expect(localStorage.getItem('activeSeasonId')).toBeNull();

    restoreLastSelection('coach@club.de');

    expect(localStorage.getItem('activeSeasonId')).toBe('season-1');
    expect(localStorage.getItem('activeTeamId')).toBe('team-1');
  });

  it('does not leak one coach’s selection to the next coach on a shared browser', () => {
    signIn('first@club.de');
    localStorage.setItem('activeSeasonId', 'season-first');
    localStorage.setItem('activeTeamId', 'team-first');
    saveLastSelection();
    localStorage.removeItem('activeSeasonId');
    localStorage.removeItem('activeTeamId');

    restoreLastSelection('second@club.de');

    expect(localStorage.getItem('activeSeasonId')).toBeNull();
    expect(localStorage.getItem('activeTeamId')).toBeNull();
  });
});
