import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Save, Loader2 } from 'lucide-react';
import { TeamService, SeasonService } from '../services';
import { useTeam } from '../contexts/TeamContext';
import { useSeason } from '../contexts/SeasonContext';
import { toast } from 'sonner';

interface TeamFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TeamFormModal({ isOpen, onClose, onSuccess }: TeamFormModalProps) {
  const { refreshTeams, teams: allTeams } = useTeam();
  const { seasons, activeSeason, refreshSeasons, setActiveSeasonId } = useSeason();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'create' | 'clone'>('create');
  const [formData, setFormData] = useState({ name: '', formation: '4-4-2' });
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(activeSeason?.id || (seasons[0]?.id || 'NEW_SEASON'));
  const [newSeasonName, setNewSeasonName] = useState('');
  const [sourceTeamId, setSourceTeamId] = useState<string>('');
  const [availableTeamsForCloning, setAvailableTeamsForCloning] = useState<any[]>([]);

  // Fetch all teams for cloning when entering clone mode
  React.useEffect(() => {
    if (mode === 'clone' && isOpen) {
      TeamService.getAll().then(setAvailableTeamsForCloning).catch(console.error);
    }
  }, [mode, isOpen]);

  // Sync selected season when modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (activeSeason) {
        setSelectedSeasonId(activeSeason.id);
      } else if (seasons.length > 0) {
        setSelectedSeasonId(seasons[0].id);
      } else {
        setSelectedSeasonId('NEW_SEASON');
      }
    }
  }, [isOpen, activeSeason, seasons]);

  if (!isOpen) return null;

  const isCreatingNewSeason = selectedSeasonId === 'NEW_SEASON';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let targetSeasonId = selectedSeasonId;

    setLoading(true);
    try {
      if (isCreatingNewSeason) {
        if (!newSeasonName.trim()) {
          toast.error('Please enter a name for the new season');
          setLoading(false);
          return;
        }
        const newSeason = await SeasonService.create({ name: newSeasonName });
        await refreshSeasons();
        targetSeasonId = newSeason.id;
        setActiveSeasonId(newSeason.id);
      }

      if (!targetSeasonId) {
        toast.error('Please select a season');
        setLoading(false);
        return;
      }

      // Check for duplicates in the target season
      const teamNameToCreate = mode === 'clone' 
        ? availableTeamsForCloning.find(t => t.id === sourceTeamId)?.name 
        : formData.name;

      const isDuplicate = allTeams.some(t => 
        t.season_id === targetSeasonId && 
        t.name.toLowerCase() === teamNameToCreate?.toLowerCase()
      );

      if (isDuplicate) {
        toast.error(`A team named "${teamNameToCreate}" already exists in this season.`);
        setLoading(false);
        return;
      }

      if (mode === 'clone') {
        if (!sourceTeamId) {
          toast.error('Please select a team to clone');
          setLoading(false);
          return;
        }
        await TeamService.clone(sourceTeamId, targetSeasonId);
      } else {
        await TeamService.create({ ...formData, season_id: targetSeasonId });
      }

      await refreshTeams();
      toast.success(mode === 'clone' ? 'Team cloned successfully!' : 'Team created successfully!');
      onSuccess();
      setFormData({ name: '', formation: '4-4-2' });
      setNewSeasonName('');
      setSourceTeamId('');
    } catch (err: any) {
      toast.error('Failed to process request: ' + (err.message || 'Unknown error'));
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

          <div className="px-6 py-4 bg-surface-hover/30 border-b border-border">
            <div className="flex p-1 bg-surface border border-border rounded-xl">
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`flex-1 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                  mode === 'create'
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                Create New
              </button>
              <button
                type="button"
                onClick={() => setMode('clone')}
                className={`flex-1 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                  mode === 'clone'
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                Clone Existing
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
            <div className="space-y-4">
              {mode === 'create' ? (
                <>
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
                </>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                    Select Team to Clone
                  </label>
                  <select
                    value={sourceTeamId}
                    onChange={e => setSourceTeamId(e.target.value)}
                    className="w-full bg-surface border border-border text-foreground rounded-xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  >
                    <option value="">-- Select a Team --</option>
                    {/* Show all available teams from other seasons */}
                    {availableTeamsForCloning.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({seasons.find(s => s.id === t.season_id)?.name || 'Unknown Season'})</option>
                    ))}
                  </select>
                  <p className="mt-2 text-[10px] text-muted leading-relaxed">
                    This will copy the team name, formation, and all player assignments to the selected season.
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-border">
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                  Target Season
                </label>
                <select
                  value={selectedSeasonId}
                  onChange={e => setSelectedSeasonId(e.target.value)}
                  className="w-full bg-surface border border-border text-foreground rounded-xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                >
                  {seasons.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                  <option value="NEW_SEASON">+ Create New Season</option>
                </select>
              </div>

              {selectedSeasonId === 'NEW_SEASON' && (
                <div className="space-y-2 mt-4">
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider">
                    New Season Name
                  </label>
                  <input
                    type="text"
                    required={selectedSeasonId === 'NEW_SEASON'}
                    value={newSeasonName}
                    onChange={e => setNewSeasonName(e.target.value)}
                    placeholder="e.g. 2026/2027 Season"
                    className="w-full bg-surface border border-border text-foreground rounded-xl px-4 py-3 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
              )}
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
              disabled={loading || (mode === 'create' ? !formData.name : !sourceTeamId)}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/25"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              <span>{mode === 'clone' ? 'Clone Team' : 'Create Team'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
