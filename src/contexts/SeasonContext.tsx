import React, { createContext, useContext, useState, useEffect } from 'react';
import { SeasonService } from '../services/season-service';
import { bootPrefetch } from '../lib/bootPrefetch';

export interface Season {
  id: string;
  name: string;
}

interface SeasonContextProps {
  seasons: Season[];
  activeSeason: Season | null;
  setActiveSeasonId: (id: string) => void;
  refreshSeasons: () => Promise<void>;
  loading: boolean;
}

const SeasonContext = createContext<SeasonContextProps>({
  seasons: [],
  activeSeason: null,
  setActiveSeasonId: () => {},
  refreshSeasons: async () => {},
  loading: true
});

export const useSeason = () => useContext(SeasonContext);

const SEASONS_CACHE_KEY = 'cache:seasons:v1';

function readSeasonsCache(): Season[] | null {
  try {
    const raw = localStorage.getItem(SEASONS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export const SeasonProvider: React.FC<{ children: React.ReactNode, isAuthenticated: boolean }> = ({ children, isAuthenticated }) => {
  // Seed from localStorage so the season switcher and downstream consumers
  // render with real data on the very first paint after a reload.
  const cached = readSeasonsCache();
  const [seasons, setSeasons] = useState<Season[]>(cached ?? []);
  const [activeSeasonIdState, setActiveSeasonIdState] = useState<string | null>(() => localStorage.getItem('activeSeasonId'));
  const [loading, setLoading] = useState(!cached); // already have data → not loading

  const refreshSeasons = async () => {
    if (!isAuthenticated) return;
    // Only show a spinner if we have nothing to render yet.
    if (seasons.length === 0) setLoading(true);
    try {
      const prefetched = bootPrefetch.takeSeasons();
      const data = prefetched ? await prefetched : await SeasonService.getAll();
      setSeasons(data);
      try { localStorage.setItem(SEASONS_CACHE_KEY, JSON.stringify(data)); } catch {}
      if (data.length > 0) {
        if (!activeSeasonIdState || !data.find((s: Season) => s.id === activeSeasonIdState)) {
          setActiveSeasonId(data[0].id);
        }
      } else {
         setActiveSeasonIdState(null);
         localStorage.removeItem('activeSeasonId');
      }
    } catch (e) {
       console.error("Failed to load seasons", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSeasons();
  }, [isAuthenticated]);

  const setActiveSeasonId = (id: string) => {
    setActiveSeasonIdState(id);
    localStorage.setItem('activeSeasonId', id);
  }

  const activeSeason = seasons.find(s => s.id === activeSeasonIdState) || null;

  return (
    <SeasonContext.Provider value={{ seasons, activeSeason, setActiveSeasonId, refreshSeasons, loading }}>
        {children}
    </SeasonContext.Provider>
  );
}
