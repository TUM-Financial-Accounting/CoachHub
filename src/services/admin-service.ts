import { apiClient } from './api-client';
import { saveAdminUnlock } from '../lib/adminUnlock';
import { mapAdminFeedbackFromApi, mapAdminUserFromApi, mapAdminStatsFromApi } from '../lib/data-mappers';
import { AdminFeedbackItem, AdminUser, AdminStats } from '../types/models';

export const AdminService = {
  unlock: async (code: string): Promise<void> => {
    const data = await apiClient.post<any>('/admin/unlock', { code });
    saveAdminUnlock(data.admin_token, data.expires_in_minutes ?? 30);
  },

  getStats: async (): Promise<AdminStats> => {
    const data = await apiClient.get<any>('/admin/stats');
    return mapAdminStatsFromApi(data);
  },

  getUsers: async (): Promise<AdminUser[]> => {
    const data = await apiClient.get<any[]>('/admin/users');
    return data.map(mapAdminUserFromApi);
  },

  getFeedback: async (): Promise<AdminFeedbackItem[]> => {
    const data = await apiClient.get<any[]>('/admin/feedback');
    return data.map(mapAdminFeedbackFromApi);
  },

  updateFeedbackStatus: async (id: string, status: AdminFeedbackItem['status']): Promise<AdminFeedbackItem> => {
    const data = await apiClient.put<any>(`/admin/feedback/${id}/status`, { status });
    return mapAdminFeedbackFromApi(data);
  },
};
