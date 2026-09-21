import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MousePointer2, Undo2, Trash2, RotateCw, Eraser, Type } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { DrillCanvas, ARROW_STYLE } from './DrillCanvas';
import {
  CANVAS_W, CANVAS_H, DRILL_PALETTE, DRILL_COLOR_KEYS, DrillColor, DrillDrawing, DrillElement,
  DrillBackground, ArrowKind, Rotation, clampPoint, emptyDrawing, nextElementId, parseDrawing, serializeDrawing,
} from '../../lib/drillDrawing';

type Tool = 'select' | 'cone' | 'player' | 'coach' | 'figure' | 'pole' | 'ball' | 'zone' | 'goal' | 'miniGoal' | 'text' | ArrowKind;

const TOOL_GROUPS: { labelKey: string; tools: Tool[] }[] = [
  { labelKey: 'drill.groupMaterial', tools: ['cone', 'ball', 'pole', 'zone', 'goal', 'miniGoal'] },
  { labelKey: 'drill.groupPlayers', tools: ['player', 'coach', 'figure'] },
  { labelKey: 'drill.groupPaths', tools: ['run', 'dribble', 'pass', 'shot'] },
];

const COLORABLE = new Set<Tool>(['cone', 'player', 'figure', 'pole', 'ball', 'zone']);
const ARROW_TOOLS = new Set<Tool>(['run', 'dribble', 'pass', 'shot']);

interface DragState {
  mode: 'move' | 'create' | 'handle';
  id: string;
  startX: number;
  startY: number;
  origin: DrillElement;
  handle?: 'start' | 'end';
  moved: boolean;
  lastX?: number;
  lastY?: number;
}

