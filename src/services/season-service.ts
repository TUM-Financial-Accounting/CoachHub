import { Season } from '../types/models';
import { mapSeasonFromApi } from '../lib/data-mappers';
import { apiClient } from './api-client';

export const SeasonService = {
  getAll: async (): Promise<Season[]> => {
    const data = await apiClient.get<any[]>('/seasons');
    return data.map(mapSeasonFromApi);
  },

  create: async (data: { name: string }): Promise<Season> => {
    return mapSeasonFromApi(await apiClient.post<any>('/seasons', data));
  },

  delete: async (id: string) => {
    return apiClient.delete(`/seasons/${id}`);
  }
};
