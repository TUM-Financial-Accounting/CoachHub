// src/services/api-client.ts
import { API_BASE_URL, JSON_HEADERS } from '../lib/api-config';

/**
 * Generic API client for the application.
 * Uses 'credentials: include' to support HttpOnly cookies.
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000); // 10s timeout
  
  const token = localStorage.getItem('access_token');
  
  const headers: Record<string, string> = {
    ...JSON_HEADERS,
    ...options.headers as Record<string, string>,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    console.log(`[API] Requesting ${endpoint}...`);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', 
      signal: controller.signal,
    });
    
    clearTimeout(id);

    if (response.status === 401) {
      const wasAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
      if (wasAuthenticated && endpoint !== '/login' && endpoint !== '/register') {
        const lastReload = sessionStorage.getItem('last_api_reload');
        const now = Date.now();
        
        if (lastReload && (now - parseInt(lastReload)) < 5000) {
          console.error("[API] Detected rapid reload loop. Stopping.");
          return response.json(); // Don't reload, just return the 401
        }
        
        sessionStorage.setItem('last_api_reload', now.toString());
        console.warn(`[API] 401 on ${endpoint} - Session likely expired. Clearing local state and reloading.`);
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
        localStorage.removeItem('access_token');
        window.location.reload(); 
        throw new Error('Session expired. Please log in again.');
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[API] Error on ${endpoint}:`, errorData);
      throw new Error(errorData.detail || `Request failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[API] Success on ${endpoint}`);
    return data;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    console.error(`[API] Fatal error on ${endpoint}:`, error);
    throw error;
  }
}

export const apiClient = {
  get<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint);
  },

  post<T>(endpoint: string, body: any): Promise<T> {
    return request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  put<T>(endpoint: string, body: any): Promise<T> {
    return request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  delete(endpoint: string): Promise<void> {
    return request<void>(endpoint, {
      method: 'DELETE',
    });
  }
};

