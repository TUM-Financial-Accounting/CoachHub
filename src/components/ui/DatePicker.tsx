import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { DatePickerProps } from "../../types/ui";
import { parseFlexibleDate, formatDateForInput } from "../../lib/dateParse";

type ViewMode = 'calendar' | 'month' | 'year';

export function DatePicker({ value, onChange, label }: DatePickerProps) {
  const { t, i18n } = useTranslation();
  // Locale-aware month and weekday labels (grid starts on Sunday;
  // 2026-01-04 is a Sunday, used as the anchor for weekday names).
  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Date(2026, i, 15).toLocaleDateString(i18n.language, { month: 'short' }));
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    new Date(2026, 0, 4 + i).toLocaleDateString(i18n.language, { weekday: 'short' }).slice(0, 2));
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [displayMonth, setDisplayMonth] = useState(value ? new Date(value + 'T12:00:00') : new Date());
  // Local string the user is actively typing. Kept separate from `value` so
  // partial input like "15/06" isn't constantly being rejected.
  const [draft, setDraft] = useState<string>(formatDateForInput(value));
  const [draftInvalid, setDraftInvalid] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const yearGridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-sync the input when the value prop changes from outside (calendar
  // click, parent reset, etc.) — but only if the input isn't currently
  // focused, so we don't yank text out from under the user.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(formatDateForInput(value));
      setDraftInvalid(false);
    }
  }, [value]);

  const commitDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraftInvalid(false);
      if (value) onChange('');
      return;
    }
    const parsed = parseFlexibleDate(trimmed);
    if (parsed) {
      setDraftInvalid(false);
      setDraft(formatDateForInput(parsed));
      if (parsed !== value) onChange(parsed);
      setDisplayMonth(new Date(parsed + 'T12:00:00'));
    } else {
      // Bad input: snap back to the last good value and flag it briefly.
      setDraftInvalid(true);
      setDraft(formatDateForInput(value));
    }
  };

  const selectedDate = value ? new Date(value + 'T12:00:00') : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentYear = today.getFullYear();
  const years = Array.from({ length: 86 }, (_, i) => currentYear - 80 + i);

  // Reset displayed month to the selected value whenever the picker opens
  useEffect(() => {
    if (isOpen) {
      setDisplayMonth(value ? new Date(value + 'T12:00:00') : new Date());
      setViewMode('calendar');
    }
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setViewMode('calendar');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll selected year into view when year picker opens
  useEffect(() => {
    if (viewMode === 'year' && yearGridRef.current) {
      const selected = yearGridRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: 'center' });
    }
  }, [viewMode]);

  // Calendar grid
  const firstDay = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
  const lastDay = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days: (number | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const handleDateClick = (day: number) => {
    const y = displayMonth.getFullYear();
    const m = String(displayMonth.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setIsOpen(false);
    setViewMode('calendar');
  };

  const handleYearSelect = (year: number) => {
    setDisplayMonth(new Date(year, displayMonth.getMonth(), 1));
    setViewMode('month');
  };

  const handleMonthSelect = (monthIndex: number) => {
    setDisplayMonth(new Date(displayMonth.getFullYear(), monthIndex, 1));
    setViewMode('calendar');
  };

  const headerLabel = viewMode === 'year'
    ? t('common.selectYear')
    : viewMode === 'month'
    ? `${displayMonth.getFullYear()}`
    : displayMonth.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });

  return (
    <div className="relative space-y-2" ref={containerRef}>
      {label && <label className="text-[11px] font-bold text-muted uppercase tracking-widest ml-1">{label}</label>}

      <div
        className={`w-full bg-surface border text-sm rounded-xl flex items-center transition-all
          ${draftInvalid
            ? 'border-rose-500/60 ring-4 ring-rose-500/20'
            : isOpen
            ? 'border-blue-500/50 ring-4 ring-ring'
            : 'border-border-subtle hover:border-border'
          }`}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          placeholder="DD/MM/YYYY"
          value={draft}
          onChange={e => {
            setDraft(e.target.value);
            if (draftInvalid) setDraftInvalid(false);
          }}
          onFocus={() => { setIsOpen(true); setViewMode('calendar'); }}
          onBlur={commitDraft}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitDraft();
              inputRef.current?.blur();
            } else if (e.key === 'Escape') {
              setDraft(formatDateForInput(value));
              setDraftInvalid(false);
              inputRef.current?.blur();
            }
          }}
          className={`flex-1 bg-transparent px-4 py-3.5 outline-none rounded-l-xl placeholder:text-dimmed
            ${selectedDate ? 'text-foreground' : 'text-foreground'}`}
        />
        <button
          type="button"
          aria-label="Open calendar"
          onClick={() => { setIsOpen(o => !o); setViewMode('calendar'); }}
          className="px-3 py-3.5 text-muted hover:text-blue-400 transition-colors rounded-r-xl"
        >
          <Calendar size={16} className={isOpen ? 'text-blue-400' : ''} />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="absolute top-full left-0 mt-2 bg-surface backdrop-blur-xl border border-border rounded-xl shadow-2xl z-50 p-4 w-80"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              {/* Left arrow: prev month (calendar) or back to year (month) */}
              {viewMode === 'calendar' && (
                <button onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1))} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                  <ChevronLeft size={18} className="text-muted" />
                </button>
              )}
              {viewMode === 'month' && (
                <button onClick={() => setViewMode('year')} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                  <ChevronLeft size={18} className="text-muted" />
                </button>
              )}
              {viewMode === 'year' && <div className="w-8" />}

              {/* Clickable header — cycles between views */}
              <button
                onClick={() => setViewMode(v => v === 'calendar' ? 'year' : v === 'month' ? 'year' : 'calendar')}
                className="text-sm font-bold text-foreground hover:text-blue-400 transition-colors px-2 py-1 rounded-lg hover:bg-surface-hover flex items-center gap-1"
              >
                {headerLabel}
                <span className="text-[10px] text-muted font-normal">{viewMode === 'year' ? '▴' : '▾'}</span>
              </button>

              {/* Right arrow: next month (calendar only) */}
              {viewMode === 'calendar' && (
                <button onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1))} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                  <ChevronRight size={18} className="text-muted" />
                </button>
              )}
              {viewMode !== 'calendar' && <div className="w-8" />}
            </div>

            {/* Year Grid */}
            {viewMode === 'year' && (
              <div ref={yearGridRef} className="grid grid-cols-4 gap-1 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                {years.map(year => (
                  <button
                    key={year}
                    data-selected={displayMonth.getFullYear() === year ? 'true' : 'false'}
                    onClick={() => handleYearSelect(year)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      displayMonth.getFullYear() === year
                        ? 'bg-blue-600 text-white'
                        : year === currentYear
                        ? 'bg-surface-raised text-foreground border border-blue-500/30'
                        : 'bg-surface-raised text-foreground hover:bg-surface-hover'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}

            {/* Month Grid */}
            {viewMode === 'month' && (
              <div className="grid grid-cols-3 gap-2">
                {monthNames.map((month, i) => (
                  <button
                    key={month}
                    onClick={() => handleMonthSelect(i)}
                    className={`py-2 rounded-lg text-xs font-bold transition-all ${
                      displayMonth.getMonth() === i
                        ? 'bg-blue-600 text-white'
                        : today.getMonth() === i && today.getFullYear() === displayMonth.getFullYear()
                        ? 'bg-surface-raised text-foreground border border-blue-500/30'
                        : 'bg-surface-raised text-foreground hover:bg-surface-hover'
                    }`}
                  >
                    {month}
                  </button>
                ))}
              </div>
            )}

            {/* Calendar View */}
            {viewMode === 'calendar' && (
              <>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {weekdayLabels.map(day => (
                    <div key={day} className="text-center text-[10px] font-bold text-muted uppercase py-2">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {days.map((day, index) => {
                    if (day === null) return <div key={`empty-${index}`} />;
                    const date = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day);
                    date.setHours(0, 0, 0, 0);
                    const isSelected = selectedDate
                      ? selectedDate.getFullYear() === date.getFullYear() && selectedDate.getMonth() === date.getMonth() && selectedDate.getDate() === date.getDate()
                      : false;
                    const isToday = date.getTime() === today.getTime();
                    return (
                      <button
                        key={day}
                        onClick={() => handleDateClick(day)}
                        className={`aspect-square rounded-lg text-sm font-bold transition-all
                          ${isSelected
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 border border-blue-400'
                            : isToday
                            ? 'bg-surface-raised text-foreground border border-blue-500/50'
                            : 'bg-surface-raised text-foreground hover:bg-surface-hover border border-border-subtle'
                          }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
