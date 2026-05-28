// Fires the auth, seasons, and teams requests in parallel at module load —
// before React mounts. Context providers consume the in-flight promises on
// their first refresh, collapsing the boot waterfall into a single round-trip
// in the common case where the user has a stored active season.
import { AuthService, SeasonService, TeamService } from '../services';

// These are mutable so we can re-prime after a fresh login.
let mePromise: Promise<any> | null = null;
let seasonsPromise: Promise<any> | null = null;
let teamsPromise: Promise<any> | null = null;
let teamsPromiseSeasonId: string | null = null;

let meTaken = false;
let seasonsTaken = false;
let teamsTaken = false;

function attachSilentCatch(p: Promise<any> | null) {
  p?.catch(() => {});
}

// Boot phase: if localStorage says we're logged in, fire everything in
// parallel immediately so the network is busy while Vite and React are
// still finishing their cold-start work.
(function bootPhase() {
  if (typeof window === 'undefined') return;
  const isAuthed = localStorage.getItem('isAuthenticated') === 'true';
  if (!isAuthed) return;
  const storedSeasonId = localStorage.getItem('activeSeasonId');

  mePromise = AuthService.getCurrentUser();
  seasonsPromise = SeasonService.getAll();
  if (storedSeasonId) {
    teamsPromise = TeamService.getAll(storedSeasonId);
    teamsPromiseSeasonId = storedSeasonId;
  }
  attachSilentCatch(mePromise);
  attachSilentCatch(seasonsPromise);
  attachSilentCatch(teamsPromise);
})();

export const bootPrefetch = {
  takeMe(): Promise<any> | null {
    if (meTaken) return null;
    meTaken = true;
    return mePromise;
  },
  takeSeasons(): Promise<any> | null {
    if (seasonsTaken) return null;
    seasonsTaken = true;
    return seasonsPromise;
  },
  /**
   * Returns the prefetched teams promise only if it was fired with the same
   * season id the caller wants. Different season → caller has to fetch fresh.
   */
  takeTeams(seasonId: string | undefined): Promise<any> | null {
    if (teamsTaken) return null;
    if (!seasonId || seasonId !== teamsPromiseSeasonId) return null;
    teamsTaken = true;
    return teamsPromise;
  },

  /**
   * Called right after a successful login. Re-fires the seasons and teams
   * requests and returns a promise that resolves once both settle, so the
   * login button can stay in its loading state until the dashboard has the
   * data it needs to render fully populated.
   */
  primeAfterLogin(): Promise<void> {
    // Reset the "taken" flags so the context providers pick up these
    // freshly fired requests on their first refresh.
    seasonsTaken = false;
    teamsTaken = false;
    const storedSeasonId = typeof window !== 'undefined'
      ? localStorage.getItem('activeSeasonId')
      : null;

    seasonsPromise = SeasonService.getAll();
    // First-time users have no stored active season — fetch all teams so
    // we still get something useful into the dashboard. Once the season
    // context settles on a default, the context will refetch with the
    // proper filter if needed.
    teamsPromise = storedSeasonId
      ? TeamService.getAll(storedSeasonId)
      : TeamService.getAll();
    teamsPromiseSeasonId = storedSeasonId;

    attachSilentCatch(seasonsPromise);
    attachSilentCatch(teamsPromise);

    // Resolve once both have settled, regardless of success/failure — we
    // don't want to block the UI forever if the backend is having a bad
    // moment.
    return Promise.allSettled([seasonsPromise, teamsPromise]).then(() => undefined);
  },
};
