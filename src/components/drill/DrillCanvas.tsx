import { useId } from 'react';
import {
  CANVAS_W, CANVAS_H, DRILL_PALETTE, DrillDrawing, DrillElement, DrillColor,
} from '../../lib/drillDrawing';

// Same pitch as the formation builder. DARK is only for marks on their own light fill.
const PITCH_TOP = '#064E3B';
const PITCH_DEEP = '#022C22';
const PITCH_LINE = '#34D399';
const LINE = '#FFFFFF';
const DARK = DRILL_PALETTE.black;

export const ARROW_STYLE = {
  run:     { dash: '5 3',     width: 1.4, dot: false },
  dribble: { dash: '1.2 2.4', width: 1.6, dot: false },
  pass:    { dash: undefined, width: 1.4, dot: false },
  shot:    { dash: undefined, width: 2.2, dot: true },
} as const;

const fill = (c: DrillColor) => DRILL_PALETTE[c];
const outline = (c: DrillColor) => (c === 'white' ? DARK : LINE);
const onFill = (c: DrillColor) => (c === 'white' || c === 'yellow' ? DARK : LINE);

function Cone({ x, y, color }: { x: number; y: number; color: DrillColor }) {
  return <path d={`M${x} ${y - 4.5} L${x - 4} ${y + 3.5} L${x + 4} ${y + 3.5} Z`} fill={fill(color)} stroke={outline(color)} strokeWidth="0.6" strokeLinejoin="round" />;
}

function Figure({ x, y, color }: { x: number; y: number; color: DrillColor }) {
  const c = fill(color);
  return (
    <g stroke={outline(color)} strokeWidth="0.6" strokeLinecap="round">
      <circle cx={x} cy={y - 6.5} r="2.2" fill={c} />
      <path d={`M${x - 2.6} ${y - 3.5} h5.2 v6 h-5.2 Z`} fill={c} />
      <path d={`M${x - 2.6} ${y - 2.5} l-2.4 3.5 M${x + 2.6} ${y - 2.5} l2.4 3.5 M${x - 1.5} ${y + 2.5} v5 M${x + 1.5} ${y + 2.5} v5`} fill="none" />
    </g>
  );
}

function Goal({ x, y, size, rotation }: { x: number; y: number; size: 'full' | 'mini'; rotation: number }) {
  const w = size === 'full' ? 26 : 12;
  const d = size === 'full' ? 6 : 4;
  return (
    <g transform={`rotate(${rotation} ${x} ${y})`}>
      <path d={`M${x - w / 2} ${y + d} V${y} H${x + w / 2} V${y + d}`} fill="none" stroke={LINE} strokeWidth={size === 'full' ? 1.8 : 1.4} strokeLinejoin="round" />
    </g>
  );
}

function Pitch({ background }: { background: DrillDrawing['background'] }) {
  if (background === 'blank') return null;
  const m = 6;
  const w = CANVAS_W - m * 2;
  const h = CANVAS_H - m * 2;
  const common = { fill: 'none', stroke: PITCH_LINE, strokeOpacity: 0.4, strokeWidth: 0.9 };
  if (background === 'half') {
    return (
      <g {...common}>
        <rect x={m} y={m} width={w} height={h} />
        <rect x={m + w / 2 - 55} y={m} width={110} height={44} />
        <rect x={m + w / 2 - 25} y={m} width={50} height={16} />
        <path d={`M${m + w / 2 - 28} ${m + 44} a28 28 0 0 0 56 0`} />
        <circle cx={m + w / 2} cy={m + 30} r="1.2" fill={PITCH_LINE} fillOpacity="0.4" />
        <path d={`M${m} ${m + h} h${w}`} />
        <path d={`M${m + w / 2 - 34} ${m + h} a34 34 0 0 1 68 0`} />
      </g>
    );
  }
  return (
    <g {...common}>
      <rect x={m} y={m} width={w} height={h} />
      <path d={`M${CANVAS_W / 2} ${m} v${h}`} />
      <circle cx={CANVAS_W / 2} cy={CANVAS_H / 2} r="22" />
      <circle cx={CANVAS_W / 2} cy={CANVAS_H / 2} r="1.2" fill={PITCH_LINE} fillOpacity="0.4" />
      <rect x={m} y={CANVAS_H / 2 - 42} width={40} height={84} />
      <rect x={m} y={CANVAS_H / 2 - 20} width={14} height={40} />
      <rect x={m + w - 40} y={CANVAS_H / 2 - 42} width={40} height={84} />
      <rect x={m + w - 14} y={CANVAS_H / 2 - 20} width={14} height={40} />
    </g>
  );
}

