// src/services/feedback-service.ts
import { Feedback } from '../types/models';
import { mapFeedbackFromApi, mapFeedbackToApi } from '../lib/data-mappers';
import { apiClient } from './api-client';

export type FeedbackCreate = Pick<Feedback, 'type' | 'title' | 'description' | 'screenshotUrls'>;

export const FeedbackService = {
  getAll: async (): Promise<Feedback[]> => {
    const data = await apiClient.get<any[]>('/feedback');
    return data.map(mapFeedbackFromApi);
  },

  create: async (data: FeedbackCreate): Promise<Feedback> => {
    return mapFeedbackFromApi(await apiClient.post<any>('/feedback', mapFeedbackToApi(data)));
  },
};
