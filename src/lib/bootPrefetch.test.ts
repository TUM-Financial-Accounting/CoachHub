import { describe, it, expect, vi, beforeEach } from 'vitest';

// bootPrefetch fires real requests in an IIFE at module load, so the service
// layer has to be mocked before the module is ever imported, and the module
// registry reset between tests to re-run that IIFE.
const services = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  seasonsGetAll: vi.fn(),
  teamsGetAll: vi.fn(),
}));

vi.mock('../services', () => ({
  AuthService: { getCurrentUser: services.getCurrentUser },
  SeasonService: { getAll: services.seasonsGetAll },
  TeamService: { getAll: services.teamsGetAll },
}));

/** Re-imports bootPrefetch so its boot-phase IIFE runs against current storage. */
async function loadBootPrefetch() {
  vi.resetModules();
  return (await import('./bootPrefetch')).bootPrefetch;
}

function armServices() {
  services.getCurrentUser.mockResolvedValue({ email: 'coach@club.de' });
  services.seasonsGetAll.mockResolvedValue([{ id: 'season-1', name: '25/26' }]);
  services.teamsGetAll.mockResolvedValue([{ id: 'team-1', name: 'U15' }]);
}

beforeEach(() => {
  services.getCurrentUser.mockReset();
  services.seasonsGetAll.mockReset();
  services.teamsGetAll.mockReset();
});

describe('boot phase', () => {
  it('fires nothing when localStorage says the user is signed out', async () => {
    armServices();
    const bootPrefetch = await loadBootPrefetch();

    expect(services.getCurrentUser).not.toHaveBeenCalled();
    expect(services.seasonsGetAll).not.toHaveBeenCalled();
    expect(services.teamsGetAll).not.toHaveBeenCalled();
    expect(bootPrefetch.takeMe()).toBeNull();
    expect(bootPrefetch.takeSeasons()).toBeNull();
  });

  it('fires /me and /seasons in parallel when a session is stored', async () => {
    armServices();
    localStorage.setItem('isAuthenticated', 'true');

    const bootPrefetch = await loadBootPrefetch();

    expect(services.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(services.seasonsGetAll).toHaveBeenCalledTimes(1);
    await expect(bootPrefetch.takeMe()).resolves.toEqual({ email: 'coach@club.de' });
  });

  it('skips the teams request when no active season is stored', async () => {
    armServices();
    localStorage.setItem('isAuthenticated', 'true');

    const bootPrefetch = await loadBootPrefetch();

    expect(services.teamsGetAll).not.toHaveBeenCalled();
    expect(bootPrefetch.takeTeams('season-1')).toBeNull();
  });

  it('fires the teams request for the stored season', async () => {
    armServices();
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('activeSeasonId', 'season-1');

    const bootPrefetch = await loadBootPrefetch();

    expect(services.teamsGetAll).toHaveBeenCalledWith('season-1');
    await expect(bootPrefetch.takeTeams('season-1')).resolves.toEqual([{ id: 'team-1', name: 'U15' }]);
  });

  it('does not blow up the boot when a prefetched request rejects', async () => {
    services.getCurrentUser.mockRejectedValue(new Error('401'));
    services.seasonsGetAll.mockRejectedValue(new Error('401'));
    localStorage.setItem('isAuthenticated', 'true');

    const bootPrefetch = await loadBootPrefetch();

    // The rejection is caught internally so it never surfaces as an unhandled
    // rejection; the consumer still sees it when it awaits the promise.
    await expect(bootPrefetch.takeMe()).rejects.toThrow('401');
  });
});

describe('take* handover', () => {
  it('hands a prefetched promise to exactly one consumer', async () => {
    armServices();
    localStorage.setItem('isAuthenticated', 'true');

    const bootPrefetch = await loadBootPrefetch();

    expect(bootPrefetch.takeMe()).not.toBeNull();
    expect(bootPrefetch.takeMe()).toBeNull();
    expect(bootPrefetch.takeSeasons()).not.toBeNull();
    expect(bootPrefetch.takeSeasons()).toBeNull();
  });

  it('refuses the teams promise when the caller wants a different season', async () => {
    armServices();
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('activeSeasonId', 'season-1');

    const bootPrefetch = await loadBootPrefetch();

    // Stale data for the wrong season is worse than a fresh round-trip.
    expect(bootPrefetch.takeTeams('season-2')).toBeNull();
    // …and refusing must not consume the handover for the right season.
    expect(bootPrefetch.takeTeams('season-1')).not.toBeNull();
  });

  it('refuses the teams promise when the caller has no season yet', async () => {
    armServices();
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('activeSeasonId', 'season-1');

    const bootPrefetch = await loadBootPrefetch();

    expect(bootPrefetch.takeTeams(undefined)).toBeNull();
  });
});

describe('primeAfterLogin', () => {
  it('re-arms seasons and teams so the providers pick up fresh requests', async () => {
    armServices();
    const bootPrefetch = await loadBootPrefetch();

    // Nothing fired at boot — the user was signed out.
    expect(services.seasonsGetAll).not.toHaveBeenCalled();
    localStorage.setItem('activeSeasonId', 'season-1');

    await bootPrefetch.primeAfterLogin();

    expect(services.seasonsGetAll).toHaveBeenCalledTimes(1);
    expect(services.teamsGetAll).toHaveBeenCalledWith('season-1');
    expect(bootPrefetch.takeSeasons()).not.toBeNull();
    expect(bootPrefetch.takeTeams('season-1')).not.toBeNull();
  });

  it('resets the taken flags so an already-consumed promise is offered again', async () => {
    armServices();
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('activeSeasonId', 'season-1');

    const bootPrefetch = await loadBootPrefetch();
    bootPrefetch.takeSeasons();
    expect(bootPrefetch.takeSeasons()).toBeNull();

    await bootPrefetch.primeAfterLogin();

    expect(bootPrefetch.takeSeasons()).not.toBeNull();
  });

  it('fetches all teams for a first-time user with no stored season', async () => {
    armServices();
    const bootPrefetch = await loadBootPrefetch();

    await bootPrefetch.primeAfterLogin();

    expect(services.teamsGetAll).toHaveBeenCalledWith();
    expect(bootPrefetch.takeTeams('season-1')).toBeNull();
  });

  it('resolves even when both requests fail, so the login button never hangs', async () => {
    services.seasonsGetAll.mockRejectedValue(new Error('boom'));
    services.teamsGetAll.mockRejectedValue(new Error('boom'));

    const bootPrefetch = await loadBootPrefetch();

    await expect(bootPrefetch.primeAfterLogin()).resolves.toBeUndefined();
  });
});
