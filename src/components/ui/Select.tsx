import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { SelectProps } from "../../types/ui";

const MENU_MAX_HEIGHT = 240;
const MENU_GAP = 8;

interface MenuPosition { left: number; width: number; top?: number; bottom?: number }

export function Select({ label, error, options, value, onChange, className, placeholder = "Select..." }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // The menu lives in a portal so a Card's overflow-hidden cannot clip it.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom;
      const openUp = below < MENU_MAX_HEIGHT + MENU_GAP && rect.top > below;
      setPosition(openUp
        ? { left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + MENU_GAP }
        : { left: rect.left, width: rect.width, top: rect.bottom + MENU_GAP });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
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
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title={selectedLabel || placeholder}
          className={cn(
            "w-full bg-surface-hover border border-border text-left text-foreground rounded-xl px-4 py-3.5 text-sm leading-6 outline-none transition-all flex items-center justify-between gap-2",
            "focus:bg-surface focus:border-primary/50 focus:ring-4 focus:ring-primary/10",
            "hover:border-border",
            isOpen && "border-primary/50 bg-surface",
            error && "border-red-500/50",
            className
          )}
        >
          {/* One line, so a long option does not make this select taller than its neighbours */}
          <span className={cn("truncate min-w-0", !selectedLabel && "text-muted/60")}>
            {selectedLabel || placeholder}
          </span>
          <ChevronDown
            size={16}
            className={cn(
              "shrink-0 text-muted transition-transform duration-200",
              isOpen && "rotate-180 text-primary"
            )}
          />
        </button>

        {/* The Dropdown Menu */}
        {createPortal(
          <AnimatePresence>
            {isOpen && position && (
              <motion.div
                ref={menuRef}
                // React bubbles portal clicks through the component tree; keep them from parent onClick handlers.
                onClick={e => e.stopPropagation()}
                initial={{ opacity: 0, y: position.top !== undefined ? -10 : 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: position.top !== undefined ? -10 : 10, scale: 0.95 }}
                transition={{ duration: 0.1 }}
                style={{ position: "fixed", left: position.left, width: position.width, top: position.top, bottom: position.bottom }}
                className="z-[100] bg-surface backdrop-blur-xl border border-border rounded-xl shadow-2xl overflow-hidden"
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
                        "px-3 py-2.5 rounded-lg text-sm cursor-pointer flex items-center justify-between gap-2 group transition-colors",
                        value === opt.value
                          ? "bg-primary text-white"
                          : "text-foreground/80 hover:bg-surface-hover hover:text-foreground"
                      )}
                    >
                      <span>{opt.label}</span>
                      {value === opt.value && <Check size={14} className="shrink-0" />}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
      </div>
      {error && <p className="text-xs text-red-500 font-medium ml-1">{error}</p>}
    </div>
  );
}
