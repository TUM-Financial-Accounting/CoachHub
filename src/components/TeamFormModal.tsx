import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Save, Loader2 } from 'lucide-react';
import { TeamService } from '../services';
import { useTeam } from '../contexts/TeamContext';
import { toast } from 'sonner';

interface TeamFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TeamFormModal({ isOpen, onClose, onSuccess }: TeamFormModalProps) {
  const { refreshTeams } = useTeam();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', formation: '4-4-2' });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await TeamService.create(formData);
      await refreshTeams();
      toast.success('Team created successfully!');
      onSuccess();
      setFormData({ name: '', formation: '4-4-2' });
    } catch (err: any) {
      toast.error('Failed to create team: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           className="absolute inset-0 bg-black/60 backdrop-blur-sm"
           onClick={onClose}
        />
        <motion.div
           initial={{ opacity: 0, scale: 0.95, y: 20 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           exit={{ opacity: 0, scale: 0.95, y: 20 }}
           className="relative w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 text-primary rounded-xl">
                <Users size={20} />
              </div>
              <h2 className="text-xl font-bold text-foreground">Create New Team</h2>
            </div>
            <button
               onClick={onClose}
               className="p-2 text-muted hover:text-foreground hover:bg-surface-hover rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                  Team Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. U19 Academy"
                  className="w-full bg-surface border border-border text-foreground rounded-xl px-4 py-3 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                  Default Formation
                </label>
                <select
                  value={formData.formation}
                  onChange={e => setFormData({ ...formData, formation: e.target.value })}
                  className="w-full bg-surface border border-border text-foreground rounded-xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                >
                  <option value="4-3-3">4-3-3</option>
                  <option value="4-4-2">4-4-2</option>
                  <option value="4-2-3-1">4-2-3-1</option>
                  <option value="3-5-2">3-5-2</option>
                </select>
              </div>
            </div>
          </form>
          
          <div className="px-6 py-4 border-t border-border bg-surface-hover/30 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-muted hover:text-foreground hover:bg-surface-hover rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !formData.name}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/25"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              <span>Create Team</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
