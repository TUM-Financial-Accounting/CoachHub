import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DrillCanvas } from '../components/drill/DrillCanvas';
import { CANVAS_W, CANVAS_H, DrillDrawing, parseDrawing } from './drillDrawing';
import type { PdfImage } from './media';

export function drawingToSvg(drawing: DrillDrawing, width = CANVAS_W * 4): string {
  const height = Math.round((width * CANVAS_H) / CANVAS_W);
  return renderToStaticMarkup(createElement(DrillCanvas, { drawing, width, height }));
}

export async function rasterizeDrawing(json?: string | null, width = CANVAS_W * 4): Promise<PdfImage | null> {
  const drawing = parseDrawing(json);
  if (!drawing || drawing.elements.length === 0) return null;
  const height = Math.round((width * CANVAS_H) / CANVAS_W);
  const svg = drawingToSvg(drawing, width);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('svg decode failed'));
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL('image/png'), format: 'PNG', width, height };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
