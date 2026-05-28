// Tiny localStorage-backed cache for page-level data (players, training,
// matches, …). Pages call `readPageCache` for instant first-paint, then
// fire their normal fetch and call `writePageCache` with the result.
//
// Cache keys are namespaced so they're easy to clear on logout.

const PREFIX = 'cache:page:';

export function readPageCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writePageCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or disabled — ignore. The page still works, it's just
    // not faster on next visit.
  }
}

/** Wipe every page cache entry. Call on logout. */
export function clearAllPageCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
