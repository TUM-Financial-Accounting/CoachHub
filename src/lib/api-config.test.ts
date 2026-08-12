import { describe, it, expect, vi, afterEach } from 'vitest';

// API_BASE_URL is computed once at module load, so each case needs a fresh
// module registry with the env var already in place.
async function loadBaseUrl() {
  vi.resetModules();
  return (await import('./api-config')).API_BASE_URL;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('API_BASE_URL', () => {
  it('falls back to the local backend when VITE_API_URL is unset', async () => {
    vi.stubEnv('VITE_API_URL', '');
    expect(await loadBaseUrl()).toBe('http://localhost:8000');
  });

  it('uses VITE_API_URL when provided', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com');
    expect(await loadBaseUrl()).toBe('https://api.example.com');
  });

  it('strips a single trailing slash so endpoints do not produce a double slash', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com/');
    expect(await loadBaseUrl()).toBe('https://api.example.com');
  });
});

describe('JSON_HEADERS', () => {
  it('declares JSON in both directions', async () => {
    const { JSON_HEADERS } = await import('./api-config');
    expect(JSON_HEADERS).toEqual({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });
  });
});
