import { useState, useEffect } from 'react';
import { Plus, X, Calendar, Clock, Trash2, Edit2, User, Activity, Download, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence } from 'framer-motion';
import { formatDate } from '../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Player, TrainingSession, Exercise } from '../types/models';
import { TrainingService, PlayerService, ExerciseService } from '../services';
import { useTeam } from '../contexts/TeamContext';
import { useSeason } from '../contexts/SeasonContext';

// UI Components
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Modal } from "./ui/Modal";
import { DatePicker } from "./ui/DatePicker";
import { TimePicker } from "./ui/TimePicker";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import SessionSlideOver from "./ui/SessionSlideOver";

export default function TrainingManager() {
    const { activeTeam } = useTeam();
    const { activeSeason } = useSeason();
    const [sessions, setSessions] = useState<TrainingSession[]>([]);
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const [allExercises, setAllExercises] = useState<Exercise[]>([]);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        date: new Date().toLocaleDateString('en-CA'),
        startTime: '09:00',
        endTime: '11:00',
        focus: '',
        intensity: 'Medium',
        selectedPlayerIds: [] as string[],
        selectedExerciseIds: [] as string[],
        // Recurring series fields. Only used when creating (never when
        // editing an existing occurrence) — once a series exists, edits go
        // through the per-occurrence flow with a scope dialog.
        isRecurring: false,
        recurrenceEndDate: '',
    });

    const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
    const [activeIntensity, setActiveIntensity] = useState<string>('All');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
    // When editing a session that belongs to a recurring series, the user
    // picks whether their changes apply only to this occurrence or to this
    // and every future unmodified occurrence. Defaults to "this" so the
    // safe behaviour is to scope changes narrowly.
    const [editScope, setEditScope] = useState<'this' | 'future'>('this');
    // Holds the session targeted for deletion when we need a scope picker
    // (i.e. the session belongs to a series).
    const [scopeDeleteSession, setScopeDeleteSession] = useState<TrainingSession | null>(null);

    // --- 1. LOAD DATA ---
    useEffect(() => {
        if (!activeTeam || !activeSeason) {
             setSessions([]);
             setAllPlayers([]);
             ExerciseService.getAll().then(setAllExercises).catch();
             return;
        }
        const fetchData = async () => {
            try {
                const [sessionsData, playersData, exercisesData] = await Promise.all([
                    TrainingService.getAll(activeTeam.id, activeSeason.id),
                    PlayerService.getAll(activeTeam.id, activeSeason.id),
                    ExerciseService.getAll()
                ]);
                setSessions(sessionsData);
                setAllPlayers(playersData);
                setAllExercises(exercisesData);
            } catch (e) { toast.error("Failed to connect to server"); }
        };
        fetchData();
    }, [activeTeam, activeSeason]);

    // --- 2. HELPERS & ACTIONS ---
    useEffect(() => {
        if (showCreateModal && !isEditing) {
            setFormData(prev => ({ ...prev, selectedPlayerIds: allPlayers.map(p => p.id) }));
        }
    }, [showCreateModal, isEditing, allPlayers]);

    const handleSave = async () => {
        if (!formData.focus) return toast.error("Focus is required");

        // Recurring branch: create a series, then reload sessions so the
        // newly materialised occurrences show up in the list.
        if (!isEditing && formData.isRecurring) {
            if (!formData.recurrenceEndDate) {
                return toast.error('Pick a "Repeat until" date');
            }
            if (formData.recurrenceEndDate < formData.date) {
                return toast.error('"Repeat until" must be on or after the start date');
            }
            // Day-of-week from the first occurrence. JS Sunday=0 → convert
            // to Python convention (Monday=0).
            const startDate = new Date(formData.date + 'T12:00:00');
            const jsDay = startDate.getDay();              // 0..6, Sun..Sat
            const pyDay = (jsDay + 6) % 7;                 // 0..6, Mon..Sun
            try {
                await TrainingService.createSeries({
                    teamId: activeTeam?.id,
                    seasonId: activeSeason?.id,
                    dayOfWeek: pyDay,
                    seriesStartDate: formData.date,
                    seriesEndDate: formData.recurrenceEndDate,
                    startTime: formData.startTime,
                    endTime: formData.endTime,
                    focus: formData.focus,
                    intensity: formData.intensity,
                    selectedPlayers: formData.selectedPlayerIds.join(','),
                    selectedExercises: formData.selectedExerciseIds.join(','),
                });
                // Refetch the session list so every materialised occurrence
                // shows up. (We don't have the inserted rows in the response.)
                if (activeTeam && activeSeason) {
                    const fresh = await TrainingService.getAll(activeTeam.id, activeSeason.id);
                    setSessions(fresh);
                }
                toast.success("Recurring series created");
                closeModal();
            } catch {
                toast.error("Failed to create series");
            }
            return;
        }

        const sessionToSave: TrainingSession = {
            id: editingId || '',
            date: formData.date,
            startTime: formData.startTime,
            endTime: formData.endTime,
            focus: formData.focus,
            intensity: formData.intensity,
            selectedPlayers: formData.selectedPlayerIds.join(','),
            selectedExercises: formData.selectedExerciseIds.join(','),
        };

        try {
            let saved: TrainingSession;
            if (isEditing && editingId) {
                saved = await TrainingService.update(editingId, sessionToSave, editScope);
                if (editScope === 'future' && saved.seriesId) {
                    // Refetch so every updated future occurrence shows the new values.
                    if (activeTeam && activeSeason) {
                        const fresh = await TrainingService.getAll(activeTeam.id, activeSeason.id);
                        setSessions(fresh);
                    }
                } else {
                    setSessions(prev => prev.map(s => s.id === saved.id ? saved : s));
                }
                toast.success(editScope === 'future' ? 'Series updated' : 'Session Updated');
            } else {
                saved = await TrainingService.create(sessionToSave, activeTeam?.id, activeSeason?.id);
                setSessions(prev => [...prev, saved]);
                toast.success("Session Created");
            }
            closeModal();
        } catch { toast.error("Connection failed"); }
    };

    const handleDelete = async (id: string, scope: 'this' | 'future' = 'this') => {
        const sessionsBefore = sessions;
        const target = sessions.find(s => s.id === id);
        // Optimistic delete. For "future" scope on a series, also prune every
        // future occurrence of the same series client-side so the list
        // updates instantly.
        if (scope === 'future' && target?.seriesId) {
            setSessions(prev => prev.filter(s =>
                !(s.seriesId === target.seriesId && s.date >= target.date)
            ));
        } else {
            setSessions(prev => prev.filter(s => s.id !== id));
        }
        toast.success(scope === 'future' ? 'Future occurrences deleted' : 'Deleted');
        try {
            await TrainingService.delete(id, scope);
        } catch (e) {
            setSessions(sessionsBefore);
            toast.error("Failed to delete");
        }
    };

    // --- 3. PDF EXPORT ---
    const generatePDF = (session: TrainingSession) => {
        const doc = new jsPDF({ orientation: "landscape" });

        // Header
        doc.setFillColor(15, 23, 42); // Dark Slate 900
        doc.rect(0, 0, 297, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.text("TRAINING SESSION PLAN", 148, 12, { align: "center" });
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184); // Slate 400
        doc.text(`${session.date}  |  ${session.startTime} - ${session.endTime}  |  Focus: ${session.focus}  |  Intensity: ${session.intensity}`, 148, 22, { align: "center" });

        let finalY = 40;

        // Get Ordered Exercises
        const exerciseIds = session.selectedExercises ? session.selectedExercises.split(',').filter(id => id.trim() !== '') : [];
        const sessionExercises = exerciseIds
            .map(id => allExercises.find(ex => ex.id === id))
            .filter((ex): ex is Exercise => ex !== undefined);

        if (sessionExercises.length > 0) {
            doc.setFontSize(12);
            doc.setTextColor(15, 23, 42);
            doc.text("Session Exercises", 14, finalY);

            autoTable(doc, {
                startY: finalY + 5,
                head: [['Exercise', 'Diagram', 'Setup', 'Description', 'Coaching Points', 'Equipment', 'Related Items']],
                body: sessionExercises.map(ex => {
                    const related = [
                        ex.linkedBasics?.length ? `Basics: ${ex.linkedBasics.join(', ')}` : '',
                        ex.linkedPrinciples?.length ? `Principles: ${ex.linkedPrinciples.join(', ')}` : '',
                        ex.linkedTactics?.length ? `Tactics: ${ex.linkedTactics.join(', ')}` : ''
                    ].filter(s => s).join('\n');

                    return [
                        ex.name,
                        '',
                        ex.setup || '-',
                        ex.description || '-',
                        ex.coachingPoints || '-',
                        ex.equipment?.join(', ') || '-',
                        related || '-'
                    ];
                }),
                headStyles: { fillColor: [37, 99, 235], textColor: 255 },
                styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', minCellHeight: 25 },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 25 },
                    1: { cellWidth: 40 },
                    2: { cellWidth: 35 },
                    3: { cellWidth: 50 },
                    4: { cellWidth: 35 },
                    5: { cellWidth: 25 },
                    6: { cellWidth: 'auto' }
                },
                didDrawCell: (data) => {
                    if (data.column.index === 1 && data.row.section === 'body') {
                        const ex = sessionExercises[data.row.index];
                        if (ex.mediaUrl && ex.mediaUrl.startsWith('data:image')) {
                            try {
                                const imgProps = doc.getImageProperties(ex.mediaUrl);
                                const ratio = imgProps.width / imgProps.height;
                                const cellWidth = data.cell.width - 4;
                                const cellHeight = data.cell.height - 4;
                                let w = cellWidth;
                                let h = w / ratio;
                                if (h > cellHeight) { h = cellHeight; w = h * ratio; }
                                doc.addImage(ex.mediaUrl, 'JPEG', data.cell.x + 2, data.cell.y + 2, w, h);
                            } catch (e) { } 
                        }
                    }
                }
            });
            finalY = (doc as any).lastAutoTable.finalY + 15;
        }

        const playerIds = session.selectedPlayers ? session.selectedPlayers.split(',').filter(id => id.trim() !== '') : [];
        const sessionPlayers = allPlayers.filter(p => playerIds.includes(p.id));
        if (sessionPlayers.length > 0) {
            if (finalY > 150) { doc.addPage(); finalY = 20; }
            doc.setFontSize(12); doc.setTextColor(15, 23, 42);
            doc.text(`Attending Players (${sessionPlayers.length})`, 14, finalY);
            doc.setFontSize(9); doc.setTextColor(0, 0, 0);
            let x = 14; let y = finalY + 8;
            sessionPlayers.forEach((p, index) => {
                doc.text(`• ${p.firstName} ${p.lastName}`, x, y);
                y += 5;
                if (y > 190) { y = finalY + 8; x += 50; if (x > 250) { doc.addPage(); x = 14; y = 20; } } 
                if ((index + 1) % 15 === 0 && index !== 0) { x += 50; y = finalY + 8; } 
            });
        }

        doc.save(`Training_Session_${session.date}.pdf`);
        toast.success("PDF Downloaded");
    };

    // --- 4. UI HELPERS ---
    const openCreate = () => { setIsEditing(false); setEditingId(null); setEditScope('this'); setFormData({ date: new Date().toLocaleDateString('en-CA'), startTime: '09:00', endTime: '11:00', focus: '', intensity: 'Medium', selectedPlayerIds: allPlayers.map(p => p.id), selectedExerciseIds: [], isRecurring: false, recurrenceEndDate: '' }); setShowCreateModal(true); };
    const openEdit = (s: TrainingSession) => {
        setSelectedSession(null);
        setIsEditing(true);
        setEditingId(s.id);
        setEditScope('this');
        setFormData({
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            focus: s.focus,
            intensity: s.intensity,
            selectedPlayerIds: s.selectedPlayers ? s.selectedPlayers.split(',').filter(id => id.trim() !== '') : [],
            selectedExerciseIds: s.selectedExercises ? s.selectedExercises.split(',').filter(id => id.trim() !== '') : [],
            isRecurring: false,
            recurrenceEndDate: '',
        });
        setShowCreateModal(true);
    };
    const closeModal = () => { setShowCreateModal(false); setEditScope('this'); };
    const togglePlayer = (id: string) => { setFormData(prev => { const exists = prev.selectedPlayerIds.includes(id); return { ...prev, selectedPlayerIds: exists ? prev.selectedPlayerIds.filter(pid => pid !== id) : [...prev.selectedPlayerIds, id] }; }); };
    const toggleExercise = (id: string) => { setFormData(prev => { const exists = prev.selectedExerciseIds.includes(id); return { ...prev, selectedExerciseIds: exists ? prev.selectedExerciseIds.filter(eid => eid !== id) : [...prev.selectedExerciseIds, id] }; }); };

    const today = new Date().toLocaleDateString('en-CA');
    const upcomingSessions = sessions
        .filter(s => s.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date));
    const pastSessions = sessions
        .filter(s => s.date < today)
        .sort((a, b) => b.date.localeCompare(a.date));
    const displaySessions = (activeTab === 'upcoming' ? upcomingSessions : pastSessions)
        .filter(s => activeIntensity === 'All' || s.intensity === activeIntensity);

    const INTENSITY_STYLES: Record<string, string> = {
        Low:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        High:   'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };

    const todayDate = new Date(today + 'T12:00:00');
    const weekLater = new Date(todayDate); weekLater.setDate(todayDate.getDate() + 7);
    const twoWeeksLater = new Date(todayDate); twoWeeksLater.setDate(todayDate.getDate() + 14);
    const weekStr = weekLater.toLocaleDateString('en-CA');
    const twoWeeksStr = twoWeeksLater.toLocaleDateString('en-CA');
    const groupedUpcoming = [
        { label: 'This Week', items: displaySessions.filter(s => s.date <= weekStr) },
        { label: 'Next Week', items: displaySessions.filter(s => s.date > weekStr && s.date <= twoWeeksStr) },
        { label: 'Later',     items: displaySessions.filter(s => s.date > twoWeeksStr) },
    ];
    const nextSessionId = upcomingSessions[0]?.id;

    return (
        <div className="h-full w-full flex flex-col p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto gap-6 overflow-y-auto custom-scrollbar">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-10 rounded-full bg-cyan-500 flex-shrink-0" />
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Training Sessions</h1>
                        <p className="text-sm text-muted mt-0.5">{upcomingSessions.length} upcoming · {pastSessions.length} past</p>
                    </div>
                </div>
                <Button onClick={openCreate} icon={<Plus size={18} />} className="shadow-lg shadow-primary/20">
                    New Session
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-surface-hover/50 border border-border rounded-xl w-fit">
                {([
                    { key: 'upcoming', label: 'Upcoming', count: upcomingSessions.length },
                    { key: 'past',     label: 'Past',     count: pastSessions.length },
                ] as const).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === tab.key
                                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                : 'text-muted hover:text-foreground hover:bg-surface-hover'
                            }`}
                    >
                        {tab.label}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-surface text-muted'}`}>{tab.count}</span>
                    </button>
                ))}
            </div>

            {/* Intensity Filter Tabs */}
            <div className="flex flex-wrap gap-2">
                {(['All', 'Low', 'Medium', 'High'] as const).map(level => {
                    const base = activeTab === 'upcoming' ? upcomingSessions : pastSessions;
                    const count = level === 'All' ? base.length : base.filter(s => s.intensity === level).length;
                    const dotColor = level === 'Low' ? 'bg-emerald-500' : level === 'Medium' ? 'bg-amber-500' : level === 'High' ? 'bg-rose-500' : '';
                    return (
                        <button
                            key={level}
                            onClick={() => setActiveIntensity(level)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${activeIntensity === level
                                    ? 'bg-surface-hover border-border text-foreground shadow-sm'
                                    : 'text-muted border-border hover:text-foreground hover:bg-surface-hover'
                                }`}
                        >
                            {level !== 'All' && <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
                            {level}
                            <span className="text-[10px] px-1 bg-surface text-muted rounded border border-border">{count}</span>
                        </button>
                    );
                })}
            </div>

            <div className="space-y-8">
                {activeTab === 'upcoming' ? (
                    <>
                        {displaySessions.length === 0 ? (
                            <div className="p-12 text-center text-muted border-2 border-dashed border-border rounded-xl bg-surface-hover/30">
                                No upcoming sessions scheduled.
                            </div>
                        ) : groupedUpcoming.filter(g => g.items.length > 0).map(group => (
                            <div key={group.label}>
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted/60 px-1 mb-3 flex items-center gap-2">
                                    <span className="w-4 h-[1px] bg-border inline-block" />
                                    {group.label}
                                </h3>
                                <div className="grid grid-cols-1 gap-4">
                                    <AnimatePresence>
                                        {group.items.map((s, idx) => {
                                            const exerciseCount = s.selectedExercises ? s.selectedExercises.split(',').filter(id => id.trim() !== '').length : 0;
                                            const playerCount = s.selectedPlayers ? s.selectedPlayers.split(',').filter(id => id.trim() !== '').length : 0;
                                            return (
                                                <Card
                                                    key={s.id}
                                                    animate
                                                    delay={idx * 0.05}
                                                    onClick={() => setSelectedSession(s)}
                                                    className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center shadow-sm dark:shadow-lg group relative overflow-y-auto lg:overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
                                                >
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-indigo-600" />
                                                    <div className="flex-1 pl-2">
                                                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                                                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border ${INTENSITY_STYLES[s.intensity] ?? 'bg-surface text-muted border-border'}`}>
                                                                {s.intensity}
                                                            </span>
                                                            {s.id === nextSessionId && (
                                                                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                                                                    Next
                                                                </span>
                                                            )}
                                                            <h3 className="text-lg font-bold text-foreground">{s.focus}</h3>
                                                        </div>
                                                        <div className="flex flex-wrap gap-4 text-sm text-muted mt-2">
                                                            <span className="flex items-center gap-1.5"><Calendar size={14} className="text-primary" /> {formatDate(s.date)}</span>
                                                            <span className="flex items-center gap-1.5"><Clock size={14} className="text-primary" /> {s.startTime} - {s.endTime}</span>
                                                            <span className="flex items-center gap-1.5"><Activity size={14} className="text-emerald-500" /> {exerciseCount} Drills</span>
                                                            <span className="flex items-center gap-1.5"><User size={14} className="text-purple-500" /> {playerCount} Players</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 mt-4 md:mt-0 flex-shrink-0">
                                                        <Button variant="secondary" onClick={(e) => { e.stopPropagation(); generatePDF(s); }} className="p-2.5" title="Export PDF">
                                                            <Download size={18} />
                                                        </Button>
                                                        <Button variant="secondary" onClick={(e) => { e.stopPropagation(); openEdit(s); }} className="p-2.5" title="Edit">
                                                            <Edit2 size={18} />
                                                        </Button>
                                                        <Button variant="danger" onClick={(e) => { e.stopPropagation(); if (s.seriesId) setScopeDeleteSession(s); else setConfirmDeleteId(s.id); }} className="p-2.5" title="Delete">
                                                            <Trash2 size={18} />
                                                        </Button>
                                                    </div>
                                                </Card>
                                            )
                                        })}
                                    </AnimatePresence>
                                </div>
                            </div>
                        ))}
                    </>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-4">
                            <AnimatePresence>
                                {displaySessions.map((s, idx) => {
                                    const exerciseCount = s.selectedExercises ? s.selectedExercises.split(',').filter(id => id.trim() !== '').length : 0;
                                    const playerCount = s.selectedPlayers ? s.selectedPlayers.split(',').filter(id => id.trim() !== '').length : 0;
                                    return (
                                        <Card
                                            key={s.id}
                                            animate
                                            delay={idx * 0.05}
                                            onClick={() => setSelectedSession(s)}
                                            className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center shadow-sm dark:shadow-lg group relative overflow-hidden cursor-pointer hover:border-border transition-colors"
                                        >
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-muted to-muted/40" />
                                            <div className="flex-1 pl-2">
                                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border ${INTENSITY_STYLES[s.intensity] ?? 'bg-surface text-muted border-border'}`}>
                                                        {s.intensity}
                                                    </span>
                                                    <h3 className="text-lg font-bold text-foreground">{s.focus}</h3>
                                                </div>
                                                <div className="flex flex-wrap gap-4 text-sm text-muted mt-2">
                                                    <span className="flex items-center gap-1.5"><Calendar size={14} className="text-primary" /> {formatDate(s.date)}</span>
                                                    <span className="flex items-center gap-1.5"><Clock size={14} className="text-primary" /> {s.startTime} - {s.endTime}</span>
                                                    <span className="flex items-center gap-1.5"><Activity size={14} className="text-emerald-500" /> {exerciseCount} Drills</span>
                                                    <span className="flex items-center gap-1.5"><User size={14} className="text-purple-500" /> {playerCount} Players</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 mt-4 md:mt-0 flex-shrink-0">
                                                <Button variant="secondary" onClick={(e) => { e.stopPropagation(); generatePDF(s); }} className="p-2.5" title="Export PDF">
                                                    <Download size={18} />
                                                </Button>
                                                <Button variant="secondary" onClick={(e) => { e.stopPropagation(); openEdit(s); }} className="p-2.5" title="Edit">
                                                    <Edit2 size={18} />
                                                </Button>
                                                <Button variant="danger" onClick={(e) => { e.stopPropagation(); if (s.seriesId) setScopeDeleteSession(s); else setConfirmDeleteId(s.id); }} className="p-2.5" title="Delete">
                                                    <Trash2 size={18} />
                                                </Button>
                                            </div>
                                        </Card>
                                    )
                                })}
                            </AnimatePresence>
                        </div>
                        {displaySessions.length === 0 && (
                            <div className="p-12 text-center text-muted border-2 border-dashed border-border rounded-xl bg-surface-hover/30">
                                No past sessions recorded.
                            </div>
                        )}
                    </>
                )}
            </div>

            <Modal
                isOpen={showCreateModal}
                onClose={closeModal}
                title={isEditing ? 'Edit Session' : 'Plan Session'}
                icon={<Activity size={20} />}
                maxWidth="max-w-5xl"
                footer={
                    <div className="flex gap-3">
                        <Button variant="ghost" onClick={closeModal} className="flex-1">Discard</Button>
                        <Button onClick={handleSave} className="flex-1 bg-primary">
                            {isEditing ? 'Save Changes' : 'Schedule Session'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-8">
                    {/* Edit scope picker — only shown for series occurrences. */}
                    {isEditing && (() => {
                        const target = sessions.find(s => s.id === editingId);
                        if (!target || !target.seriesId) return null;
                        return (
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3">
                                <div className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                                    Apply changes to
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditScope('this')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${editScope === 'this' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-surface-raised border-border text-muted hover:text-foreground'}`}
                                    >
                                        Only this event
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditScope('future')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${editScope === 'future' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-surface-raised border-border text-muted hover:text-foreground'}`}
                                    >
                                        This and all future
                                    </button>
                                </div>
                                {editScope === 'future' && (
                                    <p className="text-[11px] text-muted md:ml-2">
                                        Date can't change with this scope.
                                    </p>
                                )}
                            </div>
                        );
                    })()}

                    {/* 1. Details */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                        <div className="md:col-span-2">
                            <Input
                                label="Primary Focus"
                                placeholder="e.g. High Press & Transition"
                                value={formData.focus}
                                onChange={e => setFormData({ ...formData, focus: e.target.value })}
                            />
                        </div>
                        <DatePicker
                            label="Date"
                            value={formData.date}
                            onChange={date => setFormData({ ...formData, date })}
                        />
                        <Select
                            label="Intensity"
                            value={formData.intensity}
                            onChange={(val) => setFormData({ ...formData, intensity: val as string })}
                            options={[
                                { label: 'Low', value: 'Low' },
                                { label: 'Medium', value: 'Medium' },
                                { label: 'High', value: 'High' }
                            ]}
                        />
                        <TimePicker
                            label="Start Time"
                            value={formData.startTime}
                            onChange={time => setFormData({ ...formData, startTime: time })}
                        />
                        <TimePicker
                            label="End Time"
                            value={formData.endTime}
                            onChange={time => setFormData({ ...formData, endTime: time })}
                        />
                    </div>

                    {/* Recurring series — only on create. Editing an
                        existing series occurrence goes through the scope
                        dialog instead. */}
                    {!isEditing && (
                        <div className="bg-surface-hover/40 border border-border rounded-xl p-4 space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={formData.isRecurring}
                                    onChange={e => setFormData({ ...formData, isRecurring: e.target.checked })}
                                    className="w-4 h-4 accent-blue-500"
                                />
                                <span className="text-sm font-semibold text-foreground">
                                    Repeat weekly
                                </span>
                                <span className="text-xs text-muted">
                                    Creates a session every {(() => {
                                        try {
                                            const d = new Date(formData.date + 'T12:00:00');
                                            return d.toLocaleDateString('en-US', { weekday: 'long' });
                                        } catch { return 'week'; }
                                    })()} until the end date.
                                </span>
                            </label>
                            {formData.isRecurring && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                                    <DatePicker
                                        label="Repeat until"
                                        value={formData.recurrenceEndDate}
                                        onChange={date => setFormData({ ...formData, recurrenceEndDate: date })}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <div className="w-full h-[1px] bg-border/50"></div>

                    {/* 2. Player Selection */}
                    <div>
                        <h3 className="text-[11px] uppercase tracking-widest font-bold text-muted mb-4">Player Availability</h3>
                        <div className="flex flex-wrap gap-2">
                            {allPlayers.map(p => {
                                const isSelected = formData.selectedPlayerIds.includes(p.id);
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => togglePlayer(p.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${isSelected
                                            ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                                            : 'bg-surface-hover text-muted border-border hover:border-border'
                                            }`}
                                    >
                                        {p.firstName} {p.lastName}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="w-full h-[1px] bg-border/50"></div>

                    {/* 3. Exercise Selection - Two Column Design */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Available Column */}
                        <div>
                            <h3 className="text-[11px] uppercase tracking-widest font-bold text-muted mb-3 flex justify-between">
                                Available Drills
                                <span className="bg-surface-hover px-2 rounded text-[10px] py-0.5 text-muted border border-border">{allExercises.length - formData.selectedExerciseIds.length}</span>
                            </h3>
                            <div className="bg-surface-hover/30 border border-border rounded-xl p-2 h-80 overflow-y-auto space-y-2 custom-scrollbar">
                                {allExercises.filter(ex => !formData.selectedExerciseIds.includes(ex.id)).map(ex => (
                                    <div key={ex.id} onClick={() => toggleExercise(ex.id)} className="p-3 bg-surface rounded-lg shadow-sm border border-border hover:border-primary/50 cursor-pointer group transition-all">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-foreground">{ex.name}</span>
                                            <Plus size={16} className="text-muted group-hover:text-primary" />
                                        </div>
                                        <div className="mt-1 flex gap-2">
                                            <span className="text-[10px] text-muted/80 px-1.5 bg-surface-hover rounded border border-border">{ex.intensity || 'Med'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Selected Column */}
                        <div>
                            <h3 className="text-[11px] uppercase tracking-widest font-bold text-primary mb-3 flex justify-between">
                                Selected Sequence
                                <span className="bg-primary/10 text-primary px-2 rounded text-[10px] py-0.5 border border-primary/20">{formData.selectedExerciseIds.length}</span>
                            </h3>
                            <div className="bg-primary/5 border border-primary/10 rounded-xl p-2 h-80 overflow-y-auto space-y-2 custom-scrollbar">
                                {formData.selectedExerciseIds.map((id, index) => {
                                    const ex = allExercises.find(e => e.id === id);
                                    if (!ex) return null;
                                    return (
                                        <div key={id} onClick={() => toggleExercise(id)} className="p-3 bg-surface rounded-lg shadow-sm border-l-4 border-l-primary cursor-pointer group border-y border-r border-border">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold">{index + 1}</span>
                                                    <span className="text-sm font-medium text-foreground">{ex.name}</span>
                                                </div>
                                                <X size={16} className="text-muted group-hover:text-red-500 transition-colors" />
                                            </div>
                                        </div>
                                    );
                                })}
                                {formData.selectedExerciseIds.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-muted text-xs italic">
                                        <ArrowRight className="mb-2 opacity-50" />
                                        Select drills from the left
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>

            <ConfirmDialog
                isOpen={confirmDeleteId !== null}
                title="Delete session?"
                message="This will permanently remove the training session."
                confirmLabel="Delete Session"
                onConfirm={() => { if (confirmDeleteId) handleDelete(confirmDeleteId); setConfirmDeleteId(null); }}
                onCancel={() => setConfirmDeleteId(null)}
            />

            {/* Scope picker for deleting a session that belongs to a series. */}
            <Modal
                isOpen={scopeDeleteSession !== null}
                onClose={() => setScopeDeleteSession(null)}
                title="Delete recurring session"
            >
                <div className="space-y-4">
                    <p className="text-sm text-muted">
                        This session is part of a recurring series. What do you want to delete?
                    </p>
                    <div className="flex flex-col gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => {
                                if (scopeDeleteSession) handleDelete(scopeDeleteSession.id, 'this');
                                setScopeDeleteSession(null);
                            }}
                            className="w-full justify-start"
                        >
                            Only this event
                        </Button>
                        <Button
                            variant="danger"
                            onClick={() => {
                                if (scopeDeleteSession) handleDelete(scopeDeleteSession.id, 'future');
                                setScopeDeleteSession(null);
                            }}
                            className="w-full justify-start"
                        >
                            This and all future events
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setScopeDeleteSession(null)}
                            className="w-full justify-center"
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </Modal>

            <SessionSlideOver
                session={!showCreateModal ? selectedSession : null}
                allPlayers={allPlayers}
                allExercises={allExercises}
                isPast={selectedSession ? selectedSession.date < today : false}
                onClose={() => setSelectedSession(null)}
                onEdit={openEdit}
                onDelete={(id) => {
                    setSelectedSession(null);
                    const target = sessions.find(s => s.id === id);
                    if (target?.seriesId) setScopeDeleteSession(target);
                    else setConfirmDeleteId(id);
                }}
                onExportPDF={generatePDF}
            />
        </div>
    );
}
