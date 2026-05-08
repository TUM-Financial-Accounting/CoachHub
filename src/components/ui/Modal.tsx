import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { ModalProps } from "../../types/ui";

export function Modal({ isOpen, onClose, title, icon, children, footer, maxWidth = "max-w-2xl" }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop with strong blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          {/* Modal Content - THE GLASS EFFECT IS HERE */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`relative w-full ${maxWidth} bg-surface border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]`}
            style={{ boxShadow: '0 0 50px -12px rgba(0, 0, 0, 0.5)' }} // Deep shadow
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
                {icon && <div className="p-2 bg-primary/10 rounded-lg text-primary">{icon}</div>}
                {title}
              </h2>
              <button 
                onClick={onClose} 
                className="p-2 text-muted hover:text-foreground hover:bg-surface-hover rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Body - Added custom scrollbar styling via class */}
            <div className="p-6 overflow-y-auto custom-scrollbar">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="p-6 border-t border-border bg-surface-hover">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}