import { useState, useRef, useEffect } from "react";
import { cn } from "../../lib/utils";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { SelectProps } from "../../types/ui";

export function Select({ label, error, options, value, onChange, className, placeholder = "Select..." }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = options.find((opt) => opt.value === value)?.label;

  return (
    <div className="space-y-2 w-full" ref={containerRef}>
      {label && (
        <label className="text-[11px] font-bold text-muted uppercase tracking-widest ml-1">
          {label}
        </label>
      )}
      <div className="relative">
        {/* The Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full bg-surface-hover border border-border text-left text-foreground rounded-xl px-4 py-3.5 text-sm outline-none transition-all flex items-center justify-between",
            "focus:bg-surface focus:border-primary/50 focus:ring-4 focus:ring-primary/10",
            "hover:border-border",
            isOpen && "border-primary/50 bg-surface",
            error && "border-red-500/50",
            className
          )}
        >
          <span className={cn(!selectedLabel && "text-muted/60")}>
            {selectedLabel || placeholder}
          </span>
          <ChevronDown 
            size={16} 
            className={cn(
              "text-muted transition-transform duration-200", 
              isOpen && "rotate-180 text-primary"
            )} 
          />
        </button>

        {/* The Dropdown Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="absolute z-50 w-full mt-2 bg-surface backdrop-blur-xl border border-border rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                {options.map((opt) => (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "px-3 py-2.5 rounded-lg text-sm cursor-pointer flex items-center justify-between group transition-colors",
                      value === opt.value 
                        ? "bg-primary text-white" 
                        : "text-foreground/80 hover:bg-surface-hover hover:text-foreground"
                    )}
                  >
                    <span>{opt.label}</span>
                    {value === opt.value && <Check size={14} />}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {error && <p className="text-xs text-red-500 font-medium ml-1">{error}</p>}
    </div>
  );
}