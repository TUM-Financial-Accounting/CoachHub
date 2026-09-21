import { API_BASE_URL } from './api-config';

export type MediaType = 'image' | 'video' | 'pdf' | 'other' | null;

export const resolveMediaUrl = (url: string): string =>
  url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')
    ? url
    : `${API_BASE_URL}${url}`;

export const getMediaType = (url?: string): MediaType => {
  if (!url) return null;
  const normalized = url.toLowerCase();
  const clean = normalized.split('#')[0].split('?')[0];

  if (normalized.startsWith('data:image') || /\.(jpe?g|gif|png|webp)$/.test(clean)) return 'image';
  if (normalized.startsWith('data:video') || /\.(mp4|webm|ogg|ogv|mov|m4v|mkv)$/.test(clean)) return 'video';
  if (normalized.startsWith('data:application/pdf') || clean.endsWith('.pdf')) return 'pdf';
  return 'other';
};

export interface PdfImage {
  dataUrl: string;
  format: 'PNG' | 'JPEG';
  width: number;
  height: number;
}

const readAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const loadImageElement = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode failed'));
    img.src = src;
  });

// Never throws: a missing picture must not fail an export. WebP and GIF are re-encoded to PNG for jsPDF.
export async function loadImageForPdf(url?: string): Promise<PdfImage | null> {
  if (!url || getMediaType(url) !== 'image') return null;

  try {
    let dataUrl: string;
    if (url.startsWith('data:')) {
      dataUrl = url;
    } else {
      const response = await fetch(resolveMediaUrl(url), { credentials: 'include' });
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) return null;
      dataUrl = await readAsDataUrl(blob);
    }

    const img = await loadImageElement(dataUrl);
    if (!img.naturalWidth || !img.naturalHeight) return null;

    const mime = dataUrl.slice(5, dataUrl.indexOf(';'));
    if (mime === 'image/jpeg' || mime === 'image/jpg') {
      return { dataUrl, format: 'JPEG', width: img.naturalWidth, height: img.naturalHeight };
    }
    if (mime === 'image/png') {
      return { dataUrl, format: 'PNG', width: img.naturalWidth, height: img.naturalHeight };
    }

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return {
      dataUrl: canvas.toDataURL('image/png'),
      format: 'PNG',
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
  } catch {
    return null;
  }
}

export function fitInside(image: { width: number; height: number }, box: { w: number; h: number }): { w: number; h: number } {
  const ratio = image.width / Math.max(1, image.height);
  let w = box.w;
  let h = w / ratio;
  if (h > box.h) { h = box.h; w = h * ratio; }
  return { w, h };
}
