// sessionStorage, not localStorage: the unlock must not outlive the tab.

const KEY = 'admin_token';

interface StoredUnlock {
  token: string;
  expiresAt: number;
}

function read(): StoredUnlock | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUnlock;
    if (!parsed?.token || typeof parsed.expiresAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveAdminUnlock(token: string, expiresInMinutes: number): void {
  try {
    // Expire a minute early so a request never carries a token the server just stopped accepting.
    const lifetime = Math.max(1, expiresInMinutes - 1) * 60_000;
    const entry: StoredUnlock = { token, expiresAt: Date.now() + lifetime };
    sessionStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
  }
}

export function getAdminToken(): string | null {
  const entry = read();
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    clearAdminUnlock();
    return null;
  }
  return entry.token;
}

export function clearAdminUnlock(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
  }
}