export interface DrillCanvasProps {
  drawing: DrillDrawing;
  selectedId?: string | null;
  className?: string;
  width?: number;
  height?: number;
  interactive?: boolean;
  /** "xMidYMid slice" makes a thumbnail fill its box the way object-cover does. */
  preserveAspectRatio?: string;
  svgRef?: React.Ref<SVGSVGElement>;
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onElementPointerDown?: (e: React.PointerEvent, el: DrillElement) => void;
  onHandlePointerDown?: (e: React.PointerEvent, el: DrillElement, handle: 'start' | 'end') => void;
  children?: React.ReactNode;
}

export function DrillCanvas({
  drawing, selectedId, className, width, height, interactive, preserveAspectRatio, svgRef,
  onPointerDown, onPointerMove, onPointerUp, onElementPointerDown, onHandlePointerDown, children,
}: DrillCanvasProps) {
  // Ids must be unique per instance (a grid renders many) and safe inside url().
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const markerId = (kind: string) => `${uid}-arrow-${kind}`;
  const grassId = `${uid}-grass`;
  const mowId = `${uid}-mow`;

  const renderElement = (el: DrillElement) => {
    const selected = el.id === selectedId;
    const props = {
      onPointerDown: interactive && onElementPointerDown ? (e: React.PointerEvent) => onElementPointerDown(e, el) : undefined,
      style: interactive ? { cursor: 'move' } : undefined,
    };
    const ring = selected ? <circle cx={el.x} cy={el.y} r="9" fill="none" stroke="#93C5FD" strokeWidth="0.9" strokeDasharray="2 1.5" /> : null;

    switch (el.kind) {
      case 'cone':
        return <g key={el.id} {...props}>{ring}<Cone x={el.x} y={el.y} color={el.color} /></g>;
      case 'player':
        return (
          <g key={el.id} {...props}>
            {ring}
            <circle cx={el.x} cy={el.y} r="5" fill={fill(el.color)} stroke={outline(el.color)} strokeWidth="0.8" />
            {el.label && <text x={el.x} y={el.y + 2.1} textAnchor="middle" fontSize="5.5" fontWeight="700" fontFamily="sans-serif" fill={onFill(el.color)}>{el.label}</text>}
          </g>
        );
      case 'coach':
        return (
          <g key={el.id} {...props}>
            {ring}
            <circle cx={el.x} cy={el.y} r="5.5" fill="#fff" stroke={DARK} strokeWidth="1" />
            <text x={el.x} y={el.y + 2.3} textAnchor="middle" fontSize="6.5" fontWeight="700" fontFamily="sans-serif" fill={DARK}>C</text>
          </g>
        );
      case 'figure':
        return <g key={el.id} {...props}>{ring}<Figure x={el.x} y={el.y} color={el.color} /></g>;
      case 'pole':
        return (
          <g key={el.id} {...props}>
            {ring}
            <rect x={el.x - 1.2} y={el.y - 7} width="2.4" height="14" rx="1.2" fill={fill(el.color)} stroke={outline(el.color)} strokeWidth="0.5" />
          </g>
        );
      case 'ball':
        return (
          <g key={el.id} {...props}>
            {ring}
            <circle cx={el.x} cy={el.y} r="2.6" fill={fill(el.color)} stroke={outline(el.color)} strokeWidth="0.7" />
          </g>
        );
      case 'zone':
        return (
          <g key={el.id} {...props}>
            <rect x={el.x} y={el.y} width={el.w} height={el.h} fill={fill(el.color)} fillOpacity="0.18" stroke={fill(el.color)} strokeWidth={selected ? 2 : 1.4} strokeDasharray={selected ? '4 2' : undefined} />
          </g>
        );
      case 'goal':
        return (
          <g key={el.id} {...props}>
            {selected && <rect x={el.x - 15} y={el.y - 4} width="30" height="12" fill="none" stroke="#93C5FD" strokeWidth="0.9" strokeDasharray="2 1.5" transform={`rotate(${el.rotation} ${el.x} ${el.y})`} />}
            <Goal x={el.x} y={el.y} size={el.size} rotation={el.rotation} />
          </g>
        );
      case 'arrow': {
        const s = ARROW_STYLE[el.arrow];
        return (
          <g key={el.id} {...props}>
            <line x1={el.x} y1={el.y} x2={el.x2} y2={el.y2} stroke="transparent" strokeWidth="8" />
            <line x1={el.x} y1={el.y} x2={el.x2} y2={el.y2} stroke={LINE} strokeWidth={s.width} strokeDasharray={s.dash} strokeLinecap={el.arrow === 'dribble' ? 'round' : 'butt'} markerEnd={`url(#${markerId(el.arrow)})`} />
            {s.dot && <circle cx={el.x} cy={el.y} r="2.2" fill={LINE} />}
            {selected && interactive && (
              <>
                <circle cx={el.x} cy={el.y} r="3.5" fill="#fff" stroke="#2F80ED" strokeWidth="1" style={{ cursor: 'crosshair' }} onPointerDown={e => { e.stopPropagation(); onHandlePointerDown?.(e, el, 'start'); }} />
                <circle cx={el.x2} cy={el.y2} r="3.5" fill="#fff" stroke="#2F80ED" strokeWidth="1" style={{ cursor: 'crosshair' }} onPointerDown={e => { e.stopPropagation(); onHandlePointerDown?.(e, el, 'end'); }} />
              </>
            )}
          </g>
        );
      }
      case 'text':
        return (
          <g key={el.id} {...props}>
            {selected && <rect x={el.x - 2} y={el.y - 7} width={Math.max(10, el.text.length * 3.6 + 4)} height="10" fill="none" stroke="#93C5FD" strokeWidth="0.9" strokeDasharray="2 1.5" />}
            {/* Halo behind the label so it survives crossing a zone or an arrow. */}
            <text x={el.x} y={el.y} fontSize="6" fontFamily="sans-serif" fontWeight="600" fill={PITCH_DEEP} stroke={PITCH_DEEP} strokeWidth="1.6" strokeLinejoin="round" opacity="0.85">{el.text || '…'}</text>
            <text x={el.x} y={el.y} fontSize="6" fontFamily="sans-serif" fontWeight="600" fill={LINE}>{el.text || '…'}</text>
          </g>
        );
    }
  };

  const zones = drawing.elements.filter(e => e.kind === 'zone');
  const rest = drawing.elements.filter(e => e.kind !== 'zone');

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      preserveAspectRatio={preserveAspectRatio}
      width={width}
      height={height}
      className={className}
      style={interactive ? { touchAction: 'none', userSelect: 'none' } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <defs>
        <linearGradient id={grassId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={PITCH_TOP} />
          <stop offset="100%" stopColor={PITCH_DEEP} />
        </linearGradient>
        <pattern id={mowId} width="30" height="8" patternUnits="userSpaceOnUse">
          <rect x="29" y="0" width="1" height="8" fill="#FFFFFF" opacity="0.1" />
        </pattern>
        {(['run', 'dribble', 'pass', 'shot'] as const).map(kind => (
          <marker key={kind} id={markerId(kind)} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L8 4 L0 8 Z" fill={LINE} />
          </marker>
        ))}
      </defs>
      <rect x="0" y="0" width={CANVAS_W} height={CANVAS_H} fill={`url(#${grassId})`} />
      <rect x="0" y="0" width={CANVAS_W} height={CANVAS_H} fill={`url(#${mowId})`} />
      <Pitch background={drawing.background} />
      {zones.map(renderElement)}
      {rest.map(renderElement)}
      {children}
    </svg>
  );
}
