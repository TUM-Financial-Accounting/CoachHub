// src/services/library-service.ts
import { Basic, Principle, Tactic } from '../types/models';
import { 
  mapBasicFromApi, mapBasicToApi, 
  mapPrincipleFromApi, mapPrincipleToApi, 
  mapTacticFromApi, mapTacticToApi 
} from '../lib/data-mappers';
import { apiClient } from './api-client';

/**
 * Service for interacting with library-related API endpoints (basics, principles, tactics).
 */
export const LibraryService = {
  // --- BASICS ---
  async getBasics(): Promise<Basic[]> {
    const data = await apiClient.get<any[]>('/basics');
    return data.map(mapBasicFromApi);
  },
  async createBasic(basic: Omit<Basic, 'id' | 'isCustom'>): Promise<Basic> {
    const payload = mapBasicToApi(basic as Basic);
    const data = await apiClient.post<any>('/basics', payload);
    return mapBasicFromApi(data);
  },
  async updateBasic(id: string, basic: Basic): Promise<Basic> {
    const payload = mapBasicToApi(basic);
    const data = await apiClient.put<any>(`/basics/${id}`, payload);
    return mapBasicFromApi(data);
  },
  async deleteBasic(id: string): Promise<void> {
    await apiClient.delete(`/basics/${id}`);
  },

  // --- PRINCIPLES ---
  async getPrinciples(): Promise<Principle[]> {
    const data = await apiClient.get<any[]>('/principles');
    return data.map(mapPrincipleFromApi);
  },
  async createPrinciple(principle: Omit<Principle, 'id' | 'isCustom'>): Promise<Principle> {
    const payload = mapPrincipleToApi(principle as Principle);
    const data = await apiClient.post<any>('/principles', payload);
    return mapPrincipleFromApi(data);
  },
  async updatePrinciple(id: string, principle: Principle): Promise<Principle> {
    const payload = mapPrincipleToApi(principle);
    const data = await apiClient.put<any>(`/principles/${id}`, payload);
    return mapPrincipleFromApi(data);
  },
  async deletePrinciple(id: string): Promise<void> {
    await apiClient.delete(`/principles/${id}`);
  },

  // --- TACTICS ---
  async getTactics(): Promise<Tactic[]> {
    const data = await apiClient.get<any[]>('/tactics');
    return data.map(mapTacticFromApi);
  },
  async createTactic(tactic: Omit<Tactic, 'isCustom'>): Promise<Tactic> {
    // Accepts an optional `id`; the backend will honor it. Enables optimistic
    // UI with no row-key flicker after the server responds.
    const payload = mapTacticToApi(tactic as Tactic);
    const data = await apiClient.post<any>('/tactics', payload);
    return mapTacticFromApi(data);
  },
  async updateTactic(id: string, tactic: Tactic): Promise<Tactic> {
    const payload = mapTacticToApi(tactic);
    const data = await apiClient.put<any>(`/tactics/${id}`, payload);
    return mapTacticFromApi(data);
  },
  async deleteTactic(id: string): Promise<void> {
    await apiClient.delete(`/tactics/${id}`);
  }
};
