import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { DatePickerProps } from "../../types/ui";

type ViewMode = 'calendar' | 'month' | 'year';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export function DatePicker({ value, onChange, label }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [displayMonth, setDisplayMonth] = useState(value ? new Date(value + 'T12:00:00') : new Date());
  const containerRef = useRef<HTMLDivElement>(null);
  const yearGridRef = useRef<HTMLDivElement>(null);

  const selectedDate = value ? new Date(value + 'T12:00:00') : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentYear = today.getFullYear();
  const years = Array.from({ length: 86 }, (_, i) => currentYear - 80 + i);

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
    const date = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day);
    onChange(date.toISOString().split('T')[0]);
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

  const displayValue = value && value.length >= 10
    ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`
    : 'DD/MM/YYYY';

  const headerLabel = viewMode === 'year'
    ? 'Select Year'
    : viewMode === 'month'
    ? `${displayMonth.getFullYear()}`
    : displayMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="relative space-y-2" ref={containerRef}>
      {label && <label className="text-[11px] font-bold text-muted uppercase tracking-widest ml-1">{label}</label>}

      <button
        type="button"
        onClick={() => { setIsOpen(!isOpen); setViewMode('calendar'); }}
        className={`w-full px-4 py-3.5 bg-surface border text-sm text-left rounded-xl flex items-center justify-between transition-all
          ${isOpen
            ? 'border-blue-500/50 bg-surface ring-4 ring-ring'
            : 'border-border-subtle hover:border-border'
          }`}
      >
        <span className={selectedDate ? 'text-foreground' : 'text-dimmed'}>{displayValue}</span>
        <Calendar size={16} className={`transition-colors ${isOpen ? 'text-blue-400' : 'text-muted'}`} />
      </button>

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
                {MONTH_NAMES.map((month, i) => (
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
                    {month.slice(0, 3)}
                  </button>
                ))}
              </div>
            )}

            {/* Calendar View */}
            {viewMode === 'calendar' && (
              <>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
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
