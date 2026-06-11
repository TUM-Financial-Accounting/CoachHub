import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Edit2, Trash2, Upload, X, Video as VideoIcon, FileText, BookOpen, ChevronRight, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { uploadFile } from '../lib/uploadFile';
import { API_BASE_URL } from '../lib/api-config';

import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Modal } from "./ui/Modal";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { PlaybookManagementModal } from "./PlaybookManagementModal";

import {Basic} from "../types/models"
import { LibraryService } from '../services';


const resolveMediaUrl = (url: string) =>
  url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')
    ? url
    : `${API_BASE_URL}${url}`;

const getMediaType = (url?: string) => {
  if (!url) return null;
  const normalized = url.toLowerCase();
  const cleanUrl = normalized.split('#')[0].split('?')[0];

  if (normalized.startsWith('data:image') || cleanUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i)) return 'image';
  if (normalized.startsWith('data:video') || cleanUrl.match(/\.(mp4|webm|ogg|ogv|mov|m4v|mkv)$/i)) return 'video';
  if (normalized.startsWith('data:application/pdf') || cleanUrl.endsWith('.pdf')) return 'pdf';
  if (url.startsWith('/static/')) {
    const ext = cleanUrl.split('.').pop()?.toLowerCase();
    if (['jpg','jpeg','png','gif','webp'].includes(ext||'')) return 'image';
    if (['mp4','webm','ogg','ogv','mov','m4v','mkv'].includes(ext||'')) return 'video';
    if (ext === 'pdf') return 'pdf';
  }
  return 'unknown';
};

