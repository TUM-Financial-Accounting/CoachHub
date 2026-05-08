import { forwardRef } from "react";
import { cn } from "../../lib/utils";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { ButtonProps } from "../../types/ui";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", isLoading, icon, children, disabled, ...props }, ref) => {
    
    const variants = {
      primary: "bg-primary hover:bg-primary-hover text-white shadow-lg shadow-blue-500/10 border-0",
      secondary: "bg-surface-hover border border-border text-foreground hover:bg-border/50",
      danger: "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-600/20",
      ghost: "bg-transparent hover:bg-surface-hover text-muted hover:text-foreground border-0",
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        disabled={isLoading || disabled}
        className={cn(
          "inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-bold transition-all disabled:opacity-50 disabled:pointer-events-none",
          variants[variant],
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {!isLoading && icon && <span className="mr-2">{icon}</span>}
        {children}
      </motion.button>
    );
  }
);
Button.displayName = "Button";