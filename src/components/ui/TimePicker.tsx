import { useState, useRef, useEffect } from 'react';
import { Clock, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TimePickerProps } from "../../types/ui";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); 



interface WheelProps {
  items: number[];
  selectedValue: number;
  onSelect: (val: number) => void;
  label: string;
}


// --- RE-IMPLEMENTING THE CLEAN VERSION (VERSION 2) WITH PERFORMANCE FIXES ---

function Wheel({ items, selectedValue, onSelect, label }: WheelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInternalScroll = useRef(false);
  
  // Use more sets to ensure even hard flicks don't hit physical boundaries
  const REPS = 20; 
  const displayItems = Array(REPS).fill(items).flat();
  const ITEM_HEIGHT = 40;
  const SET_HEIGHT = items.length * ITEM_HEIGHT;
  const MIDDLE_SET = Math.floor(REPS / 2);

  // Center scroll on mount or external change
  useEffect(() => {
    if (scrollRef.current && !isInternalScroll.current) {
      const indexInSet = items.indexOf(selectedValue);
      const targetScroll = (MIDDLE_SET * SET_HEIGHT) + (indexInSet * ITEM_HEIGHT);
      scrollRef.current.scrollTop = targetScroll;
    }
    isInternalScroll.current = false;
  }, [items, selectedValue, SET_HEIGHT, MIDDLE_SET]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;

    // DEBOUNCED SELECTION & SEAMLESS RE-CENTERING
    // We avoid jumping during active scrolling to preserve inertia.
    const timeoutId = (target as any)._timeout;
    if (timeoutId) clearTimeout(timeoutId);

    (target as any)._timeout = setTimeout(() => {
      const finalScrollTop = target.scrollTop;
      const index = Math.round(finalScrollTop / ITEM_HEIGHT);
      const actualValue = displayItems[index];
      
      // Re-center to middle set if we strayed too far. 
      // Since the user stopped scrolling, this jump is invisible and preserves "infinity".
      const currentSet = Math.floor(index / items.length);
      if (currentSet !== MIDDLE_SET && index >= 0 && index < displayItems.length) {
          const indexInSet = index % items.length;
          const newScrollTop = (MIDDLE_SET * SET_HEIGHT) + (indexInSet * ITEM_HEIGHT);
          isInternalScroll.current = true;
          target.scrollTop = newScrollTop;
      }

      if (actualValue !== undefined && actualValue !== selectedValue) {
        isInternalScroll.current = true;
        onSelect(actualValue);
      }
    }, 150);
  };

  return (
    <div className="flex flex-col items-center flex-1">
      <span className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">{label}</span>
      <div className="relative w-full h-[200px] overflow-hidden rounded-xl bg-black/20">
        {/* Selection Glass */}
        <div className="absolute top-1/2 left-0 w-full h-10 -translate-y-1/2 bg-blue-500/10 border-y border-blue-500/20 pointer-events-none z-10" />
        
        {/* Gradients */}
        <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-background via-background to-transparent pointer-events-none z-20" />
        <div className="absolute bottom-0 left-0 w-full h-20 bg-gradient-to-t from-background via-background to-transparent pointer-events-none z-20" />

        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar overscroll-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* 80px padding at top/bottom centers the items in the 200px container */}
          <div className="flex flex-col py-[80px]">
            {displayItems.map((item, idx) => (
              <div 
                key={idx}
                className="h-10 flex-shrink-0 flex items-center justify-center snap-center cursor-pointer select-none group"
                onClick={() => {
                   isInternalScroll.current = true;
                   onSelect(item);
                }}
              >
                <span className={`font-mono text-lg font-bold transition-all duration-200 ${
                  item === selectedValue
                    ? 'text-blue-400 scale-110'
                    : 'text-dimmed group-hover:text-muted'
                }`}>
                  {String(item).padStart(2, '0')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TimePicker({ value, onChange, label }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parts = value ? value.split(':') : ['09', '00'];
  const h24 = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const setHour = (h: number) => {
    onChange(`${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  };

  const setMinute = (m: number) => {
    onChange(`${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  return (
    <div className="relative space-y-2" ref={containerRef}>
      {label && (
        <label className="text-[11px] font-bold text-muted uppercase tracking-widest ml-1">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3.5 bg-surface border text-sm text-left rounded-xl flex items-center justify-between transition-all
          ${isOpen
            ? 'border-blue-500/50 bg-surface ring-4 ring-ring'
            : 'border-border-subtle hover:border-border'
          }`}
      >
        <span className={value ? 'text-foreground font-mono' : 'text-dimmed'}>
          {value || '09:00'}
        </span>
        <Clock size={16} className={`transition-colors ${isOpen ? 'text-blue-400' : 'text-muted'}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full left-0 mt-2 bg-background backdrop-blur-xl border border-border rounded-2xl shadow-2xl z-50 p-6 w-72 overflow-hidden"
          >
            <div className="flex gap-4 items-center mb-6">
              <Wheel items={HOURS} selectedValue={h24} onSelect={setHour} label="Hour" />
              <div className="text-2xl font-bold text-dimmed mt-6">:</div>
              <Wheel items={MINUTES} selectedValue={minute} onSelect={setMinute} label="Min" />
            </div>

            <Button 
              variant="primary" 
              className="w-full py-3 rounded-xl text-xs font-bold"
              onClick={() => setIsOpen(false)}
              icon={<Check size={14} />}
            >
              Done
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Button({ variant = 'primary', className = '', onClick, children, icon }: any) {
    const variants = {
        primary: 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20',
        secondary: 'bg-surface-raised hover:bg-surface-hover text-foreground border border-border-subtle',
        danger: 'bg-rose-600 hover:bg-rose-500 text-white',
        ghost: 'bg-transparent hover:bg-surface-hover text-muted hover:text-foreground'
    };

    return (
        <button
            onClick={onClick}
            className={`flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${variants[variant as keyof typeof variants]} ${className}`}
        >
            {icon}
            {children}
        </button>
    );
}
