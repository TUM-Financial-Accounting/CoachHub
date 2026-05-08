import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit2, Trash2, Phone, Calendar, Ruler, Weight, Shield, Hash, User, TrendingUp, Clock, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { formatDate } from '../lib/utils';
import { TrainingSession } from '../types/models';
import { PlayerSlideOverProps } from '../types/ui';
import { TrainingService } from '../services';

const intensityColor: Record<string, string> = {
    High: '#f43f5e',
    Medium: '#f59e0b',
    Low: '#10b981',
};

const getPerfColor = (score: number) => {
    if (score >= 7) return { bg: 'bg-emerald-500', text: 'text-emerald-400', hex: '#10b981' };
    if (score >= 4) return { bg: 'bg-amber-500', text: 'text-amber-400', hex: '#f59e0b' };
    return { bg: 'bg-rose-500', text: 'text-rose-400', hex: '#f43f5e' };
};

const getStatusColor = (status: string) => {
    switch (status) {
        case 'Active': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        case 'Injured': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
        case 'Away': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
};

export default function PlayerSlideOver({ player, computedAttendance, onClose, onEdit, onDelete }: PlayerSlideOverProps) {
    const [sessions, setSessions] = useState<TrainingSession[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);

    useEffect(() => {
        if (!player) return;
        setLoadingSessions(true);
        TrainingService.getAll()
            .then((data) => {
                const mapped = data
                    .filter(s => {
                        const playerIds = s.selectedPlayers ? s.selectedPlayers.split(',').map(id => id.trim()) : [];
                        return playerIds.includes(player.id);
                    })
                    .sort((a, b) => b.date.localeCompare(a.date));
                setSessions(mapped);
            })
            .catch(() => {})
            .finally(() => setLoadingSessions(false));
    }, [player?.id]);

    // Last 6 months attendance chart data
    const chartData = (() => {
        if (!sessions.length) return [];
        const monthMap: Record<string, number> = {};
        const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        sessions.forEach(s => {
            const m = monthOrder[new Date(s.date + 'T12:00:00').getMonth()];
            monthMap[m] = (monthMap[m] || 0) + 1;
        });
        return monthOrder.filter(m => monthMap[m]).map(m => ({ month: m, sessions: monthMap[m] })).slice(-6);
    })();

    const attendance = computedAttendance[player?.id ?? ''] ?? player?.attendance ?? 0;
    const perf = player?.performance ?? 0;
    const perfStyle = getPerfColor(perf);

    // Age from DOB
    const age = player?.dateOfBirth
        ? Math.floor((Date.now() - new Date(player.dateOfBirth + 'T12:00:00').getTime()) / (365.25 * 24 * 3600 * 1000))
        : null;

    return (
        <AnimatePresence>
            {player && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Panel */}
                    <motion.aside
                        key="panel"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                        className="fixed inset-y-0 right-0 z-50 w-full max-w-md flex flex-col bg-surface border-l border-border shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="relative flex-shrink-0">
                            {/* Gradient bg strip */}
                            <div className="h-32 bg-gradient-to-br from-indigo-900/50 via-blue-900/30 to-transparent" />

                            {/* Close */}
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 rounded-xl bg-surface-raised/50 hover:bg-surface-raised text-muted hover:text-foreground transition-colors"
                            >
                                <X size={18} />
                            </button>

                            {/* Avatar + name */}
                            <div className="absolute bottom-0 left-0 right-0 px-6 pb-4 flex items-end gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-[2px] shadow-xl shadow-blue-600/30 flex-shrink-0">
                                    <div className="w-full h-full rounded-[14px] bg-background flex items-center justify-center overflow-hidden">
                                        {player.imageUrl
                                            ? <img src={player.imageUrl} className="w-full h-full object-cover" alt={player.firstName} />
                                            : <span className="text-2xl font-bold text-blue-400">{player.firstName[0]}</span>}
                                    </div>
                                </div>
                                <div className="pb-1 min-w-0">
                                    <h2 className="text-xl font-bold text-foreground truncate">{player.firstName} {player.lastName}</h2>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className="text-xs font-semibold text-muted font-mono">#{player.jerseyNumber}</span>
                                        <span className="text-border">·</span>
                                        <span className="text-xs text-muted">{player.position}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(player.status)}`}>{player.status}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Scrollable body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-6">

                            {/* Key stats row */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'Attendance', value: `${attendance}%`, color: 'text-blue-400', icon: <Activity size={14} /> },
                                    { label: 'Performance', value: `${perf}/10`, color: perfStyle.text, icon: <TrendingUp size={14} /> },
                                    { label: 'Sessions', value: String(sessions.length), color: 'text-slate-300', icon: <Clock size={14} /> },
                                ].map(stat => (
                                    <div key={stat.label} className="bg-surface-hover border border-border rounded-xl p-3 text-center">
                                        <div className={`flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${stat.color}`}>
                                            {stat.icon} {stat.label}
                                        </div>
                                        <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Performance bar */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-muted uppercase tracking-wider">Performance Rating</span>
                                    <span className={`text-sm font-bold ${perfStyle.text}`}>{perf} / 10</span>
                                </div>
                                <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${perf * 10}%` }}
                                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                        className={`h-full rounded-full ${perfStyle.bg}`}
                                    />
                                </div>
                            </div>

                            {/* Attendance chart */}
                            {chartData.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Sessions per Month</p>
                                    <div className="h-32">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                                                <Tooltip
                                                    contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12 }}
                                                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                                    itemStyle={{ color: '#e2e8f0' }}
                                                />
                                                <Bar dataKey="sessions" radius={[4, 4, 0, 0]} maxBarSize={28}>
                                                    {chartData.map((_, i) => (
                                                        <Cell key={i} fill={i === chartData.length - 1 ? '#6366f1' : '#1e293b'} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Bio */}
                            <div>
                                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Profile</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { icon: <Calendar size={13} />, label: 'Date of Birth', value: player.dateOfBirth ? `${formatDate(player.dateOfBirth)}${age !== null ? ` (${age} yrs)` : ''}` : '—' },
                                        { icon: <Shield size={13} />, label: 'Position', value: player.position || '—' },
                                        { icon: <Ruler size={13} />, label: 'Height', value: player.height ? `${player.height} cm` : '—' },
                                        { icon: <Weight size={13} />, label: 'Weight', value: player.weight ? `${player.weight} kg` : '—' },
                                        { icon: <Hash size={13} />, label: 'Jersey', value: player.jerseyNumber ? `#${player.jerseyNumber}` : '—' },
                                    ].map(item => (
                                        <div key={item.label} className="bg-surface-hover border border-border rounded-xl px-3 py-2.5">
                                            <div className="flex items-center gap-1.5 text-dimmed text-[10px] font-semibold uppercase tracking-wider mb-1">
                                                {item.icon} {item.label}
                                            </div>
                                            <p className="text-sm font-semibold text-foreground">{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Contact */}
                            {(player.playerPhone || player.motherName || player.fatherName) && (
                                <div>
                                    <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Contacts</p>
                                    <div className="space-y-2">
                                        {player.playerPhone && (
                                            <div className="flex items-center gap-3 px-3 py-2.5 bg-surface-hover border border-border rounded-xl">
                                                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                                                    <User size={13} className="text-indigo-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-semibold text-dimmed uppercase">Player</p>
                                                    <p className="text-sm font-medium text-foreground font-mono">{player.playerPhone}</p>
                                                </div>
                                            </div>
                                        )}
                                        {player.motherName && (
                                            <div className="flex items-center gap-3 px-3 py-2.5 bg-surface-hover border border-border rounded-xl">
                                                <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                                                    <Phone size={13} className="text-rose-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-semibold text-dimmed uppercase">Mother — {player.motherName}</p>
                                                    <p className="text-sm font-medium text-foreground font-mono">{player.motherPhone || '—'}</p>
                                                </div>
                                            </div>
                                        )}
                                        {player.fatherName && (
                                            <div className="flex items-center gap-3 px-3 py-2.5 bg-surface-hover border border-border rounded-xl">
                                                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                                    <Phone size={13} className="text-blue-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-semibold text-dimmed uppercase">Father — {player.fatherName}</p>
                                                    <p className="text-sm font-medium text-foreground font-mono">{player.fatherPhone || '—'}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Training history */}
                            <div>
                                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                                    Training History {sessions.length > 0 && <span className="ml-1 text-dimmed">({sessions.length})</span>}
                                </p>
                                {loadingSessions ? (
                                    <div className="space-y-2">
                                        {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-white/[0.03] animate-pulse" />)}
                                    </div>
                                ) : sessions.length === 0 ? (
                                    <div className="text-center py-8 text-dimmed border border-dashed border-border rounded-xl">
                                        <Activity size={24} className="mx-auto mb-2 opacity-40" />
                                        <p className="text-sm">No sessions recorded</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {sessions.slice(0, 10).map(s => (
                                            <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface-hover border border-border rounded-xl">
                                                <div className="w-8 h-8 rounded-lg bg-surface-raised flex flex-col items-center justify-center flex-shrink-0">
                                                    <span className="text-[8px] font-bold text-muted uppercase leading-none">
                                                        {new Date(s.date + 'T12:00:00').toLocaleDateString('en-GB', { month: 'short' })}
                                                    </span>
                                                    <span className="text-xs font-bold text-foreground leading-tight">{s.date.slice(8, 10)}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-foreground truncate">{s.focus}</p>
                                                    <p className="text-[10px] text-muted">{s.startTime} – {s.endTime}</p>
                                                </div>
                                                <span
                                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase"
                                                    style={{
                                                        backgroundColor: `${intensityColor[s.intensity] ?? '#94a3b8'}15`,
                                                        borderColor: `${intensityColor[s.intensity] ?? '#94a3b8'}30`,
                                                        color: intensityColor[s.intensity] ?? '#94a3b8',
                                                    }}
                                                >
                                                    {s.intensity}
                                                </span>
                                            </div>
                                        ))}
                                        {sessions.length > 10 && (
                                            <p className="text-center text-xs text-slate-600 pt-1">+{sessions.length - 10} more sessions</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer actions */}
                        <div className="flex-shrink-0 px-6 py-4 border-t border-border bg-surface-hover/50 flex gap-3">
                            <button
                                onClick={() => onEdit(player)}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-500/20"
                            >
                                <Edit2 size={15} /> Edit Profile
                            </button>
                            <button
                                onClick={() => onDelete(player.id)}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface-raised hover:bg-rose-500/10 text-muted hover:text-rose-400 border border-border hover:border-rose-500/20 text-sm font-semibold transition-all"
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