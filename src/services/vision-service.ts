// src/services/vision-service.ts
import { Vision } from '../types/models';
import { mapVisionFromApi } from '../lib/data-mappers';
import { apiClient } from './api-client';

export const VisionService = {
  async getAll(): Promise<Vision[]> {
    const data = await apiClient.get<any[]>('/visions');
    return data.map(mapVisionFromApi);
  },

  async create(title: string, filename: string): Promise<Vision> {
    return mapVisionFromApi(await apiClient.post<any>('/visions', { title, filename }));
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/visions/${id}`);
  },
};
