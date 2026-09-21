import { describe, it, expect, vi, afterEach } from 'vitest';
import { getMediaType, resolveMediaUrl, fitInside, loadImageForPdf } from './media';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getMediaType', () => {
  it('recognises uploaded pictures', () => {
    expect(getMediaType('/static/uploads/a.png')).toBe('image');
    expect(getMediaType('http://localhost:8000/static/uploads/a.JPG')).toBe('image');
    expect(getMediaType('/static/uploads/a.webp')).toBe('image');
  });

  it('recognises video and pdf', () => {
    expect(getMediaType('/static/uploads/clip.mp4')).toBe('video');
    expect(getMediaType('/static/uploads/vision.pdf')).toBe('pdf');
  });

  it('sees through query strings and fragments', () => {
    expect(getMediaType('/static/uploads/a.png?v=2#top')).toBe('image');
  });

  it('handles legacy base64 values', () => {
    expect(getMediaType('data:image/png;base64,AAA')).toBe('image');
    expect(getMediaType('data:video/mp4;base64,AAA')).toBe('video');
  });

  it('returns null for nothing at all', () => {
    expect(getMediaType()).toBeNull();
    expect(getMediaType('')).toBeNull();
  });
});

describe('resolveMediaUrl', () => {
  it('leaves absolute and inline sources alone', () => {
    expect(resolveMediaUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
    expect(resolveMediaUrl('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA');
    expect(resolveMediaUrl('blob:http://x/y')).toBe('blob:http://x/y');
  });

  it('prefixes a stored root-relative path with the API base', () => {
    expect(resolveMediaUrl('/static/uploads/a.png')).toMatch(/^https?:\/\/.+\/static\/uploads\/a\.png$/);
  });
});

describe('fitInside', () => {
  it('scales a wide image to the box width', () => {
    expect(fitInside({ width: 400, height: 200 }, { w: 100, h: 100 })).toEqual({ w: 100, h: 50 });
  });

  it('scales a tall image to the box height', () => {
    expect(fitInside({ width: 200, height: 400 }, { w: 100, h: 100 })).toEqual({ w: 50, h: 100 });
  });

  it('never divides by zero on a degenerate image', () => {
    const out = fitInside({ width: 100, height: 0 }, { w: 50, h: 50 });
    expect(Number.isFinite(out.w)).toBe(true);
    expect(Number.isFinite(out.h)).toBe(true);
  });
});

describe('loadImageForPdf', () => {
  it('returns null for anything that is not a picture', async () => {
    await expect(loadImageForPdf(undefined)).resolves.toBeNull();
    await expect(loadImageForPdf('')).resolves.toBeNull();
    await expect(loadImageForPdf('/static/uploads/clip.mp4')).resolves.toBeNull();
    await expect(loadImageForPdf('/static/uploads/vision.pdf')).resolves.toBeNull();
  });

  it('returns null when the file is gone', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(loadImageForPdf('/static/uploads/missing.png')).resolves.toBeNull();
  });

  it('returns null when the request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(loadImageForPdf('/static/uploads/a.png')).resolves.toBeNull();
  });

  it('returns null when the response is not actually an image', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['nope'], { type: 'text/html' }),
    }));
    await expect(loadImageForPdf('/static/uploads/a.png')).resolves.toBeNull();
  });

  it('sends the session cookie so protected uploads resolve', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal('fetch', fetchMock);
    await loadImageForPdf('/static/uploads/a.png');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/static/uploads/a.png'), { credentials: 'include' });
  });
});
