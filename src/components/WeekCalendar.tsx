import { useMemo, useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type CalendarKind = 'training' | 'match' | 'event' | 'birthday';

export interface CalendarItem {
  id: string;
  kind: CalendarKind;
  title: string;
  date: string;       // YYYY-MM-DD (local)
  startTime: string;  // HH:MM — ignored when allDay
  endTime: string;    // HH:MM — ignored when allDay
  subtitle?: string;
  allDay?: boolean;
}

interface WeekCalendarProps {
  weekStart: Date;                 // Monday 00:00 (local)
  items: CalendarItem[];
  startHour?: number;              // first hour shown (default 7)
  endHour?: number;                // last hour shown (default 22)
  compact?: boolean;               // denser layout for the dashboard widget
  onSlotClick?: (date: string, hour: number) => void;
  onItemClick?: (item: CalendarItem) => void;
}

const KIND_STYLES: Record<CalendarKind, string> = {
  training: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/25',
  match:    'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25',
  event:    'bg-violet-500/15 border-violet-500/40 text-violet-700 dark:text-violet-300 hover:bg-violet-500/25',
  birthday: 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25',
};

const KIND_BAR: Record<CalendarKind, string> = {
  training: 'bg-cyan-500',
  match: 'bg-rose-500',
  event: 'bg-violet-500',
  birthday: 'bg-amber-500',
};

const toMinutes = (t: string): number => {
  const [h, m] = (t || '').split(':').map(Number);
  if (Number.isNaN(h)) return NaN;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
};

const ymdLocal = (d: Date): string => d.toLocaleDateString('en-CA');

/**
 * Assigns overlapping items within a single day to side-by-side lanes so they
 * don't draw on top of each other (same approach Google Calendar uses).
 */
function layoutDay(items: CalendarItem[]): { item: CalendarItem; lane: number; lanes: number }[] {
  const sorted = [...items].sort((a, b) => {
    const sa = toMinutes(a.startTime), sb = toMinutes(b.startTime);
    if (sa !== sb) return sa - sb;
    return toMinutes(a.endTime) - toMinutes(b.endTime);
  });

  const out: { item: CalendarItem; lane: number; lanes: number }[] = [];
  let cluster: CalendarItem[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const laneEnds: number[] = [];
    const placed: { item: CalendarItem; lane: number }[] = [];
    for (const it of cluster) {
      const s = toMinutes(it.startTime);
      const e = Math.max(toMinutes(it.endTime), s + 30);
      let lane = laneEnds.findIndex(end => end <= s);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(e); }
      else laneEnds[lane] = e;
      placed.push({ item: it, lane });
    }
    const lanes = laneEnds.length || 1;
    placed.forEach(p => out.push({ item: p.item, lane: p.lane, lanes }));
    cluster = [];
    clusterEnd = -1;
  };

  for (const it of sorted) {
    const s = toMinutes(it.startTime);
    const e = Math.max(toMinutes(it.endTime), s + 30);
    if (cluster.length === 0 || s < clusterEnd) {
      cluster.push(it);
      clusterEnd = Math.max(clusterEnd, e);
    } else {
      flush();
      cluster.push(it);
      clusterEnd = e;
    }
  }
  if (cluster.length) flush();
  return out;
}

