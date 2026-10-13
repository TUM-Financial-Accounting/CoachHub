import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from './api-client';
import { API_BASE_URL } from '../lib/api-config';

/** Minimal stand-in for the parts of Response the client actually touches. */
function response(status: number, body?: unknown, statusText = 'Error') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => {
      if (body === undefined) throw new SyntaxError('Unexpected end of JSON input');
      return body;
    },
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  // jsdom logs "Not implemented: navigation" when the 401 path reloads.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The last RequestInit the client passed to fetch. */
function lastInit(): RequestInit & { headers: Record<string, string> } {
  return fetchMock.mock.calls.at(-1)![1];
}

describe('request construction', () => {
  it('prefixes the endpoint with the configured base URL', async () => {
    fetchMock.mockResolvedValue(response(200, [{ id: 't1' }]));

    await apiClient.get('/teams');

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/teams`);
  });

  it('sends cookies so the HttpOnly session cookie reaches the API', async () => {
    fetchMock.mockResolvedValue(response(200, {}));

    await apiClient.get('/me');

    expect(lastInit().credentials).toBe('include');
  });

  it('sends JSON and cache-busting headers', async () => {
    fetchMock.mockResolvedValue(response(200, {}));

    await apiClient.get('/me');

    expect(lastInit().headers).toMatchObject({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
  });

  it('attaches the bearer token when one is stored', async () => {
    localStorage.setItem('access_token', 'jwt-123');
    fetchMock.mockResolvedValue(response(200, {}));

    await apiClient.get('/me');

    expect(lastInit().headers.Authorization).toBe('Bearer jwt-123');
  });

  it('omits the Authorization header when there is no token', async () => {
    fetchMock.mockResolvedValue(response(200, {}));

    await apiClient.get('/me');

    expect(lastInit().headers).not.toHaveProperty('Authorization');
  });

  it('cannot have its cache headers overridden by a caller', async () => {
    fetchMock.mockResolvedValue(response(200, {}));

    // The spread order in the client puts the no-cache headers last on purpose.
    await apiClient.post('/seasons', { name: '25/26' });

    expect(lastInit().headers['Cache-Control']).toBe('no-cache, no-store, must-revalidate');
  });

  it('passes an abort signal so the 10s timeout can fire', async () => {
    fetchMock.mockResolvedValue(response(200, {}));

    await apiClient.get('/me');

    expect(lastInit().signal).toBeInstanceOf(AbortSignal);
  });
});

describe('verbs', () => {
  it('POSTs a JSON-encoded body', async () => {
    fetchMock.mockResolvedValue(response(200, { id: 's1' }));

    const result = await apiClient.post<{ id: string }>('/seasons', { name: '25/26' });

    expect(lastInit().method).toBe('POST');
    expect(lastInit().body).toBe('{"name":"25/26"}');
    expect(result).toEqual({ id: 's1' });
  });

  it('PUTs a JSON-encoded body', async () => {
    fetchMock.mockResolvedValue(response(200, { id: 't1' }));

    await apiClient.put('/teams/t1', { name: 'U17' });

    expect(lastInit().method).toBe('PUT');
    expect(lastInit().body).toBe('{"name":"U17"}');
  });

  it('DELETEs without a body', async () => {
    fetchMock.mockResolvedValue(response(200, { message: 'Deleted' }));

    await apiClient.delete('/teams/t1');

    expect(lastInit().method).toBe('DELETE');
    expect(lastInit().body).toBeUndefined();
  });
});

describe('response handling', () => {
  it('resolves to undefined for an empty 204 body instead of throwing on JSON.parse', async () => {
    fetchMock.mockResolvedValue(response(204));

    await expect(apiClient.delete('/matches/m1')).resolves.toBeUndefined();
  });

  it('surfaces the backend detail message on an error status', async () => {
    fetchMock.mockResolvedValue(response(404, { detail: 'Team not found' }));

    await expect(apiClient.get('/teams/nope')).rejects.toThrow('Team not found');
  });

  it('falls back to the status text when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(response(500, undefined, 'Internal Server Error'));

    await expect(apiClient.get('/teams')).rejects.toThrow('Request failed: Internal Server Error');
  });

  it('translates an aborted request into a readable timeout error', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));

    await expect(apiClient.get('/teams')).rejects.toThrow('Request timed out. Please check your connection.');
  });

  it('propagates a network failure unchanged', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(apiClient.get('/teams')).rejects.toThrow('Failed to fetch');
  });
});

describe('401 handling', () => {
  function signedIn() {
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('user', JSON.stringify({ email: 'coach@club.de' }));
    localStorage.setItem('access_token', 'jwt-123');
    localStorage.setItem('cache:seasons:v1', '[]');
    localStorage.setItem('cache:teams:v1', '[]');
    localStorage.setItem('cache:teams:v2', '[]');
    localStorage.setItem('activeSeasonId', 'season-1');
    localStorage.setItem('activeTeamId', 'team-1');
  }

  it('clears the whole session — including cached lists — on an expired token', async () => {
    signedIn();
    fetchMock.mockResolvedValue(response(401, { detail: 'Invalid or expired token' }));

    await expect(apiClient.get('/teams')).rejects.toThrow('Session expired. Please log in again.');

    // Leaving the caches behind let the next coach on a shared browser see the
    // previous coach's seasons and teams during first paint.
    for (const key of [
      'isAuthenticated',
      'user',
      'access_token',
      'cache:seasons:v1',
      'cache:teams:v1',
      'cache:teams:v2',
      'activeSeasonId',
      'activeTeamId',
    ]) {
      expect(localStorage.getItem(key)).toBeNull();
    }
  });

  it('stashes the active season and team before clearing them', async () => {
    signedIn();
    fetchMock.mockResolvedValue(response(401, { detail: 'expired' }));

    await expect(apiClient.get('/teams')).rejects.toThrow();

    expect(JSON.parse(localStorage.getItem('lastSelection:coach@club.de')!)).toEqual({
      seasonId: 'season-1',
      teamId: 'team-1',
    });
  });

  it('records the reload timestamp so a loop can be detected', async () => {
    signedIn();
    fetchMock.mockResolvedValue(response(401, { detail: 'expired' }));

    await expect(apiClient.get('/teams')).rejects.toThrow();

    expect(sessionStorage.getItem('last_api_reload')).not.toBeNull();
  });

  it('does not reload again inside the 5s guard window — it surfaces the error instead', async () => {
    signedIn();
    sessionStorage.setItem('last_api_reload', String(Date.now()));
    fetchMock.mockResolvedValue(response(401, { detail: 'Invalid or expired token' }));

    // Falls through to the normal !response.ok path rather than looping.
    await expect(apiClient.get('/teams')).rejects.toThrow('Invalid or expired token');
    expect(localStorage.getItem('isAuthenticated')).toBe('true');
  });

  it('reloads again once the guard window has elapsed', async () => {
    signedIn();
    sessionStorage.setItem('last_api_reload', String(Date.now() - 6000));
    fetchMock.mockResolvedValue(response(401, { detail: 'expired' }));

    await expect(apiClient.get('/teams')).rejects.toThrow('Session expired. Please log in again.');
  });

  it('leaves a failed login alone — bad credentials are not an expired session', async () => {
    signedIn();
    fetchMock.mockResolvedValue(response(401, { detail: 'Invalid email or password' }));

    await expect(apiClient.post('/login', { email: 'a', password: 'b' }))
      .rejects.toThrow('Invalid email or password');
    expect(localStorage.getItem('isAuthenticated')).toBe('true');
  });

  it('leaves a failed registration alone', async () => {
    signedIn();
    fetchMock.mockResolvedValue(response(401, { detail: 'nope' }));

    await expect(apiClient.post('/register', {})).rejects.toThrow('nope');
    expect(localStorage.getItem('isAuthenticated')).toBe('true');
  });

  it('does not wipe storage for a 401 when the user was never signed in', async () => {
    fetchMock.mockResolvedValue(response(401, { detail: 'Not authenticated' }));

    await expect(apiClient.get('/me')).rejects.toThrow('Not authenticated');
    expect(sessionStorage.getItem('last_api_reload')).toBeNull();
  });
});
