import { afterEach, beforeEach } from 'vitest';

// Node 22+ ships its own experimental `localStorage` / `sessionStorage`
// globals. When they are present, Vitest's jsdom environment cannot overwrite
// them, so the bare `localStorage` that both the app code and these tests
// resolve is Node's stub — which has no `.clear()` and fails on every call.
// Installing a real in-memory Storage on globalThis *and* window guarantees
// the two always agree, whichever Node version this runs on.
class MemoryStorage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    const value = this.store.get(String(key));
    return value === undefined ? null : value;
  }

  setItem(key: string, value: string): void {
    this.store.set(String(key), String(value));
  }

  removeItem(key: string): void {
    this.store.delete(String(key));
  }

  clear(): void {
    this.store.clear();
  }
}

function install(name: 'localStorage' | 'sessionStorage'): MemoryStorage {
  const storage = new MemoryStorage();
  const targets = [globalThis, (globalThis as any).window].filter(Boolean);

  for (const target of targets) {
    try {
      Object.defineProperty(target, name, {
        configurable: true,
        writable: true,
        value: storage,
      });
    } catch {
      // Non-configurable on this runtime — a plain assignment still wins for
      // the bare-global lookups the app code performs.
      (target as any)[name] = storage;
    }
  }

  return storage;
}

const localStorageStub = install('localStorage');
const sessionStorageStub = install('sessionStorage');

// Nearly everything under test reads or writes browser storage (auth flags,
// cached seasons/teams, the per-account last-selection stash). Wipe both
// stores around every test so ordering can never leak state between them.
function clearStorage() {
  localStorageStub.clear();
  sessionStorageStub.clear();
}

beforeEach(clearStorage);
afterEach(clearStorage);
