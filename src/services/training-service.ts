// src/services/training-service.ts
import { TrainingAttendance, TrainingSession } from '../types/models';
import { mapAttendanceFromApi, mapAttendanceToApi, mapSessionFromApi, mapSessionToApi } from '../lib/data-mappers';
import { SeriesPattern, SeriesScope } from '../lib/recurrence';
import { apiClient } from './api-client';

/**
 * Service for interacting with training session API endpoints.
 */
export const TrainingService = {
  /**
   * Fetches all training sessions.
   */
  async getAttendance(sessionId: string): Promise<TrainingAttendance[]> {
    const data = await apiClient.get<any[]>(`/training_sessions/${sessionId}/attendance`);
    return data.map(mapAttendanceFromApi);
  },

  // Replaces the session's whole list; send every player who should stay recorded.
  async saveAttendance(sessionId: string, records: Pick<TrainingAttendance, 'playerId' | 'status' | 'reason'>[]): Promise<TrainingAttendance[]> {
    const data = await apiClient.put<any[]>(`/training_sessions/${sessionId}/attendance`, { records: records.map(mapAttendanceToApi) });
    return data.map(mapAttendanceFromApi);
  },

  async getSeasonAttendance(teamId: string, seasonId?: string): Promise<TrainingAttendance[]> {
    const params = new URLSearchParams({ team_id: teamId });
    if (seasonId) params.append('season_id', seasonId);
    const data = await apiClient.get<any[]>(`/stats/attendance?${params.toString()}`);
    return data.map(mapAttendanceFromApi);
  },

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
   *              series-wide propagation). 'future' / 'all' update this or
   *              every unmodified occurrence in the series, keeping dates.
   */
  async update(id: string, session: TrainingSession, scope: SeriesScope = 'this'): Promise<TrainingSession> {
    const payload = mapSessionToApi(session);
    const data = await apiClient.put<any>(`/training_sessions/${id}?scope=${scope}`, payload);
    return mapSessionFromApi(data);
  },

  /**
   * Deletes a training session.
   * @param scope 'this' deletes only this occurrence; 'future' deletes this
   *              and every later occurrence; 'all' deletes the whole series.
   */
  async delete(id: string, scope: SeriesScope = 'this'): Promise<void> {
    await apiClient.delete(`/training_sessions/${id}?scope=${scope}`);
  },

  /**
   * Creates a recurring training series. The backend materialises one row in
   * training_sessions per date the pattern produces.
   */
  async createSeries(input: {
    teamId?: string;
    seasonId?: string;
    pattern: SeriesPattern;
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
      frequency: input.pattern.frequency,
      weekdays: input.pattern.weekdays,
      series_start_date: input.pattern.startDate,
      series_end_date: input.pattern.endDate,
      occurrences: input.pattern.occurrences,
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
