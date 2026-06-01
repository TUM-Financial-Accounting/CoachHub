// Tiny UUID v4 generator. Prefers the native `crypto.randomUUID()` (Chrome
// 92+, Firefox 95+, Safari 15.4+) and falls back to a Math.random-based v4
// for older browsers / non-secure contexts.
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
