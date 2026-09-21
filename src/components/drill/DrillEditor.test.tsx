import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import i18n from '../../i18n';
import DrillEditor from './DrillEditor';
import { parseDrawing } from '../../lib/drillDrawing';

let container: HTMLDivElement;
let root: Root;
let applied: string | null;

const svg = () => document.querySelector('svg[viewBox="0 0 300 200"]') as SVGSVGElement;
const button = (label: string) =>
  (document.querySelector(`button[title="${label}"]`)
    ?? Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === label)) as HTMLButtonElement;

// jsdom has no layout; pin the canvas to 600x400 so canvas units = px / 2.
const mockRect = () => {
  svg().getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 400, right: 600, bottom: 400, x: 0, y: 0, toJSON: () => ({}) });
};

// jsdom has no PointerEvent; a MouseEvent carrying pointerId is enough for React.
class FakePointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: MouseEventInit & { pointerId?: number }) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

const pointer = (target: Element, type: string, x: number, y: number) =>
  act(() => {
    target.dispatchEvent(new FakePointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, pointerId: 1 }));
  });

const mount = (initial?: string) => {
  applied = null;
  act(() => {
    root.render(<DrillEditor isOpen initial={initial} onClose={() => {}} onApply={json => { applied = json; }} />);
  });
  mockRect();
};

beforeEach(async () => {
  await i18n.changeLanguage('en');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  Element.prototype.setPointerCapture = vi.fn();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('DrillEditor', () => {
  it('places a cone where the canvas is clicked', () => {
    mount();
    act(() => button('Cone').click());
    pointer(svg(), 'pointerdown', 120, 80);
    pointer(svg(), 'pointerup', 120, 80);
    act(() => button('Apply').click());
    const d = parseDrawing(applied)!;
    expect(d.elements).toHaveLength(1);
    expect(d.elements[0]).toMatchObject({ kind: 'cone', x: 60, y: 40, color: 'blue' });
  });

  it('draws an arrow by dragging and drops one that is too short', () => {
    mount();
    act(() => button('Pass').click());
    pointer(svg(), 'pointerdown', 100, 100);
    pointer(svg(), 'pointermove', 300, 200);
    pointer(svg(), 'pointerup', 300, 200);
    pointer(svg(), 'pointerdown', 10, 10);
    pointer(svg(), 'pointerup', 12, 12);
    act(() => button('Apply').click());
    const d = parseDrawing(applied)!;
    expect(d.elements).toHaveLength(1);
    expect(d.elements[0]).toMatchObject({ kind: 'arrow', arrow: 'pass', x: 50, y: 50, x2: 150, y2: 100 });
  });

  it('moves an existing element and undoes the move', () => {
    const initial = JSON.stringify({ version: 1, background: 'blank', elements: [{ id: 'p', kind: 'player', x: 50, y: 50, color: 'blue', label: '7' }] });
    mount(initial);
    const player = svg().querySelector('g[style*="cursor"]')!;
    pointer(player, 'pointerdown', 100, 100);
    pointer(svg(), 'pointermove', 160, 140);
    pointer(svg(), 'pointerup', 160, 140);
    expect(button('Undo').disabled).toBe(false);
    act(() => button('Apply').click());
    expect(parseDrawing(applied)!.elements[0]).toMatchObject({ x: 80, y: 70 });

    act(() => button('Undo').click());
    act(() => button('Apply').click());
    expect(parseDrawing(applied)!.elements[0]).toMatchObject({ x: 50, y: 50 });
  });

  it('applies the active colour to a selected element', () => {
    mount();
    act(() => button('Ball').click());
    pointer(svg(), 'pointerdown', 50, 50);
    pointer(svg(), 'pointerup', 50, 50);
    act(() => button('Magenta').click());
    act(() => button('Apply').click());
    expect(parseDrawing(applied)!.elements[0]).toMatchObject({ kind: 'ball', color: 'magenta' });
  });
});
