import { describe, it, expect } from 'vitest';
import { drawingToSvg } from './drillRaster';
import { emptyDrawing } from './drillDrawing';

describe('drawingToSvg', () => {
  it('produces a standalone SVG document with every element kind', () => {
    const d = emptyDrawing();
    d.background = 'pitch';
    d.elements.push(
      { id: '1', kind: 'cone', x: 10, y: 10, color: 'blue' },
      { id: '2', kind: 'player', x: 20, y: 20, color: 'magenta', label: '7' },
      { id: '3', kind: 'coach', x: 30, y: 30 },
      { id: '4', kind: 'figure', x: 40, y: 40, color: 'yellow' },
      { id: '5', kind: 'pole', x: 50, y: 50, color: 'yellow' },
      { id: '6', kind: 'ball', x: 60, y: 60, color: 'white' },
      { id: '7', kind: 'zone', x: 70, y: 70, w: 40, h: 30, color: 'blue' },
      { id: '8', kind: 'goal', x: 150, y: 10, size: 'full', rotation: 0 },
      { id: '9', kind: 'arrow', arrow: 'run', x: 10, y: 100, x2: 80, y2: 120 },
      { id: '10', kind: 'arrow', arrow: 'dribble', x: 10, y: 110, x2: 80, y2: 130 },
      { id: '11', kind: 'arrow', arrow: 'pass', x: 10, y: 120, x2: 80, y2: 140 },
      { id: '12', kind: 'arrow', arrow: 'shot', x: 10, y: 130, x2: 80, y2: 150 },
      { id: '13', kind: 'text', x: 100, y: 180, text: 'Rondo 4v2' },
    );
    const svg = drawingToSvg(d, 600);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="600"');
    expect(svg).toContain('height="400"');
    expect(svg).toContain('Rondo 4v2');
    expect(svg).toContain('>7</text>');
    expect((svg.match(/<marker /g) ?? []).length).toBe(4);
  });
});
