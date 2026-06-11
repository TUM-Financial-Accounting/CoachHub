// src/services/api-client.ts
import { API_BASE_URL, JSON_HEADERS } from '../lib/api-config';

// Request-level logging is dev-only noise; keep production consoles clean.
const DEV = import.meta.env.DEV;

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
    if (DEV) console.log(`[API] Requesting ${endpoint}...`);
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
          // Rapid reload loop — don't reload again; fall through so the
          // 401 is surfaced as a normal request error.
          console.error("[API] Detected rapid reload loop. Stopping.");
        } else {
          sessionStorage.setItem('last_api_reload', now.toString());
          console.warn(`[API] 401 on ${endpoint} - Session likely expired. Clearing local state and reloading.`);
          localStorage.removeItem('isAuthenticated');
          localStorage.removeItem('user');
          localStorage.removeItem('access_token');
          // Clear cached lists too (same as an explicit logout) so the next
          // user on this browser can't see the previous user's data.
          localStorage.removeItem('cache:seasons:v1');
          localStorage.removeItem('cache:teams:v1');
          localStorage.removeItem('activeTeamId');
          localStorage.removeItem('activeSeasonId');
          window.location.reload();
          throw new Error('Session expired. Please log in again.');
        }
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[API] Error on ${endpoint}:`, errorData);
      throw new Error(errorData.detail || `Request failed: ${response.statusText}`);
    }

    // Some endpoints (e.g. DELETE) may respond with 204 / an empty body.
    const text = await response.text();
    const data = (text ? JSON.parse(text) : undefined) as T;
    if (DEV) console.log(`[API] Success on ${endpoint}`);
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

