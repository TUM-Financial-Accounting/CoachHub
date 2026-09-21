import { apiClient } from './api-client';
import { mapGoogleStatusFromApi, mapGoogleSyncResultFromApi } from '../lib/data-mappers';
import { GoogleStatus, GoogleSyncResult } from '../types/models';

export const GoogleService = {
  async getStatus(): Promise<GoogleStatus> {
    return mapGoogleStatusFromApi(await apiClient.get<any>('/google/status'));
  },

  // The browser's zone becomes the calendar's, so 17:00 in CoachHub stays 17:00 in Google.
  async getAuthUrl(): Promise<string> {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const data = await apiClient.post<any>('/google/auth-url', { time_zone: timeZone });
    return data.auth_url;
  },

  async sync(): Promise<GoogleSyncResult> {
    return mapGoogleSyncResultFromApi(await apiClient.post<any>('/google/sync', {}));
  },

  async disconnect(): Promise<GoogleStatus> {
    return mapGoogleStatusFromApi(await apiClient.delete<any>('/google/disconnect'));
  },
};
