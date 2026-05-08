// src/lib/api-config.ts

/**
 * The base URL for the backend API. 
 * Reads from environment variables if deployed, falls back to localhost for dev.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const JSON_HEADERS = {
  'Content-Type': 'application/json',
};
