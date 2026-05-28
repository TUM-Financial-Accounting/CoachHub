import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { TeamService } from '../services';
import { Team } from '../types/models';
import { useSeason } from './SeasonContext';
import { bootPrefetch } from '../lib/bootPrefetch';

interface TeamContextProps {
  teams: Team[];
  activeTeam: Team | null;
  setActiveTeamId: (id: string) => void;
  refreshTeams: () => Promise<void>;
  loading: boolean;
}

const TeamContext = createContext<TeamContextProps>({
  teams: [],
  activeTeam: null,
  setActiveTeamId: () => {},
  refreshTeams: async () => {},
  loading: true
});

export const useTeam = () => useContext(TeamContext);

// Module-level cache keyed by season id. Survives provider re-mounts so
// switching back to a previously-loaded season is instant within a session.
// Hydrated from localStorage so it also survives a full reload.
const teamCache = new Map<string, Team[]>();
const NO_SEASON_KEY = '__no_season__';
const TEAMS_CACHE_KEY = 'cache:teams:v1';

(function hydrateTeamCache() {
  try {
    const raw = localStorage.getItem(TEAMS_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, Team[]>;
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) teamCache.set(key, value);
    }
  } catch {
    // ignore corrupt cache
  }
})();

function persistTeamCache() {
  try {
    const obj: Record<string, Team[]> = {};
    teamCache.forEach((value, key) => { obj[key] = value; });
    localStorage.setItem(TEAMS_CACHE_KEY, JSON.stringify(obj));
  } catch {
    // storage full, ignore
  }
}

export const TeamProvider: React.FC<{ children: React.ReactNode, isAuthenticated: boolean }> = ({ children, isAuthenticated }) => {
  const { activeSeason, loading: seasonsLoading } = useSeason();
  // Seed from the persisted cache if we can — this is what makes the team
  // list show up immediately on reload instead of waiting for /teams.
  const initialSeasonKey = (typeof localStorage !== 'undefined' && localStorage.getItem('activeSeasonId')) || NO_SEASON_KEY;
  const initialTeams = teamCache.get(initialSeasonKey) ?? [];
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [activeTeamIdState, setActiveTeamIdState] = useState<string | null>(() => localStorage.getItem('activeTeamId'));
  const [loading, setLoading] = useState(initialTeams.length === 0);

  // Track the in-flight request so a fast season switch doesn't overwrite
  // the newest result with a stale one.
  const requestIdRef = useRef(0);

  const setActiveTeamId = (id: string) => {
    setActiveTeamIdState(id);
    localStorage.setItem('activeTeamId', id);
  };

  const applyTeams = (data: Team[]) => {
    setTeams(data);
    if (data.length > 0) {
      // Use the latest setActiveTeamIdState read via the functional setter to
      // avoid stale closure on rapid season switches.
      setActiveTeamIdState(prev => {
        if (prev && data.find(t => t.id === prev)) return prev;
        const next = data[0].id;
        localStorage.setItem('activeTeamId', next);
        return next;
      });
    } else {
      setActiveTeamIdState(null);
      localStorage.removeItem('activeTeamId');
    }
  };

  const refreshTeams = async () => {
    if (!isAuthenticated) return;
    const seasonKey = activeSeason?.id ?? NO_SEASON_KEY;
    const myRequest = ++requestIdRef.current;

    // Stale-while-revalidate: show cached data instantly if we have it,
    // then re-fetch in the background to refresh.
    const cached = teamCache.get(seasonKey);
    if (cached) {
      applyTeams(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      // First refresh after boot: pick up the prefetched in-flight request
      // if it was fired with the same season we want.
      const prefetched = bootPrefetch.takeTeams(activeSeason?.id);
      const data = prefetched
        ? await prefetched
        : await TeamService.getAll(activeSeason?.id);
      // Drop the response if a newer request has started since we kicked off.
      if (myRequest !== requestIdRef.current) return;
      teamCache.set(seasonKey, data);
      persistTeamCache();
      applyTeams(data);
    } catch (e) {
      console.error("Failed to load teams", e);
    } finally {
      if (myRequest === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    // Wait for seasons to load before kicking off a team fetch. Otherwise
    // we fire a useless /teams (no season filter) while seasons hydrate, then
    // immediately re-fetch once the real season arrives — a wasted round-trip
    // on every boot.
    if (seasonsLoading) return;
    refreshTeams();
  }, [isAuthenticated, activeSeason, seasonsLoading]);

  const activeTeam = teams.find(t => t.id === activeTeamIdState) || null;

  return (
    <TeamContext.Provider value={{ teams, activeTeam, setActiveTeamId, refreshTeams, loading }}>
        {children}
    </TeamContext.Provider>
  );
}