export default function BasicsLibrary() {
  const { t } = useTranslation();
  const [basics, setBasics] = useState<Basic[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [viewMedia, setViewMedia] = useState<string | null>(null);
  const [formData, setFormData] = useState({ id: '', name: '', description: '', diagramUrl: '' });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // --- Load Data ---
  const fetchBasics = () => {
    LibraryService.getBasics()
      .then(dbItems => {
        setBasics(dbItems);
        if (dbItems.length > 0 && !selectedId) setSelectedId(dbItems[0].id);
      })
      .catch(() => toast.error(t('training.saveFailed')));
  };

  useEffect(() => {
    fetchBasics();
  }, []);

  // --- Handlers ---
  const handleSave = async () => {
    if (!formData.name || !formData.description) return toast.error(t('login.validationFillFields'));

    const basicToSave: Basic = {
      id: formData.id,
      name: formData.name,
      description: formData.description,
      diagramUrl: mediaPreview || formData.diagramUrl,
      isCustom: true // Default for UI-created basics
    };

    try {
      let saved: Basic;
      if (isEditing && formData.id) {
        saved = await LibraryService.updateBasic(formData.id, basicToSave);
        setBasics(prev => prev.map(b => b.id === saved.id ? saved : b));
        toast.success(t('libraries.basicUpdated'));
      } else {
        saved = await LibraryService.createBasic(basicToSave);
        setBasics(prev => [...prev, saved]);
        setSelectedId(saved.id);
        toast.success(t('libraries.basicCreated'));
      }
      closeModal();
    } catch { toast.error(t('modals.saveFailed')); }
  };

  const handleDelete = async (id: string) => {
    // Optimistic delete with rollback snapshot.
    const basicsBefore = basics;
    const selectedBefore = selectedId;
    setBasics(prev => {
      const next = prev.filter(b => b.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
      return next;
    });
    toast.success(t('training.deleted'));
    try {
      await LibraryService.deleteBasic(id);
    } catch {
      setBasics(basicsBefore);
      setSelectedId(selectedBefore);
      toast.error(t('training.deleteFailed'));
    }
  };

  // --- File Upload Logic ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so picking the same file again re-triggers onChange.
    e.target.value = '';
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isPdf = file.type === 'application/pdf';

    if (!isImage && !isVideo && !isPdf) {
      toast.error(t('libraries.unsupportedMedia'));
      return;
    }

    if (file.size > 100 * 1024 * 1024) return toast.error(t('libraries.fileTooLarge'));
    if (isImage) {
      setMediaPreview(URL.createObjectURL(file));
    }
    try {
      const url = await uploadFile(file);
      setMediaPreview(url);
    } catch {
      toast.error(t('libraries.uploadFailed'));
      setMediaPreview(null);
    }
  };

  const closeModal = () => {
    setShowCreateModal(false); setIsEditing(false); setMediaPreview(null);
    setFormData({ id: '', name: '', description: '', diagramUrl: '' });
  };

  const openEdit = (basic: Basic) => {
    setFormData({ id: basic.id, name: basic.name, description: basic.description, diagramUrl: basic.diagramUrl || '' });
    setMediaPreview(basic.diagramUrl || null); setIsEditing(true); setShowCreateModal(true);
  };

  const filtered = basics.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const selected = basics.find(b => b.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="h-full w-full flex flex-col p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto gap-6 overflow-y-auto lg:overflow-hidden">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-1 h-10 rounded-full bg-sky-500 flex-shrink-0" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('page.basicsTitle')}</h1>
            <p className="text-sm text-muted mt-0.5">
              {t('libraries.conceptCount', { count: basics.length })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setShowPlaybookModal(true)} icon={<Share2 size={18} />}>{t('libraries.managePlaybook')}</Button>
          <Button onClick={() => { closeModal(); setShowCreateModal(true); }} icon={<Plus size={18} />}>{t('libraries.addBasic')}</Button>
        </div>
      </div>

      {/* Master / Detail */}
      <div className="grid grid-cols-12 gap-6 lg:flex-1 lg:min-h-0">

        {/* LEFT: List */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-3">
          <div className="flex-shrink-0">
            <Input icon={<Search size={15} />} placeholder={t('libraries.searchBasics')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>

          <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1 max-h-[60vh]">
            <AnimatePresence>
              {filtered.length === 0 && (
                <div className="text-center py-16 text-muted">
                  <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{t('libraries.noBasicsFound')}</p>
                </div>
              )}
              {filtered.map(basic => {
                const isSelected = selectedId === basic.id;
                return (
                  <motion.div
                    key={basic.id}
                    exit={{ opacity: 0, scale: 0.97 }}
                    onClick={() => setSelectedId(basic.id)}
                    className={`group relative rounded-xl border cursor-pointer transition-all p-4 ${
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500/30'
                        : 'bg-surface-hover/40 border-border hover:border-border hover:bg-surface-hover/70'
                    }`}
                  >
                    <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-sky-500 ${
                      isSelected ? 'opacity-100' : 'opacity-20 group-hover:opacity-50'
                    } transition-opacity`} />
                    <div className="pl-3 flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${isSelected ? 'text-foreground' : 'text-foreground/90'}`}>{basic.name}</p>
                        <p className="text-xs text-muted mt-1.5 line-clamp-2 leading-relaxed">{basic.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {isSelected && <ChevronRight size={14} className="text-sky-500 mt-0.5" />}
                        {basic.isCustom && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                            <button
                              onClick={e => { e.stopPropagation(); openEdit(basic); }}
                              className="p-1.5 rounded-lg bg-surface-hover hover:bg-surface text-muted hover:text-foreground border border-border transition-colors"
                            ><Edit2 size={11} /></button>
                            <button
                              onClick={e => { e.stopPropagation(); setConfirmDeleteId(basic.id); }}
                              className="p-1.5 rounded-lg bg-surface-hover hover:bg-rose-500/10 text-muted hover:text-rose-500 border border-border transition-colors"
                            ><Trash2 size={11} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* RIGHT: Detail Panel */}
        <div className="col-span-12 lg:col-span-8 overflow-hidden h-full">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full rounded-2xl border border-sky-500/20 bg-surface overflow-y-auto custom-scrollbar"
            >
              {/* Detail Header */}
              <div className="p-6 border-b border-sky-500/20 bg-sky-500/5">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">{selected.name}</h2>
                  {selected.isCustom && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => openEdit(selected)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-surface text-muted hover:text-foreground text-xs font-bold border border-border transition-colors"
                      ><Edit2 size={12} /> {t('common.edit')}</button>
                      <button
                        onClick={() => setConfirmDeleteId(selected.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-rose-500/10 text-muted hover:text-rose-500 text-xs font-bold border border-border transition-colors"
                      ><Trash2 size={12} /> {t('common.delete')}</button>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <h4 className="text-[10px] uppercase tracking-widest text-muted font-bold mb-2">{t('common.description')}</h4>
                  <p className="text-foreground/80 text-sm leading-relaxed">{selected.description}</p>
                </div>

                {selected.diagramUrl && (() => {
                  const type = getMediaType(selected.diagramUrl);
                  if (type === 'image') return (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-widest text-muted font-bold mb-3">{t('libraries.visuals')}</h4>
                      <img
                        src={resolveMediaUrl(selected.diagramUrl!)}
                        alt="Diagram"
                        className="w-full max-h-80 object-cover rounded-xl border border-border cursor-zoom-in hover:opacity-90 transition-opacity"
                        onClick={() => setViewMedia(resolveMediaUrl(selected.diagramUrl!))}
                      />
                    </div>
                  );
                  if (type === 'video') return (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-widest text-muted font-bold mb-3">{t('libraries.visuals')}</h4>
                      <div
                        className="w-full h-40 bg-black rounded-xl border border-border flex items-center justify-center group cursor-pointer hover:border-border transition-colors"
                        onClick={() => setViewMedia(resolveMediaUrl(selected.diagramUrl!))}
                      >
                        <div className="flex flex-col items-center gap-2 text-foreground/60 group-hover:text-foreground transition-colors">
                           <VideoIcon size={32} /><span className="text-xs font-bold uppercase tracking-widest">{t('libraries.watchVideo')}</span>
                        </div>
                      </div>
                    </div>
                  );
                  if (type === 'pdf') return (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-widest text-muted font-bold mb-3">{t('libraries.visuals')}</h4>
                      <div
                        className="w-full h-40 bg-surface-hover rounded-xl border border-border flex items-center justify-center group cursor-pointer hover:border-border transition-colors"
                        onClick={() => setViewMedia(resolveMediaUrl(selected.diagramUrl!))}
                      >
                        <div className="flex flex-col items-center gap-2 text-muted group-hover:text-foreground transition-colors">
                          <FileText size={32} /><span className="text-xs font-bold uppercase tracking-widest">{t('libraries.pdfDoc')}</span>
                        </div>
                      </div>
                    </div>
                  );
                  return null;
                })()}
              </div>
            </motion.div>
          ) : (
            <div className="lg:h-full min-h-[400px] rounded-2xl border border-border bg-surface flex flex-col items-center justify-center text-muted">
              <BookOpen size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">{t('libraries.selectBasicToView')}</p>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showCreateModal} onClose={closeModal} title={isEditing ? t('libraries.editBasic') : t('libraries.addBasic')}
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={closeModal} className="flex-1">{t('common.cancel')}</Button>
            <Button onClick={handleSave} className="flex-1">{t('common.save')}</Button>
          </div>
        }
      >
        <div className="space-y-6">
          <Input label={t('common.name')} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder={t('libraries.basicNamePlaceholder')} />

          {/* Visual Media Upload */}
          <div>
            <label className="text-[11px] font-bold text-muted uppercase tracking-widest ml-1 mb-2 block">{t('libraries.mediaPreviewLabel')}</label>
            <div className="h-32 bg-surface-hover border-2 border-dashed border-border rounded-xl relative group hover:border-primary/30 transition-colors flex flex-col items-center justify-center text-muted overflow-hidden cursor-pointer">
              {mediaPreview ? (
                <>
                  {getMediaType(mediaPreview) === 'image' && <img src={mediaPreview} className="w-full h-full object-cover" />}
                  {getMediaType(mediaPreview) === 'video' && <div className="text-primary flex flex-col items-center"><VideoIcon size={32} /><span className="text-xs mt-2 font-bold">{t('libraries.videoSelected')}</span></div>}
                  {getMediaType(mediaPreview) === 'pdf' && <div className="text-primary flex flex-col items-center"><FileText size={32} /><span className="text-xs mt-2 font-bold">{t('libraries.pdfSelected')}</span></div>}

                  <button
                    onClick={(e) => { e.stopPropagation(); setMediaPreview(null); setFormData({ ...formData, diagramUrl: '' }); }}
                    className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center hover:text-primary transition-colors">
                  <Upload size={24} className="mb-2" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">{t('libraries.uploadFile')}</span>
                  <input type="file" className="hidden" accept="image/*,video/*,application/pdf" onChange={handleFileUpload} />
                </label>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-muted uppercase tracking-widest ml-1">{t('common.description')}</label>
            <textarea
              className="w-full bg-surface-hover border border-border text-foreground rounded-xl px-4 py-3.5 text-sm outline-none transition-all placeholder:text-muted/60 focus:bg-surface focus:border-primary/50 focus:ring-4 focus:ring-primary/10 hover:border-border resize-none h-32 custom-scrollbar"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('libraries.describeConceptPlaceholder')}
            />
          </div>
        </div>
      </Modal>

      {/* Lightbox Viewer */}
      <AnimatePresence>
        {viewMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewMedia(null)}
            className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative max-w-[95vw] max-h-[95vh] w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {getMediaType(viewMedia) === 'image' && (
                <img src={viewMedia} alt="Full size media" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/10" />
              )}
              {getMediaType(viewMedia) === 'video' && (
                <video src={viewMedia} controls autoPlay className="max-w-full max-h-full rounded-lg shadow-2xl border border-white/10" />
              )}
              {getMediaType(viewMedia) === 'pdf' && (
                <iframe src={viewMedia} title="PDF Viewer" className="w-full h-full rounded-lg bg-white shadow-2xl border border-white/10" />
              )}

              <button
                onClick={() => setViewMedia(null)}
                className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors shadow-lg backdrop-blur-md border border-white/10"
              >
                <X size={24} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={confirmDeleteId !== null}
        title={t('libraries.deleteBasicTitle')}
        message={t('libraries.deleteBasicMsg')}
        confirmLabel={t('common.delete')}
        onConfirm={() => { if (confirmDeleteId) handleDelete(confirmDeleteId); setConfirmDeleteId(null); }}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <PlaybookManagementModal 
          isOpen={showPlaybookModal} 
          onClose={() => setShowPlaybookModal(false)}
          onImportSuccess={fetchBasics}
      />
    </div>
  );
}