// src/services/auth-service.ts
import { apiClient } from './api-client';

export interface AuthResponse {
  message: string;
  access_token: string;
  user: {
    email: string;
    full_name: string;
  };
}

export const AuthService = {
  /**
   * Logs in a user.
   */
  async login(payload: any): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/login', payload);
  },

  /**
   * Registers a new user.
   */
  async register(payload: any): Promise<any> {
    return apiClient.post<any>('/register', payload);
  },

  /**
   * Logs out the user (clears backend cookie).
   */
  async logout(): Promise<void> {
    return apiClient.post('/logout', {});
  },

  /**
   * Fetches the current user's profile from the /me endpoint.
   * This also serves as a session check.
   */
  async getCurrentUser(): Promise<any> {
    return apiClient.get('/me');
  },

  /**
   * Requests a password reset email.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    return apiClient.post('/forgot-password', { email });
  },

  /**
   * Resets the password using a token.
   */
  async resetPassword(payload: any): Promise<{ message: string }> {
    return apiClient.post('/reset-password', payload);
  }
};
