// src/services/player-service.ts
import { Player } from '../types/models';
import { mapPlayerFromApi, mapPlayerToApi } from '../lib/data-mappers';
import { apiClient } from './api-client';

/**
 * Service for interacting with the /players API endpoint.
 */
export const PlayerService = {
  /**
   * Fetches all players.
   */
  async getAll(teamId?: string, seasonId?: string): Promise<Player[]> {
    const params = new URLSearchParams();
    if (teamId) params.append('team_id', teamId);
    if (seasonId) params.append('season_id', seasonId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const data = await apiClient.get<any[]>(`/players${queryString}`);
    return data.map(mapPlayerFromApi);
  },

  /**
   * Creates a new player. Accepts an optional `id` so callers can pre-mint
   * a UUID for optimistic UI — the server will honor it if provided.
   */
  async create(player: Player | Omit<Player, 'id'>, teamId?: string, seasonId?: string): Promise<Player> {
    const payload = mapPlayerToApi(player as Player) as any;
    const presetId = (player as Player).id;
    if (presetId) payload.id = presetId;
    if (teamId) payload.team_id = teamId;
    if (seasonId) payload.season_id = seasonId;
    const data = await apiClient.post<any>('/players', payload);
    return mapPlayerFromApi(data);
  },

  /**
   * Updates an existing player by ID.
   */
  async update(id: string, player: Player): Promise<Player> {
    const payload = mapPlayerToApi(player);
    const data = await apiClient.put<any>(`/players/${id}`, payload);
    return mapPlayerFromApi(data);
  },

  /**
   * Deletes a player by ID globally.
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/players/${id}`);
  },

  /**
   * Assigns an existing player to a team.
   */
  async assignToTeam(playerId: string, teamId: string, seasonId?: string): Promise<void> {
    const queryString = seasonId ? `?season_id=${seasonId}` : '';
    await apiClient.post(`/players/${playerId}/teams/${teamId}${queryString}`, {});
  },

  /**
   * Removes a player from a specific team.
   */
  async removeFromTeam(playerId: string, teamId: string, seasonId?: string): Promise<void> {
    const queryString = seasonId ? `?season_id=${seasonId}` : '';
    await apiClient.delete(`/players/${playerId}/teams/${teamId}${queryString}`);
  },

  /**
   * Updates performance for a player, optionally specific to a team.
   */
  async updatePerformance(playerId: string, value: number, teamId?: string): Promise<void> {
    await apiClient.put(`/players/${playerId}/performance`, {
      performance: value,
      team_id: teamId
    });
  }
};
