// src/services/match-service.ts
import { Match, MatchDetails, MatchEvent } from '../types/models';
import { mapMatchFromApi, mapMatchDetailsFromApi, mapMatchDetailsToApi, mapMatchEventFromApi } from '../lib/data-mappers';
import { apiClient } from './api-client';

export interface SuggestedFormation {
  formation: string;
  source: string;
}

/**
 * Service for interacting with match-related API endpoints.
 */
export const MatchService = {
  /**
   * Fetches all matches.
   */
  async getAll(teamId?: string, seasonId?: string): Promise<MatchDetails[]> {
    const params = new URLSearchParams();
    if (teamId) params.append('team_id', teamId);
    if (seasonId) params.append('season_id', seasonId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const data = await apiClient.get<any[]>(`/matches${queryString}`);
    return data.map(mapMatchDetailsFromApi);
  },

  /**
   * Fetches the latest (or upcoming) match.
   */
  async getLatest(teamId?: string, seasonId?: string): Promise<Match | null> {
    try {
      const params = new URLSearchParams();
      if (teamId) params.append('team_id', teamId);
      if (seasonId) params.append('season_id', seasonId);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const data = await apiClient.get<any>(`/matches/latest${queryString}`);
      return data ? mapMatchFromApi(data) : null;
    } catch (e) {
      console.warn('Failed to fetch latest match', e);
      return null;
    }
  },

  /**
   * Creates a new match.
   */
  async create(match: MatchDetails, teamId?: string, seasonId?: string): Promise<MatchDetails> {
    const payload = mapMatchDetailsToApi(match) as any;
    if (teamId) payload.team_id = teamId;
    if (seasonId) payload.season_id = seasonId;
    const data = await apiClient.post<any>('/matches', payload);
    return mapMatchDetailsFromApi(data);
  },

  /**
   * Updates an existing match by ID.
   */
  async update(id: string, match: MatchDetails): Promise<MatchDetails> {
    const payload = mapMatchDetailsToApi(match);
    const data = await apiClient.put<any>(`/matches/${id}`, payload);
    return mapMatchDetailsFromApi(data);
  },

  /**
   * Deletes a match (and its recorded events) by ID.
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/matches/${id}`);
  },

  /**
   * Fetches a suggested formation based on recent training data.
   */
  async getSuggestedFormation(teamId?: string): Promise<SuggestedFormation> {
    const params = teamId ? `?team_id=${teamId}` : '';
    return apiClient.get<SuggestedFormation>(`/match/suggested-formation${params}`);
  },

  /**
   * Updates match score and notes.
   */
  async updateStats(id: string, goalsFor: number, goalsAgainst: number, notes: string): Promise<MatchDetails> {
    const data = await apiClient.put<any>(`/matches/${id}/stats`, {
      goals_for: goalsFor,
      goals_against: goalsAgainst,
      notes: notes
    });
    return mapMatchDetailsFromApi(data);
  },

  /**
   * Fetches all events for a match.
   */
  async getEvents(matchId: string): Promise<MatchEvent[]> {
    const data = await apiClient.get<any[]>(`/matches/${matchId}/events`);
    return data.map(mapMatchEventFromApi);
  },

  /**
   * Adds a new event to a match.
   */
  async addEvent(matchId: string, event: Omit<MatchEvent, 'id' | 'matchId'>): Promise<MatchEvent> {
    const data = await apiClient.post<any>(`/matches/${matchId}/events`, {
      player_id: event.playerId,
      event_type: event.eventType,
      minute: event.minute
    });
    return mapMatchEventFromApi(data);
  },

  /**
   * Deletes a match event.
   */
  async deleteEvent(eventId: string): Promise<void> {
    return apiClient.delete(`/match_events/${eventId}`);
  },

  /**
   * Fetches top scorers and assisters for a team/season.
   */
  async getTopPerformers(teamId: string, seasonId?: string): Promise<any[]> {
    const params = new URLSearchParams({ team_id: teamId });
    if (seasonId) params.append('season_id', seasonId);
    return apiClient.get<any[]>(`/stats/top-performers?${params.toString()}`);
  }
};
