import { describe, it, expect } from 'vitest';
import { parseDrawing, serializeDrawing, hasDrawing, emptyDrawing, clampPoint, CANVAS_W, CANVAS_H } from './drillDrawing';

describe('parseDrawing', () => {
  it('round-trips a drawing through JSON', () => {
    const d = emptyDrawing();
    d.background = 'half';
    d.elements.push(
      { id: 'a', kind: 'cone', x: 10, y: 20, color: 'magenta' },
      { id: 'b', kind: 'arrow', arrow: 'shot', x: 0, y: 0, x2: 50, y2: 40 },
      { id: 'c', kind: 'goal', x: 150, y: 10, size: 'mini', rotation: 180 },
    );
    expect(parseDrawing(serializeDrawing(d))).toEqual(d);
  });

  it('drops unknown elements and repairs bad values instead of throwing', () => {
    const json = JSON.stringify({
      background: 'space',
      elements: [
        { kind: 'cone', x: 'nope', y: 5, color: 'octarine' },
        { kind: 'laser', x: 1, y: 1 },
        { kind: 'arrow', arrow: 'teleport', x: 1, y: 1 },
        { kind: 'goal', x: 1, y: 1, rotation: 45 },
        null,
      ],
    });
    const d = parseDrawing(json)!;
    expect(d.background).toBe('blank');
    expect(d.elements).toHaveLength(2);
    expect(d.elements[0]).toMatchObject({ kind: 'cone', x: 0, y: 5, color: 'blue' });
    expect(d.elements[1]).toMatchObject({ kind: 'goal', size: 'full', rotation: 0 });
  });

  it('returns null for empty or unreadable input', () => {
    expect(parseDrawing('')).toBeNull();
    expect(parseDrawing(null)).toBeNull();
    expect(parseDrawing('{not json')).toBeNull();
    expect(parseDrawing('{"elements":"x"}')).toBeNull();
  });
});

describe('hasDrawing', () => {
  it('is false for an empty canvas', () => {
    expect(hasDrawing(serializeDrawing(emptyDrawing()))).toBe(false);
    expect(hasDrawing(undefined)).toBe(false);
  });
  it('is true once something is drawn', () => {
    const d = emptyDrawing();
    d.elements.push({ id: 'a', kind: 'ball', x: 1, y: 1, color: 'white' });
    expect(hasDrawing(serializeDrawing(d))).toBe(true);
  });
});

describe('clampPoint', () => {
  it('keeps points inside the canvas', () => {
    expect(clampPoint(-5, 400)).toEqual({ x: 0, y: CANVAS_H });
    expect(clampPoint(999, -1)).toEqual({ x: CANVAS_W, y: 0 });
  });
});
