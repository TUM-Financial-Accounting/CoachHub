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
  async getAll(teamId?: string): Promise<Player[]> {
    const params = teamId ? `?team_id=${teamId}` : '';
    const data = await apiClient.get<any[]>(`/players${params}`);
    return data.map(mapPlayerFromApi);
  },

  /**
   * Creates a new player.
   */
  async create(player: Omit<Player, 'id'>, teamId?: string): Promise<Player> {
    const payload = mapPlayerToApi(player as Player) as any;
    if (teamId) payload.team_id = teamId;
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
  async assignToTeam(playerId: string, teamId: string): Promise<void> {
    await apiClient.post(`/players/${playerId}/teams/${teamId}`, {});
  },

  /**
   * Removes a player from a specific team.
   */
  async removeFromTeam(playerId: string, teamId: string): Promise<void> {
    await apiClient.delete(`/players/${playerId}/teams/${teamId}`);
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
