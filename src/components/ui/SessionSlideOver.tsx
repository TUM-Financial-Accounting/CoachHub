import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit2, Trash2, Download, Calendar, Clock, Users, Activity, Dumbbell, Zap, BookOpen, Layers, Target, Image as ImageIcon } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { Exercise } from '../../types/models';

import { SessionSlideOverProps } from "../../types/ui";

const intensityStyles: Record<string, { badge: string; bar: string; width: string }> = {
    Low:    { badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', bar: 'bg-emerald-500', width: '33%' },
    Medium: { badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',   bar: 'bg-amber-500',   width: '66%' },
    High:   { badge: 'bg-rose-500/10 border-rose-500/20 text-rose-400',       bar: 'bg-rose-500',    width: '100%' },
};

const getMediaType = (url?: string) => {
    if (!url) return null;
    if (url.startsWith('data:image') || url.match(/\.(jpeg|jpg|gif|png)$/i)) return 'image';
    if (url.startsWith('data:video') || url.match(/\.(mp4|webm)$/i)) return 'video';
    return null;
};

export default function SessionSlideOver({
    session, allPlayers, allExercises, isPast, onClose, onEdit, onDelete, onExportPDF,
}: SessionSlideOverProps) {
    if (!session) return null;

    const style = intensityStyles[session.intensity] ?? intensityStyles.Medium;
    const playerIds = session.selectedPlayers.split(',').map(id => id.trim()).filter(Boolean);
    const exerciseIds = session.selectedExercises.split(',').map(id => id.trim()).filter(Boolean);

    const players = allPlayers.filter(p => playerIds.includes(p.id));
    const exercises = exerciseIds
        .map(id => allExercises.find(e => e.id === id))
        .filter((e): e is Exercise => !!e);

    // Duration in minutes
    const [sh, sm] = session.startTime.split(':').map(Number);
    const [eh, em] = session.endTime.split(':').map(Number);
    const durationMin = (eh * 60 + em) - (sh * 60 + sm);
    const durationLabel = durationMin > 0 ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? ` ${durationMin % 60}m` : ''}` : session.endTime;

    return (
        <AnimatePresence>
            {session && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="sess-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-overlay backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Panel */}
                    <motion.aside
                        key="sess-panel"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                        className="fixed inset-y-0 right-0 z-50 w-full max-w-lg flex flex-col bg-background border-l border-border-subtle shadow-2xl overflow-hidden"
                    >
                        {/* Gradient header */}
                        <div className="flex-shrink-0 relative">
                            <div className={`h-28 ${isPast ? 'bg-gradient-to-br from-slate-800/60 via-slate-900/30' : 'bg-gradient-to-br from-cyan-900/40 via-blue-900/20'} to-transparent`} />

                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 rounded-xl bg-surface-hover hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
                            >
                                <X size={18} />
                            </button>

                            <div className="absolute bottom-0 left-0 right-0 px-6 pb-4 flex items-end gap-4">
                                <div className={`w-14 h-14 rounded-2xl p-[2px] shadow-xl flex-shrink-0 ${isPast ? 'bg-gradient-to-br from-slate-500 to-slate-700 shadow-slate-500/10' : 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-500/20'}`}>
                                    <div className="w-full h-full rounded-[14px] bg-surface flex items-center justify-center">
                                        <Activity size={22} className={isPast ? 'text-muted' : 'text-cyan-400'} />
                                    </div>
                                </div>
                                <div className="pb-1 min-w-0">
                                    <h2 className="text-xl font-bold text-foreground truncate">{session.focus}</h2>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${style.badge}`}>
                                            {session.intensity}
                                        </span>
                                        <span className="flex items-center gap-1 text-[11px] text-muted">
                                            <Calendar size={10} /> {formatDate(session.date)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-5">

                            {/* Intensity bar */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5"><Zap size={10} /> Intensity</span>
                                    <span className={`text-xs font-bold ${style.badge.split(' ').find(c => c.startsWith('text-'))}`}>{session.intensity}</span>
                                </div>
                                <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: style.width }}
                                        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                                        className={`h-full rounded-full ${style.bar}`}
                                    />
                                </div>
                            </div>

                            {/* Quick stats */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { icon: <Clock size={13} />, label: 'Duration', value: durationLabel, color: 'text-cyan-400' },
                                    { icon: <Users size={13} />, label: 'Players', value: String(players.length), color: 'text-indigo-400' },
                                    { icon: <Dumbbell size={13} />, label: 'Drills', value: String(exercises.length), color: 'text-amber-400' },
                                ].map(stat => (
                                    <div key={stat.label} className="bg-surface-hover border border-border-subtle rounded-xl p-3 text-center">
                                        <div className={`flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${stat.color}`}>
                                            {stat.icon} {stat.label}
                                        </div>
                                        <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Time */}
                            <div className="flex items-center gap-3 px-4 py-3 bg-surface-hover border border-border-subtle rounded-xl">
                                <Clock size={15} className="text-muted flex-shrink-0" />
                                <div>
                                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Session Time</p>
                                    <p className="text-sm font-semibold text-foreground font-mono">{session.startTime} – {session.endTime}</p>
                                </div>
                            </div>

                            {/* Exercise sequence */}
                            {exercises.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <Dumbbell size={10} /> Drill Sequence
                                        <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px]">{exercises.length}</span>
                                    </p>
                                    <div className="space-y-2">
                                        {exercises.map((ex, i) => {
                                            const mediaType = getMediaType(ex.mediaUrl);
                                            return (
                                                <div key={ex.id} className="bg-surface-hover border border-border-subtle rounded-xl overflow-hidden">
                                                    <div className="flex gap-3 p-3">
                                                        {/* Thumbnail */}
                                                        <div className="w-12 h-12 rounded-lg bg-surface-raised flex-shrink-0 overflow-hidden flex items-center justify-center">
                                                            {mediaType === 'image' && ex.mediaUrl
                                                                ? <img src={ex.mediaUrl} className="w-full h-full object-cover" alt={ex.name} />
                                                                : <ImageIcon size={18} className="text-dimmed" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <span className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                                                                <p className="text-sm font-semibold text-foreground truncate">{ex.name}</p>
                                                            </div>
                                                            {ex.intensity && (
                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${intensityStyles[ex.intensity]?.badge ?? 'text-muted border-border'}`}>
                                                                    {ex.intensity}
                                                                </span>
                                                            )}
                                                            {ex.equipment && ex.equipment.length > 0 && ex.equipment[0] !== '' && (
                                                                <p className="text-[10px] text-dimmed mt-1 truncate">{ex.equipment.slice(0, 3).join(', ')}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Description if present */}
                                                    {ex.description && (
                                                        <div className="px-3 pb-3 border-t border-border-subtle pt-2">
                                                            <p className="text-[11px] text-muted leading-relaxed line-clamp-2">{ex.description}</p>
                                                        </div>
                                                    )}
                                                    {/* Linked tags */}
                                                    {((ex.linkedBasics?.length && ex.linkedBasics[0]) || (ex.linkedPrinciples?.length && ex.linkedPrinciples[0]) || (ex.linkedTactics?.length && ex.linkedTactics[0])) ? (
                                                        <div className="px-3 pb-2.5 flex flex-wrap gap-1.5">
                                                            {ex.linkedBasics?.filter(Boolean).map(b => (
                                                                <span key={b} className="text-[9px] px-1.5 py-0.5 rounded border border-sky-500/20 bg-sky-500/10 text-sky-400 flex items-center gap-0.5"><BookOpen size={8} />{b}</span>
                                                            ))}
                                                            {ex.linkedPrinciples?.filter(Boolean).map(p => (
                                                                <span key={p} className="text-[9px] px-1.5 py-0.5 rounded border border-violet-500/20 bg-violet-500/10 text-violet-400 flex items-center gap-0.5"><Layers size={8} />{p}</span>
                                                            ))}
                                                            {ex.linkedTactics?.filter(Boolean).map(t => (
                                                                <span key={t} className="text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 flex items-center gap-0.5"><Target size={8} />{t}</span>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Players */}
                            {players.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <Users size={10} /> Attending Players
                                        <span className="ml-1 px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px]">{players.length}</span>
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {players.map(p => (
                                            <span key={p.id} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-hover border border-border-subtle text-foreground">
                                                {p.firstName} {p.lastName}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex-shrink-0 px-6 py-4 border-t border-border-subtle bg-overlay flex gap-2">
                            <button
                                onClick={() => onEdit(session)}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-cyan-500/20"
                            >
                                <Edit2 size={15} /> Edit
                            </button>
                            <button
                                onClick={() => onExportPDF(session)}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface-hover hover:bg-surface-hover text-foreground border border-border-subtle text-sm font-semibold transition-all"
                                title="Export PDF"
                            >
                                <Download size={15} />
                            </button>
                            <button
                                onClick={() => onDelete(session.id)}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface-hover hover:bg-rose-500/10 text-muted hover:text-rose-400 border border-border-subtle hover:border-rose-500/20 text-sm font-semibold transition-all"
                                title="Delete"
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}