function ToolIcon({ tool, color }: { tool: Tool; color: DrillColor }) {
  const c = DRILL_PALETTE[color];
  const ink = DRILL_PALETTE.black;
  if (tool === 'select') return <MousePointer2 size={16} />;
  if (tool === 'text') return <Type size={16} />;
  if (ARROW_TOOLS.has(tool)) {
    const s = ARROW_STYLE[tool as ArrowKind];
    return (
      <svg viewBox="0 0 24 12" width="26" height="13">
        <line x1="1" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth={s.width} strokeDasharray={s.dash} strokeLinecap={tool === 'dribble' ? 'round' : 'butt'} />
        <path d="M17 2 L23 6 L17 10 Z" fill="currentColor" />
        {s.dot && <circle cx="2" cy="6" r="2" fill="currentColor" />}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" width="18" height="18">
      {tool === 'cone' && <path d="M10 3 L4 16 H16 Z" fill={c} stroke={ink} strokeWidth="1" strokeLinejoin="round" />}
      {tool === 'ball' && <circle cx="10" cy="10" r="4.5" fill={c} stroke={ink} strokeWidth="1" />}
      {tool === 'pole' && <rect x="8" y="2" width="4" height="16" rx="2" fill={c} stroke={ink} strokeWidth="0.8" />}
      {tool === 'zone' && <rect x="2" y="4" width="16" height="12" fill={c} fillOpacity="0.15" stroke={c} strokeWidth="1.5" />}
      {tool === 'goal' && <path d="M2 16 V5 H18 V16" fill="none" stroke="#2B6CB0" strokeWidth="2" />}
      {tool === 'miniGoal' && <path d="M5 15 V8 H15 V15" fill="none" stroke="#2B6CB0" strokeWidth="1.8" />}
      {tool === 'player' && <circle cx="10" cy="10" r="6" fill={c} stroke={ink} strokeWidth="1" />}
      {tool === 'coach' && (<><circle cx="10" cy="10" r="7" fill="#fff" stroke={ink} strokeWidth="1.2" /><text x="10" y="13.5" textAnchor="middle" fontSize="9" fontWeight="700" fill={ink} fontFamily="sans-serif">C</text></>)}
      {tool === 'figure' && (<g stroke={ink} strokeWidth="0.9" strokeLinecap="round"><circle cx="10" cy="4.5" r="2.5" fill={c} /><rect x="7" y="7.5" width="6" height="6" fill={c} /><path d="M7 8.5 L4 12 M13 8.5 L16 12 M8.5 13.5 V18 M11.5 13.5 V18" fill="none" /></g>)}
    </svg>
  );
}

interface DrillEditorProps {
  isOpen: boolean;
  initial?: string | null;
  onClose: () => void;
  onApply: (json: string) => void;
}

export default function DrillEditor({ isOpen, initial, onClose, onApply }: DrillEditorProps) {
  const { t } = useTranslation();
  const [drawing, setDrawing] = useState<DrillDrawing>(emptyDrawing);
  const [history, setHistory] = useState<DrillDrawing[]>([]);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState<DrillColor>('blue');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<DragState | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDrawing(parseDrawing(initial) ?? emptyDrawing());
    setHistory([]);
    setTool('select');
    setSelectedId(null);
    drag.current = null;
  }, [isOpen, initial]);

  const selected = drawing.elements.find(e => e.id === selectedId) ?? null;

  const pushHistory = useCallback(() => {
    setHistory(h => [...h.slice(-49), drawing]);
  }, [drawing]);

  const commit = (updater: (d: DrillDrawing) => DrillDrawing, record = true) => {
    if (record) pushHistory();
    setDrawing(updater);
  };

  const updateElement = (id: string, patch: Partial<DrillElement>, record = true) =>
    commit(d => ({ ...d, elements: d.elements.map(e => (e.id === id ? ({ ...e, ...patch } as DrillElement) : e)) }), record);

  const removeSelected = () => {
    if (!selectedId) return;
    commit(d => ({ ...d, elements: d.elements.filter(e => e.id !== selectedId) }));
    setSelectedId(null);
  };

  const undo = () => {
    setHistory(h => {
      if (h.length === 0) return h;
      setDrawing(h[h.length - 1]);
      return h.slice(0, -1);
    });
    setSelectedId(null);
  };

  const capture = (pointerId: number) => {
    try { svgRef.current?.setPointerCapture(pointerId); } catch { /* synthetic or already-released pointer */ }
  };

  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return { x: 0, y: 0 };
    return clampPoint(((e.clientX - rect.left) / rect.width) * CANVAS_W, ((e.clientY - rect.top) / rect.height) * CANVAS_H);
  };

  const makeElement = (kind: Tool, x: number, y: number): DrillElement | null => {
    const id = nextElementId();
    switch (kind) {
      case 'cone':   return { id, kind: 'cone', x, y, color };
      case 'player': return { id, kind: 'player', x, y, color, label: '' };
      case 'coach':  return { id, kind: 'coach', x, y };
      case 'figure': return { id, kind: 'figure', x, y, color };
      case 'pole':   return { id, kind: 'pole', x, y, color };
      case 'ball':   return { id, kind: 'ball', x, y, color };
      case 'goal':   return { id, kind: 'goal', x, y, size: 'full', rotation: 0 };
      case 'miniGoal': return { id, kind: 'goal', x, y, size: 'mini', rotation: 0 };
      case 'text':   return { id, kind: 'text', x, y, text: t('drill.textDefault') };
      case 'zone':   return { id, kind: 'zone', x, y, w: 0, h: 0, color };
      case 'run': case 'dribble': case 'pass': case 'shot':
        return { id, kind: 'arrow', arrow: kind, x, y, x2: x, y2: y };
      default: return null;
    }
  };

  const onCanvasPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const p = toCanvas(e);
    if (tool === 'select') { setSelectedId(null); return; }
    const el = makeElement(tool, p.x, p.y);
    if (!el) return;
    commit(d => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
    if (tool === 'zone' || ARROW_TOOLS.has(tool)) {
      capture(e.pointerId);
      drag.current = { mode: 'create', id: el.id, startX: p.x, startY: p.y, origin: el, moved: false };
    }
  };

  const onElementPointerDown = (e: React.PointerEvent, el: DrillElement) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedId(el.id);
    capture(e.pointerId);
    const p = toCanvas(e);
    drag.current = { mode: 'move', id: el.id, startX: p.x, startY: p.y, origin: el, moved: false };
  };

  const onHandlePointerDown = (e: React.PointerEvent, el: DrillElement, handle: 'start' | 'end') => {
    capture(e.pointerId);
    const p = toCanvas(e);
    drag.current = { mode: 'handle', id: el.id, startX: p.x, startY: p.y, origin: el, handle, moved: false };
  };

  const onCanvasPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = toCanvas(e);
    const record = !d.moved && d.mode !== 'create';
    d.moved = true;
    const o = d.origin;

    if (d.mode === 'create') {
      d.lastX = p.x;
      d.lastY = p.y;
      if (o.kind === 'zone') {
        updateElement(d.id, { x: Math.min(d.startX, p.x), y: Math.min(d.startY, p.y), w: Math.abs(p.x - d.startX), h: Math.abs(p.y - d.startY) } as Partial<DrillElement>, false);
      } else if (o.kind === 'arrow') {
        updateElement(d.id, { x2: p.x, y2: p.y } as Partial<DrillElement>, false);
      }
      return;
    }
    if (d.mode === 'handle' && o.kind === 'arrow') {
      updateElement(d.id, (d.handle === 'start' ? { x: p.x, y: p.y } : { x2: p.x, y2: p.y }) as Partial<DrillElement>, record);
      return;
    }
    const dx = p.x - d.startX;
    const dy = p.y - d.startY;
    if (o.kind === 'arrow') {
      const a = clampPoint(o.x + dx, o.y + dy);
      const b = clampPoint(o.x2 + dx, o.y2 + dy);
      updateElement(d.id, { x: a.x, y: a.y, x2: b.x, y2: b.y } as Partial<DrillElement>, record);
    } else if (o.kind === 'zone') {
      const x = Math.min(CANVAS_W - o.w, Math.max(0, o.x + dx));
      const y = Math.min(CANVAS_H - o.h, Math.max(0, o.y + dy));
      updateElement(d.id, { x, y } as Partial<DrillElement>, record);
    } else {
      updateElement(d.id, clampPoint(o.x + dx, o.y + dy) as Partial<DrillElement>, record);
    }
  };

  // A click with a drag tool leaves a zero-size element behind; drop it.
  const onCanvasPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.mode !== 'create') return;
    const dx = Math.abs((d.lastX ?? d.startX) - d.startX);
    const dy = Math.abs((d.lastY ?? d.startY) - d.startY);
    const tooSmall = d.origin.kind === 'zone' ? dx < 6 || dy < 6 : Math.hypot(dx, dy) < 6;
    if (!tooSmall) return;
    setSelectedId(null);
    setDrawing(cur => ({ ...cur, elements: cur.elements.filter(e => e.id !== d.id) }));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); removeSelected(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    else if (e.key === 'Escape') { setTool('select'); setSelectedId(null); }
  };

  const pickColor = (c: DrillColor) => {
    setColor(c);
    if (selected && 'color' in selected) updateElement(selected.id, { color: c } as Partial<DrillElement>);
  };

  const rotateGoal = () => {
    if (selected?.kind !== 'goal') return;
    updateElement(selected.id, { rotation: ((selected.rotation + 90) % 360) as Rotation } as Partial<DrillElement>);
  };

  const toolButton = (tl: Tool) => (
    <button
      key={tl}
      type="button"
      title={t(`drill.tool.${tl}`)}
      onClick={() => { setTool(tl); setSelectedId(null); }}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
        tool === tl ? 'bg-primary/10 border-primary/50 text-primary' : 'bg-surface border-border text-muted hover:text-foreground hover:border-primary/30'
      }`}
    >
      <span className="w-7 flex justify-center text-foreground"><ToolIcon tool={tl} color={COLORABLE.has(tl) ? color : 'blue'} /></span>
      <span className="truncate">{t(`drill.tool.${tl}`)}</span>
    </button>
  );

  const footer = (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" onClick={undo} disabled={history.length === 0} icon={<Undo2 size={16} />} className="px-3 py-2">{t('drill.undo')}</Button>
      <Button variant="ghost" onClick={() => { commit(d => ({ ...d, elements: [] })); setSelectedId(null); }} disabled={drawing.elements.length === 0} icon={<Eraser size={16} />} className="px-3 py-2">{t('drill.clear')}</Button>
      <div className="flex-1" />
      <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button onClick={() => onApply(serializeDrawing(drawing))}>{t('drill.apply')}</Button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? t('drill.edit') : t('drill.title')} maxWidth="max-w-5xl" footer={footer}>
      <div ref={rootRef} tabIndex={0} onKeyDown={onKeyDown} className="flex flex-col lg:flex-row gap-5 outline-none">
        <div className="w-full lg:w-72 flex-shrink-0 space-y-4">
          <div className="grid grid-cols-2 gap-1.5">
            {toolButton('select')}
            {toolButton('text')}
          </div>

          <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest px-1 mb-1.5">{t('drill.color')}</p>
            <div className="flex flex-wrap gap-1.5 px-1">
              {DRILL_COLOR_KEYS.map(c => (
                <button
                  key={c}
                  type="button"
                  title={t(`drill.colors.${c}`)}
                  onClick={() => pickColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'border-primary scale-110' : 'border-border'}`}
                  style={{ background: DRILL_PALETTE[c] }}
                />
              ))}
            </div>
          </div>

          {TOOL_GROUPS.map(group => (
            <div key={group.labelKey}>
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest px-1 mb-1.5">{t(group.labelKey)}</p>
              <div className="grid grid-cols-2 gap-1.5">{group.tools.map(toolButton)}</div>
            </div>
          ))}

          <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest px-1 mb-1.5">{t('drill.background')}</p>
            <div className="flex gap-1.5">
              {(['blank', 'pitch', 'half'] as DrillBackground[]).map(bg => (
                <button
                  key={bg}
                  type="button"
                  onClick={() => commit(d => ({ ...d, background: bg }))}
                  className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] font-semibold ${drawing.background === bg ? 'bg-primary/10 border-primary/50 text-primary' : 'bg-surface border-border text-muted hover:text-foreground'}`}
                >
                  {t(`drill.bg.${bg}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div className="rounded-xl border border-border overflow-hidden shadow-inner">
            <DrillCanvas
              drawing={drawing}
              selectedId={selectedId}
              interactive
              svgRef={svgRef}
              className="w-full h-auto block"
              onPointerDown={onCanvasPointerDown}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp}
              onElementPointerDown={onElementPointerDown}
              onHandlePointerDown={onHandlePointerDown}
            />
          </div>

          <div className="min-h-[52px] bg-surface-hover border border-border rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-3 text-xs">
            {selected ? (
              <>
                <span className="font-bold text-foreground uppercase tracking-wider text-[10px]">
                  {t(`drill.tool.${selected.kind === 'arrow' ? selected.arrow : selected.kind === 'goal' && selected.size === 'mini' ? 'miniGoal' : selected.kind}`)}
                </span>
                {selected.kind === 'player' && (
                  <label className="flex items-center gap-2 text-muted">
                    {t('drill.label')}
                    <input
                      maxLength={3}
                      value={selected.label}
                      onChange={e => updateElement(selected.id, { label: e.target.value } as Partial<DrillElement>, false)}
                      className="w-14 bg-surface border border-border rounded-md px-2 py-1 text-foreground outline-none focus:border-primary/50"
                    />
                  </label>
                )}
                {selected.kind === 'text' && (
                  <label className="flex items-center gap-2 text-muted flex-1 min-w-[160px]">
                    {t('drill.textLabel')}
                    <input
                      autoFocus
                      maxLength={60}
                      value={selected.text}
                      onChange={e => updateElement(selected.id, { text: e.target.value } as Partial<DrillElement>, false)}
                      className="flex-1 bg-surface border border-border rounded-md px-2 py-1 text-foreground outline-none focus:border-primary/50"
                    />
                  </label>
                )}
                {selected.kind === 'goal' && (
                  <>
                    <button type="button" onClick={rotateGoal} className="flex items-center gap-1 px-2 py-1 rounded-md border border-border text-muted hover:text-foreground"><RotateCw size={13} /> {t('drill.rotate')}</button>
                    <button type="button" onClick={() => updateElement(selected.id, { size: selected.size === 'full' ? 'mini' : 'full' } as Partial<DrillElement>)} className="px-2 py-1 rounded-md border border-border text-muted hover:text-foreground">
                      {selected.size === 'full' ? t('drill.tool.miniGoal') : t('drill.tool.goal')}
                    </button>
                  </>
                )}
                <div className="flex-1" />
                <button type="button" onClick={removeSelected} className="flex items-center gap-1 px-2 py-1 rounded-md border border-rose-500/30 text-rose-500 hover:bg-rose-500/10"><Trash2 size={13} /> {t('common.delete')}</button>
              </>
            ) : (
              <span className="text-muted">{tool === 'select' ? t('drill.hintSelect') : ARROW_TOOLS.has(tool) || tool === 'zone' ? t('drill.hintDrag') : t('drill.hintPlace')}</span>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
