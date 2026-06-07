// src/services/training-service.ts
import { TrainingSession } from '../types/models';
import { mapSessionFromApi, mapSessionToApi } from '../lib/data-mappers';
import { apiClient } from './api-client';

/**
 * Service for interacting with training session API endpoints.
 */
export const TrainingService = {
  /**
   * Fetches all training sessions.
   */
  async getAll(teamId?: string, seasonId?: string): Promise<TrainingSession[]> {
    const params = new URLSearchParams();
    if (teamId) params.append('team_id', teamId);
    if (seasonId) params.append('season_id', seasonId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const data = await apiClient.get<any[]>(`/training_sessions${queryString}`);
    return data.map(mapSessionFromApi);
  },

  /**
   * Creates a new training session.
   */
  async create(session: Omit<TrainingSession, 'id'>, teamId?: string, seasonId?: string): Promise<TrainingSession> {
    const payload = mapSessionToApi(session as TrainingSession) as any;
    if (teamId) payload.team_id = teamId;
    if (seasonId) payload.season_id = seasonId;
    const data = await apiClient.post<any>('/training_sessions', payload);
    return mapSessionFromApi(data);
  },

  /**
   * Updates an existing training session.
   * @param scope 'this' updates only this occurrence (and detaches it from
   *              series-wide propagation). 'future' updates this and every
   *              unmodified future occurrence in the series.
   */
  async update(id: string, session: TrainingSession, scope: 'this' | 'future' = 'this'): Promise<TrainingSession> {
    const payload = mapSessionToApi(session);
    const data = await apiClient.put<any>(`/training_sessions/${id}?scope=${scope}`, payload);
    return mapSessionFromApi(data);
  },

  /**
   * Deletes a training session.
   * @param scope 'this' deletes only this occurrence; 'future' deletes this
   *              and every future occurrence in the series.
   */
  async delete(id: string, scope: 'this' | 'future' = 'this'): Promise<void> {
    await apiClient.delete(`/training_sessions/${id}?scope=${scope}`);
  },

  /**
   * Creates a recurring training series. The backend materialises one row in
   * training_sessions per matching weekday between start and end (inclusive).
   */
  async createSeries(input: {
    teamId?: string;
    seasonId?: string;
    dayOfWeek: number; // 0 = Monday … 6 = Sunday
    seriesStartDate: string; // YYYY-MM-DD
    seriesEndDate: string;   // YYYY-MM-DD
    startTime: string;
    endTime: string;
    focus: string;
    intensity: string;
    selectedPlayers: string;
    selectedExercises: string;
  }): Promise<{ occurrencesCreated: number; seriesId: string }> {
    const data = await apiClient.post<any>('/training_series', {
      team_id: input.teamId,
      season_id: input.seasonId,
      day_of_week: input.dayOfWeek,
      series_start_date: input.seriesStartDate,
      series_end_date: input.seriesEndDate,
      start_time: input.startTime,
      end_time: input.endTime,
      focus: input.focus,
      intensity: input.intensity,
      selected_players: input.selectedPlayers,
      selected_exercises: input.selectedExercises,
    });
    return {
      occurrencesCreated: data.occurrences_created ?? 0,
      seriesId: data.series?.id ?? data.series_id ?? '',
    };
  },
};
