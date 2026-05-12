// src/lib/api-config.ts

/**
 * The base URL for the backend API. 
 * Reads from environment variables if deployed, falls back to localhost for dev.
 */
const getApiBaseUrl = () => {
  let url = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  url = url.replace(/\/$/, ''); // Remove trailing slash
  
  // Force HTTPS if the current page is HTTPS and it's not localhost
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && !url.includes('localhost')) {
    url = url.replace('http://', 'https://');
  }
  
  return url;
};

export const API_BASE_URL = getApiBaseUrl();

export const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};
