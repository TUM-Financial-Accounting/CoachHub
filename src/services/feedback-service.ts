// src/services/feedback-service.ts
import { apiClient } from './api-client';

export type FeedbackType = 'bug' | 'feature' | 'question';
export type FeedbackStatus = 'new' | 'in_progress' | 'resolved';

export interface FeedbackRequest {
  id: string;
  type: FeedbackType;
  title: string;
  description: string;
  screenshot_urls?: string[] | null;
  status: FeedbackStatus;
  created_at: string;
}

export interface FeedbackRequestCreate {
  type: FeedbackType;
  title: string;
  description: string;
  screenshot_urls?: string[] | null;
}

export const FeedbackService = {
  getAll: async (): Promise<FeedbackRequest[]> => {
    return apiClient.get<FeedbackRequest[]>('/feedback');
  },

  create: async (data: FeedbackRequestCreate): Promise<FeedbackRequest> => {
    return apiClient.post<FeedbackRequest>('/feedback', data);
  },
};
