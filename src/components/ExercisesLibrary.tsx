import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Search, Upload, Check, Image as ImageIcon, FileText, Video as VideoIcon, ChevronDown, ChevronRight, Maximize2, Share2, PenTool, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { uploadFile } from '../lib/uploadFile';
import { API_BASE_URL } from '../lib/api-config';

// UI Components
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Modal } from "./ui/Modal";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import ExerciseSlideOver from "./ExerciseSlideOver"
import { PlaybookManagementModal } from "./PlaybookManagementModal";

// --- Services ---
import { ExerciseService, LibraryService } from '../services';

// --- Types ---
import { Exercise, SelectorItem } from '../types/models';
import { EXERCISE_CATEGORIES, getCategoryStyles } from '../lib/exerciseCategories';
import { parseDrawing, hasDrawing } from '../lib/drillDrawing';
import { DrillCanvas } from './drill/DrillCanvas';
import DrillEditor from './drill/DrillEditor';
import { EQUIPMENT_OPTIONS, INTENSITIES, emptyExercise, intensityMeta } from '../lib/domain';

// --- Helpers ---
const resolveMediaUrl = (url: string) =>
    url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')
        ? url
        : `${API_BASE_URL}${url}`;

const getMediaType = (url?: string) => {
    if (!url) return null;
    const normalized = url.toLowerCase();
    // Strip query params/fragments before extension checks.
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

export default function ExercisesLibrary() {
    const { t } = useTranslation();
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeIntensity, setActiveIntensity] = useState<string>('All');
    const [activeCategory, setActiveCategory] = useState<string>('All');
    const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showPlaybookModal, setShowPlaybookModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [showDrillEditor, setShowDrillEditor] = useState(false);

    // Lightbox State
    const [viewMedia, setViewMedia] = useState<string | null>(null);

    // Accordion State
    const [openSection, setOpenSection] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    // Selector Lists
    const [allBasics, setAllBasics] = useState<SelectorItem[]>([]);
    const [allPrinciples, setAllPrinciples] = useState<SelectorItem[]>([]);
    const [allTactics, setAllTactics] = useState<SelectorItem[]>([]);

    const [basicsSearch, setBasicsSearch] = useState('');
    const [principlesSearch, setPrinciplesSearch] = useState('');
    const [tacticsSearch, setTacticsSearch] = useState('');

    const [formData, setFormData] = useState<Exercise>(emptyExercise);

    // --- 1. LOAD DATA ---
    const fetchExercises = () => {
        ExerciseService.getAll()
            .then(data => {
                setExercises(data); // Set fetched data
            })
            .catch(() => { toast.error(t('training.saveFailed')); });
    };

    useEffect(() => {
        // Fetch Exercises
        fetchExercises();

        // Fetch Selectors (Basics, Principles, Tactics)
        const fetchSelectors = async () => {
            try {
                const [basics, principles, tactics] = await Promise.all([
                    LibraryService.getBasics(),
                    LibraryService.getPrinciples(),
                    LibraryService.getTactics()
                ]);
                
                setAllBasics(basics.map(b => ({ id: b.id, name: b.name })));
                setAllPrinciples(principles.map(p => ({ id: p.id, name: p.name })));
                setAllTactics(tactics.map(t => ({ id: t.id, name: t.name })));
            } catch (e) { console.error("Failed to load selector lists", e); }
        };
        fetchSelectors();
    }, []);

    // --- 2. SAVE DATA ---
    const handleSave = async () => {
        if (!formData.name || !formData.description) return toast.error(t('libraries.nameRequired'));

        // Ensure we use the latest media preview if it exists, but never
        // persist a temporary blob: preview — if the user hits Save before the
        // upload finishes, fall back to the last real URL instead of saving a
        // blob that dies on reload.
        const resolvedMedia = mediaPreview && !mediaPreview.startsWith('blob:') ? mediaPreview : formData.mediaUrl;
        const exerciseToSave: Exercise = {
            ...formData,
            mediaUrl: resolvedMedia
        };

        try {
            let saved: Exercise;
            if (isEditing && formData.id) {
                saved = await ExerciseService.update(formData.id, exerciseToSave);
                setExercises(prev => prev.map(ex => ex.id === saved.id ? saved : ex));
                toast.success(t('libraries.exerciseUpdated'));
            } else {
                saved = await ExerciseService.create(exerciseToSave);
                setExercises(prev => [...prev, saved]);
                toast.success(t('libraries.exerciseCreated'));
            }
            closeModal();
        } catch (error) { toast.error(t('modals.saveFailed')); }
    };

    const handleDeleteExercise = async (id: string) => {
        // Optimistic delete: remove from state immediately, restore on failure.
        const exercisesBefore = exercises;
        const selectedBefore = selectedExercise;
        setExercises(prev => prev.filter(ex => ex.id !== id));
        setSelectedExercise(null);
        toast.success(t('training.deleted'));
        try {
            await ExerciseService.delete(id);
        } catch (e) {
            setExercises(exercisesBefore);
            setSelectedExercise(selectedBefore);
            toast.error(t('training.saveFailed'));
        }
    };

    // --- UI Helpers ---
    const resetForm = () => {
        setFormData(emptyExercise());
        setMediaPreview(null); setBasicsSearch(''); setPrinciplesSearch(''); setTacticsSearch(''); setOpenSection(null);
    };

    const closeModal = () => { setShowCreateModal(false); setIsEditing(false); setSelectedExercise(null); resetForm(); };
    const openEditModal = (ex: Exercise) => { setFormData(ex); setMediaPreview(ex.mediaUrl || null); setIsEditing(true); setShowCreateModal(true); };

    const toggleSelection = (field: 'equipment' | 'linkedBasics' | 'linkedPrinciples' | 'linkedTactics', item: string) => {
        const list = formData[field];
        const newList = list.includes(item) ? list.filter(i => i !== item) : [...list, item];
        setFormData({ ...formData, [field]: newList });
    };

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
        // Show a local object-URL preview immediately while the upload runs
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

    // Only surface category filter chips that are actually in use, so the row
    // stays empty (and hidden) until exercises start getting categorised.
    const usedCategories = EXERCISE_CATEGORIES.filter(cat => exercises.some(ex => ex.category === cat));

    const filteredExercises = exercises.filter(ex => {
        const matchIntensity = activeIntensity === 'All' || ex.intensity === activeIntensity;
        const matchCategory = activeCategory === 'All' || ex.category === activeCategory;
        const matchSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchIntensity && matchCategory && matchSearch;
    });

    // Media Renderer
    const renderMedia = (url: string, isPreview = false) => {
        const type = getMediaType(url);
        const resolvedUrl = resolveMediaUrl(url);

        const openLightbox = (e: React.MouseEvent) => {
            if (isPreview) {
                e.stopPropagation();
                setViewMedia(resolvedUrl);
            }
        };

        if (type === 'image') return (
            <img
                src={resolvedUrl}
                alt="Preview"
                className={`w-full h-full object-cover rounded-lg ${isPreview ? 'cursor-zoom-in hover:opacity-90 transition-opacity' : ''}`}
                onClick={openLightbox}
            />
        );

        if (type === 'video') return (
            <div
                className={`w-full h-full bg-background rounded-lg flex items-center justify-center relative group ${isPreview ? 'cursor-zoom-in hover:bg-surface transition-colors' : ''}`}
                onClick={openLightbox}
            >
                {isPreview ? (
                    <div className="flex flex-col items-center gap-2 text-slate-500 group-hover:text-blue-400 transition-colors">
                        <VideoIcon size={32} />
                        <span className="text-[10px] uppercase font-bold tracking-widest">{t('libraries.watchVideo')}</span>
                    </div>
                ) : (
                    <video src={resolvedUrl} controls className="w-full h-full rounded-lg" />
                )}
            </div>
        );

        if (type === 'pdf') return (
            <div
                className={`flex flex-col items-center justify-center h-full text-muted bg-surface rounded-lg border border-border ${isPreview ? 'cursor-zoom-in hover:bg-surface transition-colors group' : ''}`}
                onClick={openLightbox}
            >
                <FileText size={48} className="mb-2 group-hover:text-primary transition-colors" />
                <span className="text-sm">{t('libraries.pdfDoc')}</span>
                {!isPreview && <a href={resolveMediaUrl(url)} download="exercise.pdf" className="mt-2 text-blue-500 text-xs hover:underline">{t('libraries.download')}</a>}
            </div>
        );

        return <div className="flex items-center justify-center h-full text-slate-500">{t('libraries.unsupportedMedia')}</div>;
    };

    return (
        <div className="h-full w-full flex flex-col p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto gap-6 overflow-y-auto lg:overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-10 rounded-full bg-amber-500 flex-shrink-0" />
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('page.exercisesTitle')}</h1>
                        <p className="text-sm text-muted mt-0.5">
                            {t('libraries.exerciseCount', { count: exercises.length })}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="secondary" onClick={() => setShowPlaybookModal(true)} icon={<Share2 size={18} />}>{t('libraries.managePlaybook')}</Button>
                    <Button onClick={() => { resetForm(); setShowCreateModal(true) }} icon={<Plus size={18} />}>{t('libraries.addExercise')}</Button>
                </div>
            </div>

            {/* Intensity Filter Tabs */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setActiveIntensity('All')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        activeIntensity === 'All'
                            ? 'bg-surface-raised border-border text-foreground'
                            : 'bg-transparent border-border text-muted hover:text-foreground hover:border-border'
                    }`}
                >
                    {t('common.all')} <span className="ml-1 opacity-60">{exercises.length}</span>
                </button>
                {INTENSITIES.map(level => {
                    const count = exercises.filter(ex => ex.intensity === level).length;
                    const styles = {
                        Low:    { active: 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400', hover: 'hover:border-emerald-500/30 hover:text-emerald-400', dot: 'bg-emerald-500' },
                        Medium: { active: 'bg-amber-500/15 border-amber-500/50 text-amber-400',   hover: 'hover:border-amber-500/30 hover:text-amber-400',   dot: 'bg-amber-500'   },
                        High:   { active: 'bg-rose-500/15 border-rose-500/50 text-rose-400',     hover: 'hover:border-rose-500/30 hover:text-rose-400',     dot: 'bg-rose-500'    },
                    }[level];
                    const isActive = activeIntensity === level;
                    const levelLabel = t(intensityMeta(level).labelKey);
                    return (
                        <button
                            key={level}
                            onClick={() => setActiveIntensity(level)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                isActive ? styles.active : `bg-transparent border-border text-muted ${styles.hover}`
                            }`}
                        >
                            <span className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${styles.dot} ${isActive ? 'opacity-100' : 'opacity-30'}`} />
                                {levelLabel}
                                <span className="opacity-60">{count}</span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Category Filter Tabs — only shown once exercises carry a category */}
            {usedCategories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setActiveCategory('All')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            activeCategory === 'All'
                                ? 'bg-surface-raised border-border text-foreground'
                                : 'bg-transparent border-border text-muted hover:text-foreground hover:border-border'
                        }`}
                    >
                        {t('libraries.category')}: {t('common.all')}
                    </button>
                    {usedCategories.map(cat => {
                        const count = exercises.filter(ex => ex.category === cat).length;
                        const isActive = activeCategory === cat;
                        return (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(isActive ? 'All' : cat)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                    isActive ? getCategoryStyles(cat) : 'bg-transparent border-border text-muted hover:text-foreground hover:border-border'
                                }`}
                            >
                                {t(`exerciseCategories.${cat}`)}
                                <span className="ml-1 opacity-60">{count}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Search */}
            <div className="flex-shrink-0">
                <Input icon={<Search size={18} />} placeholder={t('libraries.searchExercises')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 pb-6">
                <AnimatePresence>
                    {filteredExercises.map((ex, idx) => (
                        <Card key={ex.id} animate delay={idx * 0.05} onClick={() => setSelectedExercise(ex)} className="p-6 cursor-pointer hover:border-primary/50 flex flex-col h-full group">
                            <div className="flex justify-between items-start mb-4 gap-2">
                                <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">{ex.name}</h3>
                                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                    <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${intensityMeta(ex.intensity).badge}`}>{ex.intensity}</span>
                                    {ex.category && (
                                        <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${getCategoryStyles(ex.category)}`}>
                                            {t(`exerciseCategories.${ex.category}`)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="h-40 mb-4 bg-background rounded-xl overflow-hidden flex items-center justify-center border border-border relative">
                                {ex.mediaUrl
                                    ? renderMedia(ex.mediaUrl, true)
                                    : hasDrawing(ex.drawing)
                                        ? <DrillCanvas drawing={parseDrawing(ex.drawing)!} className="w-full h-full" preserveAspectRatio="xMidYMid slice" />
                                        : <ImageIcon size={24} className="text-slate-700" />}

                                {/* Floating "View" Icon on Hover if media exists */}
                                {ex.mediaUrl && (
                                    <div className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Maximize2 size={14} />
                                    </div>
                                )}
                            </div>

                            <p className="text-sm text-muted line-clamp-2 mb-5 leading-relaxed">{ex.description}</p>
                            <div className="flex flex-wrap gap-2 mt-auto">
                                {ex.equipment.slice(0, 3).map((e, i) => <span key={i} className="text-[10px] bg-surface text-muted px-2 py-1 rounded border border-border">{e}</span>)}
                                {ex.equipment.length > 3 && <span className="text-[10px] text-muted pt-1">+{ex.equipment.length - 3}</span>}
                            </div>
                        </Card>
                    ))}
                </AnimatePresence>
            </div>

            <ExerciseSlideOver
                exercise={!showCreateModal ? selectedExercise : null}
                onClose={() => setSelectedExercise(null)}
                onEdit={(ex) => { setSelectedExercise(null); openEditModal(ex); }}
                onDelete={(id) => { setSelectedExercise(null); setConfirmDeleteId(id); }}
            />

            {/* CREATE / EDIT FORM MODAL */}
            <Modal isOpen={showCreateModal} onClose={closeModal} title={isEditing ? t('libraries.editExercise') : t('libraries.addExercise')} maxWidth="max-w-3xl"
                footer={<div className="flex gap-3"><Button variant="ghost" onClick={closeModal} className="flex-1">{t('common.cancel')}</Button><Button onClick={handleSave} className="flex-1">{t('common.save')}</Button></div>}>
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-4">
                            <Input label={t('common.name')} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Rondo 4v2" />
                            <Select
                                label={t('libraries.category')}
                                placeholder={t('libraries.selectCategory')}
                                value={formData.category}
                                onChange={val => setFormData({ ...formData, category: val as string })}
                                options={[
                                    // Leading "—" lets the user clear a previously chosen category.
                                    { label: '—', value: '' },
                                    ...EXERCISE_CATEGORIES.map(c => ({ label: t(`exerciseCategories.${c}`), value: c })),
                                ]}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Select label={t('training.intensity')} value={formData.intensity} onChange={val => setFormData({ ...formData, intensity: val as Exercise['intensity'] })} options={INTENSITIES.map(v => ({ label: t(intensityMeta(v).labelKey), value: v }))} />
                                <Input label={t('libraries.goalkeepers')} type="number" value={formData.goalkeepers} onChange={e => setFormData({ ...formData, goalkeepers: parseInt(e.target.value) || 0 })} />
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-muted uppercase tracking-widest ml-1 mb-2 block">{t('libraries.visuals')}</label>
                            <div className="h-32 bg-surface-hover border-2 border-dashed border-border rounded-xl relative group hover:border-primary/30 transition-colors flex flex-col items-center justify-center text-muted overflow-hidden">
                                {mediaPreview ? (
                                    <>
                                        {getMediaType(mediaPreview) === 'image' && <img src={mediaPreview} className="w-full h-full object-cover" />}
                                        {getMediaType(mediaPreview) === 'video' && <VideoIcon size={32} className="text-slate-400" />}
                                        {getMediaType(mediaPreview) === 'pdf' && <FileText size={32} className="text-slate-400" />}
                                        <button onClick={(e) => { e.stopPropagation(); setMediaPreview(null); setFormData({ ...formData, mediaUrl: '' }); }} className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"><X size={14} /></button>
                                    </>
                                ) : hasDrawing(formData.drawing) ? (
                                    <>
                                        <DrillCanvas drawing={parseDrawing(formData.drawing)!} className="w-full h-full" />
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                            <button type="button" title={t('drill.edit')} onClick={() => setShowDrillEditor(true)} className="bg-black/60 p-1.5 rounded-full text-white"><Edit2 size={14} /></button>
                                            <button type="button" title={t('drill.remove')} onClick={() => setFormData({ ...formData, drawing: '' })} className="bg-black/60 p-1.5 rounded-full text-white"><X size={14} /></button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full grid grid-cols-2">
                                        <label className="cursor-pointer flex flex-col items-center justify-center gap-1.5 hover:text-blue-400 hover:bg-surface transition-colors border-r border-border">
                                            <Upload size={20} />
                                            <span className="text-[10px] uppercase font-bold tracking-wider text-center px-1">{t('libraries.uploadMedia')}</span>
                                            <input type="file" className="hidden" accept="image/*,video/*,application/pdf" onChange={handleFileUpload} />
                                        </label>
                                        <button type="button" onClick={() => setShowDrillEditor(true)} className="flex flex-col items-center justify-center gap-1.5 hover:text-amber-400 hover:bg-surface transition-colors">
                                            <PenTool size={20} />
                                            <span className="text-[10px] uppercase font-bold tracking-wider text-center px-1">{t('drill.draw')}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                            {!mediaPreview && hasDrawing(formData.drawing) && (
                                <p className="text-[10px] text-muted mt-1.5 ml-1">{t('drill.usedInPdf')}</p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        {[
                            { label: t('common.description'), key: 'description', placeholder: t('libraries.enterDescription') },
                            { label: t('libraries.setup'), key: 'setup', placeholder: t('libraries.enterSetup') },
                            { label: t('libraries.variations'), key: 'variations', placeholder: t('libraries.enterVariations') },
                            { label: t('libraries.coachingPoints'), key: 'coachingPoints', placeholder: t('libraries.enterCoachingPoints') }
                        ].map(field => (
                            <div key={field.key}>
                                <label className="text-[11px] font-bold text-muted uppercase tracking-widest ml-1 mb-1 block">{field.label}</label>
                                <textarea
                                    className="w-full bg-surface-hover border border-border text-foreground rounded-xl px-4 py-3 text-sm outline-none transition-all focus:bg-surface focus:border-primary/50 hover:border-border resize-none h-20 custom-scrollbar placeholder:text-dimmed"
                                    value={(formData as any)[field.key]}
                                    onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                                    placeholder={field.placeholder}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="w-full h-[1px] bg-border"></div>

                    <div>
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">{t('libraries.equipment')}</label>
                        <div className="flex flex-wrap gap-2">
                            {EQUIPMENT_OPTIONS.map(item => (
                                <button key={item} type="button" onClick={() => toggleSelection('equipment', item)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${formData.equipment.includes(item) ? 'bg-primary border-primary text-white' : 'bg-surface-raised border-border text-muted hover:border-border-subtle'}`}>
                                    {item}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="w-full h-[1px] bg-border"></div>

                    <div className="space-y-3">
                        {[
                            { label: t('libraries.linkedBasics'), list: allBasics, field: 'linkedBasics' as const, search: basicsSearch, setSearch: setBasicsSearch, color: 'text-blue-400', borderHover: 'hover:border-blue-500/30' },
                            { label: t('libraries.linkedPrinciples'), list: allPrinciples, field: 'linkedPrinciples' as const, search: principlesSearch, setSearch: setPrinciplesSearch, color: 'text-purple-400', borderHover: 'hover:border-purple-500/30' },
                            { label: t('libraries.linkedTactics'), list: allTactics, field: 'linkedTactics' as const, search: tacticsSearch, setSearch: setTacticsSearch, color: 'text-emerald-400', borderHover: 'hover:border-emerald-500/30' },
                        ].map(section => {
                            const isOpen = openSection === section.label;
                            const count = formData[section.field].length;
                            return (
                                <div key={section.label} className={`bg-surface-hover/30 border border-border rounded-xl overflow-hidden transition-colors ${section.borderHover}`}>
                                    <button onClick={() => setOpenSection(isOpen ? null : section.label)} className="w-full flex items-center justify-between p-4 text-left hover:bg-surface transition-colors">
                                        <span className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${isOpen ? section.color : 'text-muted'}`}>
                                            {section.label}
                                            {count > 0 && <span className={`bg-white/10 px-2 py-0.5 rounded-md text-[10px] text-white`}>{t('libraries.equipmentSelected', { count })}</span>}
                                        </span>
                                        {isOpen ? <ChevronDown size={16} className={section.color} /> : <ChevronRight size={16} className="text-slate-500" />}
                                    </button>
                                    {isOpen && (
                                        <div className="p-4 pt-0 border-t border-border">
                                            <div className="flex items-center gap-2 mb-3 mt-3">
                                                <Search size={14} className="text-slate-500" />
                                                <input className="bg-transparent outline-none text-sm w-full text-slate-300 placeholder-slate-600" placeholder={`${t('common.search')}...`} value={section.search} onChange={e => section.setSearch(e.target.value)} />
                                            </div>
                                            <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                                                {section.list.filter(item => item.name.toLowerCase().includes(section.search.toLowerCase())).map(item => (
                                                    <label key={item.id} className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors group">
                                                        <div className={`w-4 h-4 border rounded flex items-center justify-center transition-all ${formData[section.field].includes(item.name) ? `bg-current border-current ${section.color}` : 'border-slate-600 group-hover:border-slate-500'}`}>
                                                            {formData[section.field].includes(item.name) && <Check size={12} className="text-black" />}
                                                        </div>
                                                        <span className="text-sm text-slate-300">{item.name}</span>
                                                        <input type="checkbox" className="hidden" checked={formData[section.field].includes(item.name)} onChange={() => toggleSelection(section.field, item.name)} />
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Modal>

            <DrillEditor
                isOpen={showDrillEditor}
                initial={formData.drawing}
                onClose={() => setShowDrillEditor(false)}
                onApply={(json) => { setFormData(prev => ({ ...prev, drawing: json })); setShowDrillEditor(false); }}
            />

            {/* LIGHTBOX VIEWER */}
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
                title={t('libraries.deleteExerciseTitle')}
                message={t('libraries.deleteExerciseMsg')}
                confirmLabel={t('common.delete')}
                onConfirm={() => { if (confirmDeleteId) handleDeleteExercise(confirmDeleteId); setConfirmDeleteId(null); }}
                onCancel={() => setConfirmDeleteId(null)}
            />

            <PlaybookManagementModal 
                isOpen={showPlaybookModal} 
                onClose={() => setShowPlaybookModal(false)}
                onImportSuccess={fetchExercises}
            />
        </div>
    );
}