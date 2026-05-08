import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, BookOpen, ChevronRight, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';

import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Modal } from "./ui/Modal";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { PlaybookManagementModal } from "./PlaybookManagementModal";

import { Tactic } from '../types/models';
import { LibraryService } from '../services';

const ALL_FORMATIONS = ['4-4-2','4-3-3','4-2-3-1','4-3-2-1','4-1-4-1','4-1-2-1-2','4-4-2 DM','3-5-2','3-4-3','3-4-1-2','5-3-2','5-4-1'];

export default function TacticsLibrary() {
  const [tactics, setTactics] = useState<Tactic[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFormation, setActiveFormation] = useState<string>('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ id: '', name: '', formation: '4-3-3', description: '', suggestedDrills: '' });

  const fetchTactics = () => {
    LibraryService.getTactics()
        .then(dbItems => {
            setTactics(dbItems);
            if (dbItems.length > 0 && !selectedId) setSelectedId(dbItems[0].id);
        })
        .catch(() => toast.error('Backend offline'));
  };

  useEffect(() => {
    fetchTactics();
  }, []);

  const handleSave = async () => {
    if (!formData.name) return toast.error('Name required');
    try {
      const tacticToSave: Tactic = {
        id: formData.id,
        name: formData.name,
        formation: formData.formation,
        description: formData.description,
        suggestedDrills: formData.suggestedDrills,
        isCustom: true
      };
      
      let saved: Tactic;
      if (isEditing && formData.id) {
        saved = await LibraryService.updateTactic(formData.id, tacticToSave);
        setTactics(prev => prev.map(t => t.id === saved.id ? saved : t));
      } else {
        saved = await LibraryService.createTactic(tacticToSave);
        setTactics(prev => [...prev, saved]);
        setSelectedId(saved.id);
      }
      toast.success(isEditing ? 'Updated!' : 'Created!');
      closeModal();
    } catch { 
      toast.error('Failed to save'); 
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await LibraryService.deleteTactic(id);
      setTactics(prev => {
        const next = prev.filter(t => t.id !== id);
        if (selectedId === id) setSelectedId(next[0]?.id ?? null);
        return next;
      });
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const closeModal = () => { setShowCreateModal(false); setIsEditing(false); setFormData({ id: '', name: '', formation: '4-3-3', description: '', suggestedDrills: '' }); };
  const openEdit = (t: Tactic) => { setFormData({ id: t.id, name: t.name, formation: t.formation, description: t.description, suggestedDrills: t.suggestedDrills || '' }); setIsEditing(true); setShowCreateModal(true); };

  // Derived data
  const usedFormations = ALL_FORMATIONS.filter(f => tactics.some(t => t.formation === f));
  const filtered = tactics.filter(t => {
    const matchFormation = activeFormation === 'All' || t.formation === activeFormation;
    const matchSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchFormation && matchSearch;
  });
  const selected = tactics.find(t => t.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="h-full w-full flex flex-col p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto gap-6 overflow-y-auto lg:overflow-hidden">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-1 h-10 rounded-full bg-emerald-500 flex-shrink-0" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Tactics Library</h1>
            <p className="text-sm text-muted mt-0.5">
              {tactics.length} {tactics.length === 1 ? 'tactic' : 'tactics'}
              {usedFormations.length > 0 && <> &middot; {usedFormations.length} formation{usedFormations.length > 1 ? 's' : ''}</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setShowPlaybookModal(true)} icon={<Share2 size={18} />}>Manage Playbook</Button>
          <Button onClick={() => setShowCreateModal(true)} icon={<Plus size={18} />}>Add Tactic</Button>
        </div>
      </div>

      {/* Formation Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveFormation('All')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
            activeFormation === 'All'
              ? 'bg-surface-hover border-border text-foreground shadow-sm'
              : 'bg-transparent border-border text-muted hover:text-foreground hover:bg-surface-hover'
          }`}
        >
          All <span className="ml-1 opacity-60">{tactics.length}</span>
        </button>
        {usedFormations.map(f => {
          const count = tactics.filter(t => t.formation === f).length;
          const isActive = activeFormation === f;
          return (
            <button
              key={f}
              onClick={() => setActiveFormation(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                isActive
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                  : 'bg-transparent border-white/10 text-slate-500 hover:border-emerald-500/30 hover:text-emerald-400'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${isActive ? 'opacity-100' : 'opacity-30'}`} />
                {f}
                <span className="opacity-60">{count}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Master / Detail */}
      <div className="grid grid-cols-12 gap-6 lg:flex-1 lg:min-h-0">

        {/* LEFT: List */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-3">
          <div className="flex-shrink-0">
            <Input icon={<Search size={15} />} placeholder="Search tactics..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>

          <div className="space-y-2 lg:overflow-y-auto custom-scrollbar pr-1 lg:flex-1 lg:min-h-0">
            <AnimatePresence>
              {filtered.length === 0 && (
                <div className="text-center py-16 text-muted">
                  <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No tactics found</p>
                </div>
              )}
              {filtered.map(t => {
                const isSelected = selectedId === t.id;
                return (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    onClick={() => setSelectedId(t.id)}
                    className={`group relative rounded-xl border cursor-pointer transition-all p-4 ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-surface-hover/40 border-border hover:border-border hover:bg-surface-hover/70'
                    }`}
                  >
                    <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-emerald-500 ${
                      isSelected ? 'opacity-100' : 'opacity-20 group-hover:opacity-50'
                    } transition-opacity`} />
                    <div className="pl-3 flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate text-foreground`}>{t.name}</p>
                        <span className="text-[10px] font-bold uppercase tracking-widest mt-1 inline-block text-emerald-400">{t.formation}</span>
                        {t.description && <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">{t.description}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {isSelected && <ChevronRight size={14} className="text-emerald-400 mt-0.5" />}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                          <button
                            onClick={e => { e.stopPropagation(); openEdit(t); }}
                            className="p-1.5 rounded-lg bg-surface-raised hover:bg-surface-hover text-muted hover:text-foreground border border-border transition-colors"
                          ><Edit2 size={11} /></button>
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDeleteId(t.id); }}
                            className="p-1.5 rounded-lg bg-surface-raised hover:bg-rose-900/60 text-muted hover:text-rose-400 border border-border transition-colors"
                          ><Trash2 size={11} /></button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* RIGHT: Detail Panel */}
        <div className="col-span-12 lg:col-span-8 lg:h-full lg:overflow-hidden">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full rounded-2xl border border-emerald-500/20 bg-surface/40 overflow-y-auto custom-scrollbar flex flex-col"
            >
              {/* Detail Header */}
              <div className="p-6 border-b border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border mb-3 bg-emerald-500/10 border-emerald-500/20 text-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {selected.formation}
                    </span>
                    <h2 className="text-2xl font-bold text-foreground tracking-tight">{selected.name}</h2>
                  </div>
                  {selected.isCustom && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => openEdit(selected)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-surface text-muted hover:text-foreground text-xs font-bold border border-border transition-colors"
                      ><Edit2 size={12} /> Edit</button>
                      <button
                        onClick={() => setConfirmDeleteId(selected.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-rose-900/50 text-muted hover:text-rose-400 text-xs font-bold border border-border transition-colors"
                      ><Trash2 size={12} /> Delete</button>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Formation Visualisation */}
                <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl h-44 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-4 border border-emerald-500/10 rounded" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-emerald-500/10 rounded-full" />
                  <div className="absolute top-0 bottom-0 left-1/2 border-l border-emerald-500/10" />
                  <div className="text-center z-10">
                    <span className="text-5xl font-bold text-emerald-400 block tracking-tighter drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]">{selected.formation}</span>
                    <span className="text-[10px] uppercase text-emerald-500/60 tracking-[0.2em] font-bold mt-2 block">Formation</span>
                  </div>
                </div>

                {selected.description && (
                  <div>
                    <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Description</h4>
                    <p className="text-slate-300 text-sm leading-relaxed">{selected.description}</p>
                  </div>
                )}

                {selected.suggestedDrills && (
                  <div className="bg-orange-500/5 border border-orange-500/15 rounded-xl p-4">
                    <h4 className="text-orange-400 text-[10px] uppercase font-bold tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Suggested Drills
                    </h4>
                    <ul className="space-y-2">
                      {selected.suggestedDrills.split('\n').filter(d => d.trim()).map((drill, i) => (
                        <li key={i} className="flex items-start gap-3 text-slate-300 text-sm">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
                          <span className="leading-relaxed">{drill}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="lg:h-full min-h-[400px] rounded-2xl border border-border bg-surface-hover/20 flex flex-col items-center justify-center text-dimmed">
              <BookOpen size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">Select a tactic to view details</p>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showCreateModal} onClose={closeModal} title={isEditing ? 'Edit Tactic' : 'New Tactic'}
        footer={<div className="flex gap-3"><Button variant="ghost" onClick={closeModal} className="flex-1">Cancel</Button><Button onClick={handleSave} className="flex-1 bg-green-600 hover:bg-green-500 shadow-lg shadow-green-500/20">Save</Button></div>}>
        <div className="space-y-6">
            <Input label="Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Counter Attack" />
            <Select label="Formation" value={formData.formation} onChange={val => setFormData({...formData, formation: val as string})} options={['4-4-2', '4-3-3', '4-2-3-1', '4-3-2-1', '4-1-4-1', '4-1-2-1-2', '4-4-2 DM', '3-5-2', '3-4-3', '3-4-1-2', '5-3-2', '5-4-1'].map(f => ({label: f, value: f}))} />
            <div className="space-y-2"><label className="text-[11px] font-bold text-muted uppercase tracking-widest ml-1">Description</label>
            <textarea className="w-full bg-surface-hover border border-border text-foreground rounded-xl px-4 py-3.5 text-sm outline-none placeholder:text-muted focus:bg-surface focus:border-primary/50 focus:ring-4 focus:ring-primary/10 hover:border-border resize-none h-24 custom-scrollbar transition-all" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
            <div className="space-y-2"><label className="text-[11px] font-bold text-orange-400 uppercase tracking-widest ml-1">Suggested Drills (Line Separated)</label>
            <textarea className="w-full bg-surface-hover border border-border text-foreground rounded-xl px-4 py-3.5 text-sm outline-none placeholder:text-muted focus:bg-surface focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 hover:border-border resize-none h-20 custom-scrollbar transition-all" value={formData.suggestedDrills} onChange={e => setFormData({...formData, suggestedDrills: e.target.value})} placeholder="Rondo&#10;Small Sided Game" /></div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDeleteId !== null}
        title="Delete tactic?"
        message="This will permanently remove this tactic from the library."
        confirmLabel="Delete"
        onConfirm={() => { if (confirmDeleteId) handleDelete(confirmDeleteId); setConfirmDeleteId(null); }}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <PlaybookManagementModal 
          isOpen={showPlaybookModal} 
          onClose={() => setShowPlaybookModal(false)}
          onImportSuccess={fetchTactics}
      />
    </div>
  );
}