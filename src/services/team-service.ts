// src/services/team-service.ts
import { Team } from '../types/models';
import { apiClient } from './api-client';

export const TeamService = {
  async getAll(): Promise<Team[]> {
    return apiClient.get<Team[]>('/teams');
  },
  async create(team: Omit<Team, 'id'>): Promise<Team> {
    return apiClient.post<Team>('/teams', team);
  },
  async update(id: string, team: Team): Promise<Team> {
    return apiClient.put<Team>(`/teams/${id}`, team);
  },
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/teams/${id}`);
  }
};
