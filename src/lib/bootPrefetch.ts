// Fires the auth, seasons, and teams requests in parallel at module load —
// before React mounts. Context providers consume the in-flight promises on
// their first refresh, collapsing the boot waterfall into a single round-trip
// in the common case where the user has a stored active season.
import { AuthService, SeasonService, TeamService } from '../services';

const isAuthed = typeof window !== 'undefined' && localStorage.getItem('isAuthenticated') === 'true';
const storedSeasonId = typeof window !== 'undefined' ? localStorage.getItem('activeSeasonId') : null;

// Kick off all three requests synchronously so the network is busy while
// Vite and React are still finishing their cold-start work.
const mePromise: Promise<any> | null = isAuthed ? AuthService.getCurrentUser() : null;
const seasonsPromise: Promise<any> | null = isAuthed ? SeasonService.getAll() : null;
const teamsPromise: Promise<any> | null = isAuthed && storedSeasonId
  ? TeamService.getAll(storedSeasonId)
  : null;

// Attach no-op catch handlers so an early rejection (e.g. expired session
// before any consumer is ready) doesn't surface as an unhandled rejection.
mePromise?.catch(() => {});
seasonsPromise?.catch(() => {});
teamsPromise?.catch(() => {});

// Each "take" call returns the prefetched promise once and only once,
// so a subsequent manual refresh hits the network fresh.
let meTaken = false;
let seasonsTaken = false;
let teamsTaken = false;

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
    if (!seasonId || seasonId !== storedSeasonId) return null;
    teamsTaken = true;
    return teamsPromise;
  },
};
