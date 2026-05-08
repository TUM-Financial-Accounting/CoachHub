import { useState, useEffect } from 'react';
import { Search, Edit2, Plus, Trash2, Camera, Shield, Hash, Ruler, Weight, User, TrendingUp, Users, ChevronUp, ChevronDown, ChevronsUpDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// UI Components
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Modal } from "./ui/Modal";
import { DatePicker } from "./ui/DatePicker";
import { uploadFile } from "../lib/uploadFile";
import { PlayerRowSkeleton } from "./ui/Skeleton";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import PlayerSlideOver from "./PlayerSlideOver";
import { Player, Team } from '../types/models';
import { PlayerService, TrainingService } from '../services';
import { useTeam } from '../contexts/TeamContext';

export default function TeamManagement() {
    const { activeTeam, teams } = useTeam();
    const [players, setPlayers] = useState<Player[]>([]); // Initialize empty (No Mock Data)
    const [searchQuery, setSearchQuery] = useState('');
    const [showPlayerModal, setShowPlayerModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [computedAttendance, setComputedAttendance] = useState<Record<string, number>>({});
    const [editingPerf, setEditingPerf] = useState<string | null>(null);
    const [perfDraft, setPerfDraft] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'squad' | 'pool'>('squad');
    const [assignmentPlayer, setAssignmentPlayer] = useState<Player | null>(null);
    const [duplicatePlayer, setDuplicatePlayer] = useState<Player | null>(null);

    type SortKey = 'jerseyNumber' | 'firstName' | 'position' | 'attendance' | 'performance' | 'status' | 'teams';
    const [sortKey, setSortKey] = useState<SortKey>('jerseyNumber');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const [formData, setFormData] = useState<Player>({
        id: '', firstName: '', lastName: '', dateOfBirth: '', position: 'Forward', jerseyNumber: 0, status: 'Active', playerPhone: '', height: 0, weight: 0, motherName: '', motherPhone: '', fatherName: '', fatherPhone: '', imageUrl: '', attendance: 0, performance: 0
    });

    // --- Load Data ---
    const refreshData = () => {
        if (!activeTeam && viewMode === 'squad') return;
        setLoading(true);
        
        // Fetch based on view mode
        const teamFilter = viewMode === 'squad' ? activeTeam?.id : undefined;
        
        PlayerService.getAll(teamFilter)
            .then(data => {
                setPlayers(data);
            })
            .catch(() => {})
            .finally(() => setLoading(false));

        // Compute real attendance from training sessions (only if team is active)
        if (activeTeam) {
            TrainingService.getAll(activeTeam.id)
                .then((sessions) => {
                    if (sessions.length === 0) {
                        setComputedAttendance({});
                        return;
                    }
                    const countMap: Record<string, number> = {};
                    sessions.forEach(s => {
                        (s.selectedPlayers || '').split(',').forEach((id: string) => {
                            const trimmed = id.trim();
                            if (trimmed) countMap[trimmed] = (countMap[trimmed] || 0) + 1;
                        });
                    });
                    const pctMap: Record<string, number> = {};
                    Object.entries(countMap).forEach(([id, count]) => {
                        pctMap[id] = Math.round((count / sessions.length) * 100);
                    });
                    setComputedAttendance(pctMap);
                })
                .catch(() => {});
        }
    };

    useEffect(() => {
        refreshData();
    }, [activeTeam, viewMode]);

    // --- Handlers ---
    const handleSave = async () => {
        if (!formData.firstName || !formData.lastName) {
            toast.error('Name required');
            return;
        }

        const isEditMode = !!editingId && !!formData.id;

        // Duplicate Check (only for new signings)
        if (!isEditMode) {
            try {
                const allPlayers = await PlayerService.getAll();
                const match = allPlayers.find(p => 
                    p.firstName.trim().toLowerCase() === formData.firstName.trim().toLowerCase() && 
                    p.lastName.trim().toLowerCase() === formData.lastName.trim().toLowerCase()
                );
                
                if (match) {
                    setDuplicatePlayer(match);
                    return; // Stop and wait for user's decision
                }
            } catch (e) {
                console.error("Duplicate check failed", e);
            }
        }

        try {
            const formattedPlayer = isEditMode
                ? await PlayerService.update(formData.id, formData)
                : await PlayerService.create(formData, activeTeam?.id);

            if (isEditMode) {
                setPlayers(prev => prev.map(p => p.id === formattedPlayer.id ? formattedPlayer : p));
            } else {
                setPlayers(prev => [...prev, formattedPlayer]);
            }

            toast.success("Player saved!");
            setShowPlayerModal(false);
            refreshData(); 
        } catch (error) {
            toast.error('Connection failed');
        }
    };

    const handleReusePlayer = async () => {
        if (!duplicatePlayer || !activeTeam) return;
        try {
            await handleAssignToTeam(duplicatePlayer.id);
            setDuplicatePlayer(null);
            setShowPlayerModal(false);
            toast.success(`${duplicatePlayer.firstName} added to ${activeTeam.name}`);
        } catch (e) {
            toast.error("Failed to reuse profile");
        }
    };

    const handleCreateNewAnyway = async () => {
        setDuplicatePlayer(null);
        try {
            const formattedPlayer = await PlayerService.create(formData, activeTeam?.id);
            setPlayers(prev => [...prev, formattedPlayer]);
            toast.success("New player created!");
            setShowPlayerModal(false);
            refreshData();
        } catch (error) {
            toast.error('Connection failed');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await PlayerService.delete(id);
            setPlayers(prev => prev.filter(p => p.id !== id));
            toast.success('Player profile deleted globally');
        } catch (e) {
            toast.error("Failed to delete profile");
        }
    };

    const handleRemoveFromTeam = async (playerId: string, teamId?: string) => {
        const targetTeamId = teamId || activeTeam?.id;
        if (!targetTeamId) return;
        try {
            await PlayerService.removeFromTeam(playerId, targetTeamId);
            setPlayers(prev => prev.map(p => {
                if (p.id === playerId) {
                    return { ...p, teams: p.teams?.filter(t => t.id !== targetTeamId) || [] };
                }
                return p;
            }).filter(p => (viewMode === 'squad' && targetTeamId === activeTeam?.id) ? p.id !== playerId : true));
            toast.success('Player removed from squad');
        } catch (e) {
            toast.error("Failed to remove from squad");
            refreshData();
        }
    };

    const handleAssignToTeam = async (playerId: string, teamId?: string) => {
        const targetTeamId = teamId || activeTeam?.id;
        if (!targetTeamId) return;
        try {
            await PlayerService.assignToTeam(playerId, targetTeamId);
            const teamObj = teams.find(t => t.id === targetTeamId);
            setPlayers(prev => prev.map(p => {
                if (p.id === playerId && teamObj) {
                    const exists = p.teams?.some(t => t.id === targetTeamId);
                    if (!exists) return { ...p, teams: [...(p.teams || []), teamObj] };
                }
                return p;
            }));
            toast.success('Player added to squad');
        } catch (e) {
            toast.error("Failed to add to squad");
            refreshData();
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Show a local preview immediately while the upload runs
        const localPreview = URL.createObjectURL(file);
        setImagePreview(localPreview);
        try {
            const url = await uploadFile(file);
            setImagePreview(url);
            setFormData(prev => ({ ...prev, imageUrl: url }));
        } catch {
            toast.error('Image upload failed. Please try again.');
            setImagePreview('');
        }
    };

    const openCreate = () => {
        setEditingId(null);
        setImagePreview('');
        setFormData({ id: '', firstName: '', lastName: '', dateOfBirth: '', position: 'Forward', jerseyNumber: 0, status: 'Active', playerPhone: '', height: 0, weight: 0, motherName: '', motherPhone: '', fatherName: '', fatherPhone: '', imageUrl: '', attendance: 0, performance: 0 });
        setShowPlayerModal(true);
    };

    const openEdit = (player: Player) => {
        setEditingId(player.id);
        setFormData(player);
        setImagePreview(player.imageUrl);
        setShowPlayerModal(true);
    };

    // Save team-specific performance rating
    const savePerformance = async (player: Player, value: number, silent: boolean = false) => {
        const clamped = Math.max(0, Math.min(10, value));
        const teamId = viewMode === 'squad' ? activeTeam?.id : undefined;
        try {
            await PlayerService.updatePerformance(player.id, clamped, teamId);
            setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, performance: clamped } : p));
            if (!silent) toast.success('Performance updated');
        } catch { 
            if (!silent) toast.error('Failed to save'); 
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Active': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'Injured': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
            case 'Away': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
        }
    };

    const getPerfColor = (score: number) => {
        if (score >= 7) return { bar: 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]', text: 'text-emerald-400' };
        if (score >= 4) return { bar: 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]', text: 'text-amber-400' };
        return { bar: 'bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]', text: 'text-rose-400' };
    };

    const filteredPlayers = players.filter(p => p.firstName.toLowerCase().includes(searchQuery.toLowerCase()) || p.lastName.toLowerCase().includes(searchQuery.toLowerCase()));

    const sortedPlayers = [...filteredPlayers].sort((a, b) => {
        let av: string | number, bv: string | number;
        switch (sortKey) {
            case 'jerseyNumber': av = a.jerseyNumber; bv = b.jerseyNumber; break;
            case 'firstName': av = (a.firstName + ' ' + a.lastName).toLowerCase(); bv = (b.firstName + ' ' + b.lastName).toLowerCase(); break;
            case 'position': av = a.position; bv = b.position; break;
            case 'attendance': av = computedAttendance[a.id] ?? a.attendance; bv = computedAttendance[b.id] ?? b.attendance; break;
            case 'performance': av = a.performance; bv = b.performance; break;
            case 'status': av = a.status; bv = b.status; break;
            case 'teams': av = (a.teams || []).map(t => t.name).join(', '); bv = (b.teams || []).map(t => t.name).join(', '); break;
            default: av = 0; bv = 0;
        }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    return (
        <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-10 rounded-full bg-indigo-500 flex-shrink-0" />
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">Squad Roster</h1>
                        <p className="text-sm text-slate-400 mt-0.5">Manage player profiles and status</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={() => window.dispatchEvent(new Event('open-create-team'))} variant="secondary" icon={<TrendingUp size={18} />} className="shadow-lg hover:border-emerald-500/50">Add Team</Button>
                    <Button onClick={openCreate} icon={<Plus size={18} />} disabled={!activeTeam} className="shadow-lg shadow-blue-500/20">Add Player</Button>
                </div>
            </div>

            <div className="flex items-center p-1 bg-slate-900/60 border border-white/5 rounded-2xl w-fit">
                <button 
                    onClick={() => setViewMode('squad')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${viewMode === 'squad' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                >
                    {activeTeam?.name || 'Current Squad'}
                </button>
                <button 
                    onClick={() => setViewMode('pool')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${viewMode === 'pool' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                >
                    All Players
                </button>
            </div>

            <Input icon={<Search size={18} />} placeholder="Search by name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />

            <Card className="overflow-hidden border-white/5 bg-slate-900/40">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 backdrop-blur-sm bg-slate-950/80">
                            <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                {([
                                    { key: 'jerseyNumber', label: '#' },
                                    { key: 'firstName',    label: 'Player' },
                                    { key: 'position',     label: 'Position' },
                                    viewMode === 'squad' ? { key: 'attendance', label: 'Attendance' } : { key: 'teams', label: 'Assigned Teams' },
                                    viewMode === 'squad' ? { key: 'performance', label: 'Performance' } : { key: 'status', label: 'Status' },
                                    viewMode === 'squad' ? { key: 'status', label: 'Status' } : null,
                                ].filter(Boolean) as any[]).map(col => (
                                    <th key={col.key} className="px-6 py-4">
                                        <button
                                            onClick={() => handleSort(col.key)}
                                            className="flex items-center gap-1.5 hover:text-slate-300 transition-colors group"
                                        >
                                            {col.label}
                                            <span className="text-slate-700 group-hover:text-slate-500">
                                                {sortKey === col.key
                                                    ? sortDir === 'asc'
                                                        ? <ChevronUp size={13} className="text-blue-400" />
                                                        : <ChevronDown size={13} className="text-blue-400" />
                                                    : <ChevronsUpDown size={13} />}
                                            </span>
                                        </button>
                                    </th>
                                ))}
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading && Array.from({ length: 5 }).map((_, i) => <PlayerRowSkeleton key={i} />)}
                            {!loading && filteredPlayers.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4 text-slate-500">
                                            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                                                <Users className="w-8 h-8 text-slate-600" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-400">
                                                    {!activeTeam ? 'No active team' : searchQuery ? 'No players found' : 'No players yet'}
                                                </p>
                                                <p className="text-sm mt-1">
                                                    {!activeTeam ? 'Please add a team to start managing players.' : searchQuery ? 'Try a different search term.' : 'Add your first player to get started.'}
                                                </p>
                                            </div>
                                            {!searchQuery && (
                                                <button 
                                                    onClick={!activeTeam ? () => window.dispatchEvent(new Event('open-create-team')) : openCreate} 
                                                    className="mt-2 px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium hover:bg-indigo-500/20 transition-colors"
                                                >
                                                    {!activeTeam ? 'Create Team' : 'Add Player'}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                            <AnimatePresence>
                                {!loading && sortedPlayers.map((player, idx) => (
                                    <motion.tr initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} key={player.id} className="group hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4 font-mono text-slate-500">{player.jerseyNumber}</td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => setSelectedPlayer(player)}
                                                className="flex items-center gap-4 text-left group/name hover:opacity-80 transition-opacity"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 p-[2px] shadow-lg shadow-blue-500/20">
                                                    <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                                                        {player.imageUrl ? <img src={player.imageUrl} className="w-full h-full object-cover" /> : <span className="font-bold text-blue-500">{player.firstName[0]}</span>}
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-white group-hover/name:text-blue-400 transition-colors">{player.firstName} {player.lastName}</p>
                                                </div>
                                            </button>
                                        </td>
                                        <td className="px-6 py-4"><span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/50 text-slate-300 text-xs font-medium border border-white/5"><Shield size={12} /> {player.position}</span></td>
                                        <td className="px-6 py-4">
                                            {viewMode === 'squad' ? (
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: `${computedAttendance[player.id] ?? player.attendance}%` }}></div>
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-400">{computedAttendance[player.id] ?? player.attendance}%</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-1 items-center">
                                                    {player.teams?.length ? player.teams.map((t: Team) => (
                                                        <span key={t.id} className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[10px] font-bold border border-indigo-500/20">
                                                            {t.name}
                                                        </span>
                                                    )) : <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider italic">Unassigned</span>}
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setAssignmentPlayer(player); }}
                                                        className="ml-1 p-1 rounded-md border border-dashed border-slate-700 text-slate-500 hover:border-indigo-500/50 hover:text-indigo-400 transition-colors shadow-sm"
                                                        title="Manage Team Assignments"
                                                    >
                                                        <Plus size={12} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="h-8 flex items-center">
                                                {viewMode === 'squad' ? (
                                                    editingPerf === player.id ? (
                                                        <div className="flex items-center gap-3">
                                                            <div className="relative flex-1 w-24 flex items-center h-8">
                                                                <div className="absolute inset-x-0 h-1.5 bg-slate-800 rounded-full overflow-hidden pointer-events-none">
                                                                    <div className={`h-full rounded-full transition-all duration-100 ease-out ${getPerfColor(perfDraft).bar}`} style={{ width: `${perfDraft * 10}%` }} />
                                                                </div>
                                                                <input
                                                                    type="range"
                                                                    min={0} max={10} step={1}
                                                                    value={perfDraft}
                                                                    onChange={e => setPerfDraft(parseInt(e.target.value))}
                                                                    onPointerUp={() => { savePerformance(player, perfDraft, true); setEditingPerf(null); }}
                                                                    autoFocus
                                                                    className="perf-slider"
                                                                />
                                                            </div>
                                                            <span className={`text-xs font-bold tabular-nums ${getPerfColor(perfDraft).text}`}>{perfDraft}</span>
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className="flex items-center gap-3 group/perf cursor-pointer"
                                                            onClick={() => { setEditingPerf(player.id); setPerfDraft(player.performance); }}
                                                            title="Click to edit"
                                                        >
                                                            <div className="flex-1 w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                                <div className={`h-full rounded-full ${getPerfColor(player.performance).bar}`} style={{ width: `${player.performance * 10}%` }}></div>
                                                            </div>
                                                            <span className={`text-xs font-bold ${getPerfColor(player.performance).text}`}>{player.performance}</span>
                                                            <TrendingUp size={12} className="text-slate-700 group-hover/perf:text-blue-400 transition-colors shrink-0" />
                                                        </div>
                                                    )
                                                ) : (
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getStatusColor(player.status)}`}>{player.status}</span>
                                                )}
                                            </div>
                                        </td>
                                        {viewMode === 'squad' && (
                                            <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(player.status)}`}>{player.status}</span></td>
                                        )}
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => openEdit(player)} className="p-2 hover:bg-blue-500/10 text-slate-400 hover:text-blue-500 rounded-lg transition-colors" title="Edit Profile"><Edit2 size={16} /></button>
                                                {viewMode === 'squad' ? (
                                                    <button onClick={() => setConfirmRemoveId(player.id)} className="p-2 hover:bg-orange-500/10 text-slate-400 hover:text-orange-500 rounded-lg transition-colors" title="Remove from Squad"><Trash2 size={16} /></button>
                                                ) : (
                                                    <button onClick={() => setConfirmDeleteId(player.id)} className="p-2 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-lg transition-colors" title="Delete Profile Everywhere"><Trash2 size={16} /></button>
                                                )}
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal
                isOpen={showPlayerModal}
                onClose={() => setShowPlayerModal(false)}
                title={editingId ? 'Edit Profile' : 'New Signing'}
                icon={<User size={20} />}
                footer={
                    <div className="flex gap-3 w-full">
                        {editingId && (
                            <Button variant="danger" onClick={() => { setShowPlayerModal(false); setConfirmDeleteId(editingId); }} className="flex-1">Delete Profile</Button>
                        )}
                        <Button variant="ghost" onClick={() => setShowPlayerModal(false)} className="flex-1 text-slate-400 hover:text-white hover:bg-white/5">Cancel</Button>
                        <Button onClick={handleSave} className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-blue-500/25 hover:shadow-lg transition-all">{editingId ? 'Save Changes' : 'Create Profile'}</Button>
                    </div>
                }
            >
                <div className="space-y-8">
                    <div className="flex flex-col items-center py-4">
                        <div className="relative group cursor-pointer">
                            <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                            <div className="relative w-32 h-32 rounded-full bg-slate-900 border-4 border-slate-800 shadow-2xl flex items-center justify-center overflow-hidden group-hover:border-blue-500/50 transition-colors">
                                {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" /> : <Camera className="text-slate-600 w-12 h-12" />}
                            </div>
                            <label className="absolute bottom-1 right-1 p-2.5 bg-blue-600 rounded-full text-white hover:bg-blue-500 cursor-pointer shadow-lg shadow-blue-600/50 border-4 border-slate-950 transition-transform hover:scale-110">
                                <Camera size={16} />
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                            </label>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <h4 className="text-[11px] uppercase tracking-widest font-bold text-blue-500 mb-6 flex items-center gap-3">
                                <span className="w-6 h-[2px] bg-blue-500/50 rounded-full"></span>Identity & Position<span className="flex-1 h-[1px] bg-gradient-to-r from-blue-500/20 to-transparent"></span>
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input label="First Name" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value.replace(/[^a-zA-ZÀ-ÿ\s'\-]/g, '') })} placeholder="e.g. Marcus" />
                                <Input label="Last Name" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value.replace(/[^a-zA-ZÀ-ÿ\s'\-]/g, '') })} placeholder="e.g. Rashford" />
                                <DatePicker label="Date of Birth" value={formData.dateOfBirth} onChange={date => setFormData({ ...formData, dateOfBirth: date })} />
                                <Select label="Position" value={formData.position} onChange={(value) => setFormData({ ...formData, position: value as string })} options={[{ label: 'Forward', value: 'Forward' }, { label: 'Midfielder', value: 'Midfielder' }, { label: 'Defender', value: 'Defender' }, { label: 'Goalkeeper', value: 'Goalkeeper' }]} />
                                <Input label="Jersey Number" type="text" inputMode="numeric" icon={<Hash size={14} />} value={formData.jerseyNumber || ''} onChange={e => { const raw = e.target.value.replace(/\D/g, ''); const v = raw === '' ? 0 : Math.min(99, parseInt(raw)); setFormData({ ...formData, jerseyNumber: v }); }} className="font-mono font-bold" />
                                <Select label="Status" value={formData.status} onChange={(value) => setFormData({ ...formData, status: value as string })} options={[{ label: 'Active', value: 'Active' }, { label: 'Injured', value: 'Injured' }, { label: 'Away', value: 'Away' }]} />
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[11px] uppercase tracking-widest font-bold text-emerald-500 mb-6 flex items-center gap-3">
                                <span className="w-6 h-[2px] bg-emerald-500/50 rounded-full"></span>Physical Metrics<span className="flex-1 h-[1px] bg-gradient-to-r from-emerald-500/20 to-transparent"></span>
                            </h4>
                            <div className="grid grid-cols-2 gap-6">
                                <Input label="Height" type="text" inputMode="numeric" icon={<Ruler size={14} />} rightElement="cm" value={formData.height || ''} onChange={e => { const raw = e.target.value.replace(/\D/g, ''); const v = raw === '' ? 0 : Math.min(250, parseInt(raw)); setFormData({ ...formData, height: v }); }} />
                                <Input label="Weight" type="text" inputMode="numeric" icon={<Weight size={14} />} rightElement="kg" value={formData.weight || ''} onChange={e => { const raw = e.target.value.replace(/\D/g, ''); const v = raw === '' ? 0 : Math.min(200, parseInt(raw)); setFormData({ ...formData, weight: v }); }} />
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[11px] uppercase tracking-widest font-bold text-purple-500 mb-6 flex items-center gap-3">
                                <span className="w-6 h-[2px] bg-purple-500/50 rounded-full"></span>Contact & Family<span className="flex-1 h-[1px] bg-gradient-to-r from-purple-500/20 to-transparent"></span>
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input className="md:col-span-2" label="Player's Phone" value={formData.playerPhone} onChange={e => setFormData({ ...formData, playerPhone: e.target.value.replace(/[^0-9+\-\s()]/g, '') })} placeholder="+1 (555) 000-0000" />
                                <Input label="Mother's Name" value={formData.motherName} onChange={e => setFormData({ ...formData, motherName: e.target.value.replace(/[^a-zA-ZÀ-ÿ\s'\-]/g, '') })} />
                                <Input label="Mother's Phone" value={formData.motherPhone} onChange={e => setFormData({ ...formData, motherPhone: e.target.value.replace(/[^0-9+\-\s()]/g, '') })} />
                                <Input label="Father's Name" value={formData.fatherName} onChange={e => setFormData({ ...formData, fatherName: e.target.value.replace(/[^a-zA-ZÀ-ÿ\s'\-]/g, '') })} />
                                <Input label="Father's Phone" value={formData.fatherPhone} onChange={e => setFormData({ ...formData, fatherPhone: e.target.value.replace(/[^0-9+\-\s()]/g, '') })} />
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={!!assignmentPlayer}
                onClose={() => setAssignmentPlayer(null)}
                title={`Manage Assignments`}
                icon={<TrendingUp size={20} />}
            >
                <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 mb-4">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center">
                            {assignmentPlayer?.imageUrl ? <img src={assignmentPlayer.imageUrl} className="w-full h-full object-cover" /> : <User className="text-slate-600" size={24} />}
                        </div>
                        <div>
                            <p className="font-bold text-white text-lg">{assignmentPlayer?.firstName} {assignmentPlayer?.lastName}</p>
                            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">{assignmentPlayer?.position}</p>
                        </div>
                    </div>
                    
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Select teams for this player</p>
                    <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
                        {teams.map(team => {
                            const isAssigned = assignmentPlayer?.teams?.some(t => t.id === team.id);
                            return (
                                <button
                                    key={team.id}
                                    onClick={async () => {
                                        if (!assignmentPlayer) return;
                                        if (isAssigned) await handleRemoveFromTeam(assignmentPlayer.id, team.id);
                                        else await handleAssignToTeam(assignmentPlayer.id, team.id);
                                        
                                        // Update the local assignmentPlayer state so the modal updates immediately
                                        const updatedTeams = isAssigned 
                                            ? (assignmentPlayer.teams?.filter(t => t.id !== team.id) || [])
                                            : [...(assignmentPlayer.teams || []), team];
                                        setAssignmentPlayer({ ...assignmentPlayer, teams: updatedTeams });
                                    }}
                                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${isAssigned ? 'bg-indigo-500/10 border-indigo-500/30 text-white shadow-lg shadow-indigo-500/5' : 'bg-slate-900/40 border-white/5 text-slate-400 hover:border-white/10 hover:text-white'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isAssigned ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-600'}`}>
                                            <Shield size={16} />
                                        </div>
                                        <span className="font-bold">{team.name}</span>
                                    </div>
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isAssigned ? 'bg-indigo-500 border-indigo-500' : 'border-slate-800'}`}>
                                        {isAssigned && <Check size={14} className="text-white" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    <div className="pt-4 border-t border-white/5">
                        <Button onClick={() => setAssignmentPlayer(null)} className="w-full">Done</Button>
                    </div>
                </div>
            </Modal>

            <ConfirmDialog
                isOpen={confirmRemoveId !== null}
                title="Remove from squad?"
                message="The player will still exist in your global library but will be removed from this team's roster."
                confirmLabel="Remove Player"
                onConfirm={() => { if (confirmRemoveId) handleRemoveFromTeam(confirmRemoveId); setConfirmRemoveId(null); }}
                onCancel={() => setConfirmRemoveId(null)}
            />

            <ConfirmDialog
                isOpen={confirmDeleteId !== null}
                title="PERMANENTLY delete player?"
                message="This will completely erase the player profile from all teams and your global library. This cannot be undone."
                confirmLabel="Delete Everywhere"
                onConfirm={() => { if (confirmDeleteId) handleDelete(confirmDeleteId); setConfirmDeleteId(null); }}
                onCancel={() => setConfirmDeleteId(null)}
            />

            <PlayerSlideOver
                player={selectedPlayer}
                computedAttendance={computedAttendance}
                onClose={() => setSelectedPlayer(null)}
                onEdit={(p) => { setSelectedPlayer(null); openEdit(p); }}
                onDelete={(id) => { setSelectedPlayer(null); setConfirmRemoveId(id); }}
            />

            <Modal
                isOpen={!!duplicatePlayer}
                onClose={() => setDuplicatePlayer(null)}
                title="Duplicate Profile Detected"
                icon={<Users size={20} />}
                footer={
                    <div className="flex gap-3 w-full">
                        <Button variant="ghost" onClick={handleCreateNewAnyway} className="flex-1 text-slate-400 hover:text-white">Create New anyway</Button>
                        <Button onClick={handleReusePlayer} className="flex-1 bg-indigo-500 shadow-lg shadow-indigo-500/20">Reuse Existing Profile</Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-400">A player named <span className="text-white font-bold">{duplicatePlayer?.firstName} {duplicatePlayer?.lastName}</span> already exists in your database. Do you want to use the existing profile for this team or create a completely new one?</p>
                    
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-indigo-500/30 flex items-center justify-center overflow-hidden">
                            {duplicatePlayer?.imageUrl ? <img src={duplicatePlayer.imageUrl} className="w-full h-full object-cover" /> : <User className="text-slate-600" size={28} />}
                        </div>
                        <div>
                            <p className="font-bold text-white">{duplicatePlayer?.firstName} {duplicatePlayer?.lastName}</p>
                            <p className="text-xs text-slate-500">{duplicatePlayer?.position} • Joined {(duplicatePlayer?.teams || []).length} teams</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {(duplicatePlayer?.teams || []).map(t => (
                                    <span key={t.id} className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{t.name}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3 items-start">
                        <TrendingUp size={16} className="text-amber-500 mt-1 flex-shrink-0" />
                        <p className="text-xs text-amber-500/80 leading-relaxed">Selecting <span className="font-bold text-amber-500">Reuse</span> will keep all performance and attendance data synchronized across all teams this player belongs to.</p>
                    </div>
                </div>
            </Modal>
        </div>
    );
}