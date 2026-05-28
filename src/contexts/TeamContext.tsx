import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { TeamService } from '../services';
import { Team } from '../types/models';
import { useSeason } from './SeasonContext';

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

// Module-level cache keyed by season id. Survives provider re-mounts and
// makes switching back to a previously-loaded season instant.
const teamCache = new Map<string, Team[]>();
const NO_SEASON_KEY = '__no_season__';

export const TeamProvider: React.FC<{ children: React.ReactNode, isAuthenticated: boolean }> = ({ children, isAuthenticated }) => {
  const { activeSeason } = useSeason();
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamIdState, setActiveTeamIdState] = useState<string | null>(() => localStorage.getItem('activeTeamId'));
  const [loading, setLoading] = useState(true);

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
      const data = await TeamService.getAll(activeSeason?.id);
      // Drop the response if a newer request has started since we kicked off.
      if (myRequest !== requestIdRef.current) return;
      teamCache.set(seasonKey, data);
      applyTeams(data);
    } catch (e) {
      console.error("Failed to load teams", e);
    } finally {
      if (myRequest === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    refreshTeams();
  }, [isAuthenticated, activeSeason]);

  const activeTeam = teams.find(t => t.id === activeTeamIdState) || null;

  return (
    <TeamContext.Provider value={{ teams, activeTeam, setActiveTeamId, refreshTeams, loading }}>
        {children}
    </TeamContext.Provider>
  );
}
