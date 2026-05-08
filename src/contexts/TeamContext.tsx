import React, { createContext, useContext, useState, useEffect } from 'react';
import { TeamService } from '../services';
import { Team } from '../types/models';

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

export const TeamProvider: React.FC<{ children: React.ReactNode, isAuthenticated: boolean }> = ({ children, isAuthenticated }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamIdState, setActiveTeamIdState] = useState<string | null>(() => localStorage.getItem('activeTeamId'));
  const [loading, setLoading] = useState(true);

  const refreshTeams = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await TeamService.getAll();
      setTeams(data);
      if (data.length > 0) {
        if (!activeTeamIdState || !data.find(t => t.id === activeTeamIdState)) {
          setActiveTeamId(data[0].id);
        }
      } else {
         setActiveTeamIdState(null);
         localStorage.removeItem('activeTeamId');
      }
    } catch (e) {
       console.error("Failed to load teams", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshTeams();
  }, [isAuthenticated]);

  const setActiveTeamId = (id: string) => {
    setActiveTeamIdState(id);
    localStorage.setItem('activeTeamId', id);
  }

  const activeTeam = teams.find(t => t.id === activeTeamIdState) || null;

  return (
    <TeamContext.Provider value={{ teams, activeTeam, setActiveTeamId, refreshTeams, loading }}>
        {children}
    </TeamContext.Provider>
  );
}