export default function WeekCalendar({
  weekStart,
  items,
  startHour = 7,
  endHour = 22,
  compact = false,
  onSlotClick,
  onItemClick,
}: WeekCalendarProps) {
  const { i18n } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [measuredH, setMeasuredH] = useState(0);
  const [headerH, setHeaderH] = useState(0);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }, [weekStart]);

  const weekKeys = useMemo(() => days.map(ymdLocal), [days]);

  const timedItems = useMemo(() => items.filter(it => !it.allDay), [items]);
  const allDayItems = useMemo(() => items.filter(it => it.allDay), [items]);
  const hasAllDay = useMemo(
    () => allDayItems.some(it => weekKeys.includes(it.date)),
    [allDayItems, weekKeys]
  );

  // The default window (startHour–endHour) is only a baseline. It widens
  // automatically to include any event that falls before or after it, so an
  // early-morning or late-evening match is never hidden.
  const { effStart, effEnd } = useMemo(() => {
    let minM = startHour * 60;
    let maxM = endHour * 60;
    for (const it of timedItems) {
      if (!weekKeys.includes(it.date)) continue;
      const s = toMinutes(it.startTime);
      const e = toMinutes(it.endTime);
      if (!Number.isNaN(s)) minM = Math.min(minM, s);
      if (!Number.isNaN(e)) maxM = Math.max(maxM, e);
      else if (!Number.isNaN(s)) maxM = Math.max(maxM, s + 30);
    }
    const start = Math.max(0, Math.floor(minM / 60));
    const end = Math.min(24, Math.ceil(maxM / 60));
    return { effStart: start, effEnd: Math.max(end, start + 1) };
  }, [timedItems, weekKeys, startHour, endHour]);

  const totalHours = Math.max(1, effEnd - effStart);
  // Size each hour row to fill the visible area so the grid spans the whole
  // calendar instead of leaving a big empty gap at the bottom. On short
  // screens a minimum row height kicks in and the grid scrolls instead.
  const minRow = compact ? 34 : 44;
  const availH = Math.max(0, measuredH - headerH);
  const rowHeight = Math.max(minRow, availH > 0 ? availH / totalHours : minRow);
  const gridHeight = totalHours * rowHeight;

  const hours = useMemo(
    () => Array.from({ length: totalHours }, (_, i) => effStart + i),
    [effStart, totalHours]
  );

  const todayStr = ymdLocal(new Date());

  // Items grouped + laid out per day.
  const perDay = useMemo(() => {
    const map: Record<string, { item: CalendarItem; lane: number; lanes: number }[]> = {};
    for (const day of days) {
      const key = ymdLocal(day);
      const dayItems = timedItems.filter(it => it.date === key && !Number.isNaN(toMinutes(it.startTime)));
      map[key] = layoutDay(dayItems);
    }
    return map;
  }, [days, timedItems]);

  // Track the visible height so rows can fill it (and re-fill on resize).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setMeasuredH(el.clientHeight);
      if (headerRef.current) setHeaderH(headerRef.current.offsetHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // Watch the header too: the all-day band changes the space left for the hour rows.
    if (headerRef.current) ro.observe(headerRef.current);
    return () => ro.disconnect();
  }, []);

  // Scroll so ~8:00 is in view on mount (only matters when the grid scrolls).
  useEffect(() => {
    if (scrollRef.current) {
      const eightAm = Math.max(0, (8 - effStart)) * rowHeight;
      scrollRef.current.scrollTop = Math.max(0, eightAm - rowHeight);
    }
  }, [effStart, rowHeight]);

  const gutterWidth = compact ? 40 : 56;

  return (
    <div className="flex flex-col h-full min-h-0 rounded-2xl border border-border bg-surface overflow-hidden">
      {/* Header and grid live in the same scroll container so their columns
          share identical widths — otherwise the body's scrollbar makes the
          grid columns narrower than the header columns and they drift apart. */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
        <div ref={headerRef} className="border-b border-border bg-surface sticky top-0 z-20">
          <div className="flex">
            <div style={{ width: gutterWidth }} className="flex-shrink-0" />
            {days.map(day => {
              const key = ymdLocal(day);
              const isToday = key === todayStr;
              return (
                <div key={key} className="flex-1 min-w-0 py-2 text-center border-l border-border">
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-primary' : 'text-muted'}`}>
                    {day.toLocaleDateString(i18n.language, { weekday: 'short' })}
                  </p>
                  <p className={`text-sm font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                    <span className={isToday ? 'inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white' : ''}>
                      {day.getDate()}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>

          {hasAllDay && (
            <div className="flex border-t border-border/60">
              <div style={{ width: gutterWidth }} className="flex-shrink-0" />
              {days.map(day => {
                const key = ymdLocal(day);
                const dayItems = allDayItems.filter(it => it.date === key);
                return (
                  <div key={key} className="flex-1 min-w-0 border-l border-border p-0.5 space-y-0.5">
                    {dayItems.map(item => (
                      <button
                        key={`${item.kind}-${item.id}`}
                        type="button"
                        onClick={onItemClick ? () => onItemClick(item) : undefined}
                        title={item.subtitle ? `${item.title} · ${item.subtitle}` : item.title}
                        className={`w-full rounded border px-1.5 py-0.5 text-left text-[10px] font-semibold leading-tight truncate transition-colors ${KIND_STYLES[item.kind]} ${onItemClick ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Time grid */}
        <div className="flex" style={{ height: gridHeight }}>
          {/* Hour gutter */}
          <div style={{ width: gutterWidth }} className="flex-shrink-0 relative">
            {hours.map((h, i) => (
              <div
                key={h}
                style={{ top: i * rowHeight }}
                className="absolute right-1.5 -translate-y-1/2 text-[10px] font-medium text-muted/70"
              >
                {i === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map(day => {
            const key = ymdLocal(day);
            const laid = perDay[key] ?? [];
            return (
              <div key={key} className="flex-1 min-w-0 relative border-l border-border">
                {/* Background hour cells (clickable to create) */}
                {hours.map((h, i) => (
                  <div
                    key={h}
                    style={{ top: i * rowHeight, height: rowHeight }}
                    onClick={onSlotClick ? () => onSlotClick(key, h) : undefined}
                    onContextMenu={onSlotClick ? (e) => { e.preventDefault(); onSlotClick(key, h); } : undefined}
                    className={`absolute inset-x-0 border-t border-border/60 ${onSlotClick ? 'cursor-pointer hover:bg-surface-hover/50' : ''}`}
                  />
                ))}

                {/* Event blocks */}
                {laid.map(({ item, lane, lanes }) => {
                  const s = toMinutes(item.startTime);
                  const e = Math.max(toMinutes(item.endTime), s + 30);
                  const top = Math.max(0, ((s - effStart * 60) / 60) * rowHeight);
                  const rawHeight = ((e - s) / 60) * rowHeight;
                  const height = Math.max(18, Math.min(rawHeight, gridHeight - top));
                  const widthPct = 100 / lanes;
                  return (
                    <button
                      key={`${item.kind}-${item.id}`}
                      onClick={onItemClick ? () => onItemClick(item) : undefined}
                      style={{
                        top: top + 1,
                        height: height - 2,
                        left: `calc(${lane * widthPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                      }}
                      className={`absolute rounded-md border px-1.5 py-0.5 text-left overflow-hidden flex gap-1 transition-colors ${KIND_STYLES[item.kind]} ${onItemClick ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <span className={`w-1 rounded-full flex-shrink-0 ${KIND_BAR[item.kind]}`} />
                      <span className="min-w-0">
                        <span className="block text-[11px] font-semibold leading-tight truncate">{item.title || '—'}</span>
                        {!compact && height > 32 && (
                          <span className="block text-[10px] opacity-80 leading-tight truncate">
                            {item.startTime}{item.subtitle ? ` · ${item.subtitle}` : ''}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
