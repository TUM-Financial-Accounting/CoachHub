import { forwardRef } from "react";
import { cn } from "../../lib/utils";

import { InputProps } from "../../types/ui";

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, label, error, rightElement, type, ...props }, ref) => {
    return (
      <div className="space-y-2 w-full">
        {label && (
          <label className="text-[11px] font-bold text-muted uppercase tracking-widest ml-1">
            {label}
          </label>
        )}
        <div className="relative group">
          {icon && (
            <div className="absolute left-3 top-0 bottom-0 grid place-items-center text-muted group-focus-within:text-primary transition-colors z-10 pointer-events-none">
              {icon}
            </div>
          )}
          
          <input
            ref={ref}
            type={type}
            className={cn(
              "w-full bg-surface-hover border border-border text-foreground rounded-xl px-4 py-3.5 text-base outline-none transition-all",
              "placeholder:text-muted/60",
              "focus:bg-surface focus:border-primary/40",
              "hover:border-border",
              type === 'number' && "no-spinner", 
              icon && "pl-10",
              rightElement && "pr-12",
              error && "border-red-500/50 focus:border-red-500 focus:ring-red-500/10",
              className
            )}
            {...props}
          />
          
          {rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs font-medium bg-surface px-2 py-1 rounded-md border border-border pointer-events-none">
              {rightElement}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-500 font-medium ml-1">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";