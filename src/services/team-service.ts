// src/services/team-service.ts
import { Team } from '../types/models';
import { mapTeamFromApi, mapTeamToApi } from '../lib/data-mappers';
import { apiClient } from './api-client';

export const TeamService = {
  async getAll(seasonId?: string): Promise<Team[]> {
    const queryString = seasonId ? `?season_id=${seasonId}` : '';
    const data = await apiClient.get<any[]>(`/teams${queryString}`);
    return data.map(mapTeamFromApi);
  },
  async create(team: { name: string; formation?: string; seasonId?: string }): Promise<Team> {
    const data = await apiClient.post<any>('/teams', mapTeamToApi(team));
    return mapTeamFromApi(data);
  },
  async update(id: string, team: Team): Promise<Team> {
    const data = await apiClient.put<any>(`/teams/${id}`, mapTeamToApi(team));
    return mapTeamFromApi(data);
  },
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/teams/${id}`);
  },
  async clone(id: string, targetSeasonId: string): Promise<Team> {
    const data = await apiClient.post<any>(`/teams/${id}/clone?target_season_id=${targetSeasonId}`, {});
    return mapTeamFromApi(data);
  }
};
