import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit2, Trash2, FileText, Video as VideoIcon, Dumbbell, Users, Layers, BookOpen, Target, Zap } from 'lucide-react';
import {ExerciseSlideOverProps} from "../types/ui"

const getIntensityStyles = (intensity: string) => {
    switch (intensity) {
        case 'Low': return { badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', hex: '#10b981', bar: 'bg-emerald-500', width: '33%' };
        case 'High': return { badge: 'bg-rose-500/10 border-rose-500/20 text-rose-400', hex: '#f43f5e', bar: 'bg-rose-500', width: '100%' };
        default: return { badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400', hex: '#f59e0b', bar: 'bg-amber-500', width: '66%' };
    }
};

const getMediaType = (url?: string) => {
    if (!url) return null;
    const normalized = url.toLowerCase();
    const cleanUrl = normalized.split('#')[0].split('?')[0];

    if (normalized.startsWith('data:image')) return 'image';
    if (normalized.startsWith('data:video')) return 'video';
    if (normalized.startsWith('data:application/pdf')) return 'pdf';
    if (cleanUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i)) return 'image';
    if (cleanUrl.match(/\.(mp4|webm|ogg|ogv|mov|m4v|mkv)$/i)) return 'video';
    if (cleanUrl.endsWith('.pdf')) return 'pdf';
    return 'unknown';
};

export default function ExerciseSlideOver({ exercise, onClose, onEdit, onDelete }: ExerciseSlideOverProps) {
    const intensity = exercise ? getIntensityStyles(exercise.intensity) : null;

    const renderMedia = (url: string) => {
        const type = getMediaType(url);
        if (type === 'image') return <img src={url} alt="Exercise visual" className="w-full h-full object-cover" />;
        if (type === 'video') return (
            <video src={url} controls className="w-full h-full rounded-t-none" />
        );
        if (type === 'pdf') return (
            <div className="flex flex-col items-center justify-center h-full text-muted gap-2">
                <FileText size={40} />
                <span className="text-sm font-medium">PDF Document</span>
                <a href={url} download="exercise.pdf" className="text-primary text-xs hover:underline">Download</a>
            </div>
        );
        return (
            <div className="flex flex-col items-center justify-center h-full text-dimmed gap-2">
                <VideoIcon size={32} />
                <span className="text-xs">Unsupported media</span>
            </div>
        );
    };

    return (
        <AnimatePresence>
            {exercise && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="ex-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Panel */}
                    <motion.aside
                        key="ex-panel"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                        className="fixed inset-y-0 right-0 z-50 w-full max-w-lg flex flex-col bg-surface border-l border-border shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex-shrink-0 relative">
                            {/* Amber gradient strip */}
                            <div className="h-28 bg-gradient-to-br from-amber-900/40 via-orange-900/20 to-transparent" />

                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 rounded-xl bg-surface-raised/50 hover:bg-surface-raised text-muted hover:text-foreground transition-colors"
                            >
                                <X size={18} />
                            </button>

                            <div className="absolute bottom-0 left-0 right-0 px-6 pb-4 flex items-end gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-[2px] shadow-xl shadow-amber-500/20 flex-shrink-0">
                                    <div className="w-full h-full rounded-[14px] bg-background flex items-center justify-center">
                                        <Dumbbell size={22} className="text-amber-400" />
                                    </div>
                                </div>
                                <div className="pb-1 min-w-0">
                                    <h2 className="text-xl font-bold text-foreground truncate">{exercise.name}</h2>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${intensity?.badge}`}>
                                            {exercise.intensity} Intensity
                                        </span>
                                        {exercise.goalkeepers > 0 && (
                                            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-border text-muted">
                                                <Users size={9} /> {exercise.goalkeepers} GK
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Scrollable body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-5 px-6 py-5">

                            {/* Intensity bar */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
                                        <Zap size={10} /> Intensity
                                    </span>
                                    <span className={`text-xs font-bold ${intensity?.badge.split(' ').find(c => c.startsWith('text-'))}`}>{exercise.intensity}</span>
                                </div>
                                <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: intensity?.width ?? '0%' }}
                                        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                                        className={`h-full rounded-full ${intensity?.bar}`}
                                    />
                                </div>
                            </div>

                            {/* Media */}
                            {exercise.mediaUrl && (
                                <div className="w-full h-52 bg-background rounded-xl overflow-hidden border border-border shadow-lg">
                                    {renderMedia(exercise.mediaUrl)}
                                </div>
                            )}

                            {/* Text sections */}
                            {[
                                { label: 'Description', value: exercise.description },
                                { label: 'Setup', value: exercise.setup },
                                { label: 'Coaching Points', value: exercise.coachingPoints },
                                { label: 'Variations', value: exercise.variations },
                            ].filter(s => s.value).map(section => (
                                <div key={section.label}>
                                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">{section.label}</p>
                                    <div className="bg-surface-hover border border-border rounded-xl px-4 py-3 text-sm text-foreground/80 leading-relaxed">
                                        {section.value}
                                    </div>
                                </div>
                            ))}

                            {/* Equipment */}
                            {exercise.equipment.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">Equipment</p>
                                    <div className="flex flex-wrap gap-2">
                                        {exercise.equipment.map(item => (
                                            <span key={item} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-raised border border-border text-foreground/80">
                                                {item}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Linked library items */}
                            {[
                                { label: 'Related Basics', items: exercise.linkedBasics, icon: <BookOpen size={11} />, style: 'bg-sky-500/10 border-sky-500/20 text-sky-400' },
                                { label: 'Related Principles', items: exercise.linkedPrinciples, icon: <Layers size={11} />, style: 'bg-violet-500/10 border-violet-500/20 text-violet-400' },
                                { label: 'Related Tactics', items: exercise.linkedTactics, icon: <Target size={11} />, style: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
                            ].filter(s => s.items.length > 0).map(section => (
                                <div key={section.label}>
                                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        {section.icon} {section.label}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {section.items.map(item => (
                                            <span key={item} className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${section.style}`}>{item}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        {exercise.isCustom && (
                            <div className="flex-shrink-0 px-6 py-4 border-t border-border bg-surface-hover/50 flex gap-3">
                                <button
                                    onClick={() => onEdit(exercise)}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-amber-500/20"
                                >
                                    <Edit2 size={15} /> Edit Exercise
                                </button>
                                <button
                                    onClick={() => onDelete(exercise.id)}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface-raised hover:bg-rose-500/10 text-muted hover:text-rose-400 border border-border hover:border-rose-500/20 text-sm font-semibold transition-all"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        )}
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}
