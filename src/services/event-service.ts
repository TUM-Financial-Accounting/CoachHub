// src/services/event-service.ts
import { CalendarEvent } from '../types/models';
import { mapEventFromApi, mapEventToApi } from '../lib/data-mappers';
import { SeriesPattern, SeriesScope } from '../lib/recurrence';
import { apiClient } from './api-client';

/**
 * Service for interacting with the /events API endpoint (generic team
 * calendar events — meetings, team-building, etc.). Training sessions and
 * matches keep their own services; the calendar layers all three together.
 */
export const EventService = {
  async getAll(teamId?: string, seasonId?: string): Promise<CalendarEvent[]> {
    const params = new URLSearchParams();
    if (teamId) params.append('team_id', teamId);
    if (seasonId) params.append('season_id', seasonId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const data = await apiClient.get<any[]>(`/events${queryString}`);
    return data.map(mapEventFromApi);
  },

  async create(event: Omit<CalendarEvent, 'id'>, teamId?: string, seasonId?: string): Promise<CalendarEvent> {
    const payload = mapEventToApi(event as CalendarEvent) as any;
    if (teamId) payload.team_id = teamId;
    if (seasonId) payload.season_id = seasonId;
    const data = await apiClient.post<any>('/events', payload);
    return mapEventFromApi(data);
  },

  // 'future' / 'all' update the matching series occurrences but keep their dates.
  async update(id: string, event: CalendarEvent, scope: SeriesScope = 'this'): Promise<CalendarEvent> {
    const data = await apiClient.put<any>(`/events/${id}?scope=${scope}`, mapEventToApi(event));
    return mapEventFromApi(data);
  },

  async delete(id: string, scope: SeriesScope = 'this'): Promise<void> {
    await apiClient.delete(`/events/${id}?scope=${scope}`);
  },

  async createSeries(
    event: Omit<CalendarEvent, 'id' | 'date'>,
    pattern: SeriesPattern,
    teamId?: string,
    seasonId?: string,
  ): Promise<{ occurrencesCreated: number; seriesId: string }> {
    const data = await apiClient.post<any>('/event_series', {
      title: event.title,
      description: event.description,
      location: event.location,
      start_time: event.startTime,
      end_time: event.endTime,
      team_id: teamId,
      season_id: seasonId,
      frequency: pattern.frequency,
      weekdays: pattern.weekdays,
      series_start_date: pattern.startDate,
      series_end_date: pattern.endDate,
      occurrences: pattern.occurrences,
    });
    return { occurrencesCreated: data.occurrences_created ?? 0, seriesId: data.series_id ?? '' };
  },
};
