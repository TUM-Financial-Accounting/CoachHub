import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, CalendarDays, Dumbbell, BookOpen, Target, ChevronRight, Command, Layers } from 'lucide-react';

import {Result, Page, Category} from "../types/ui"
import { PlayerService, TrainingService, ExerciseService, LibraryService } from '../services';


const CATEGORY_META: Record<Category, { icon: React.ReactNode; color: string; page: Page }> = {
    Players:    { icon: <Users size={14} />,        color: 'text-indigo-400',  page: 'team' },
    Sessions:   { icon: <CalendarDays size={14} />, color: 'text-cyan-400',    page: 'session-planner' },
    Exercises:  { icon: <Dumbbell size={14} />,     color: 'text-amber-400',   page: 'training' },
    Basics:     { icon: <BookOpen size={14} />,     color: 'text-sky-400',     page: 'basics' },
    Principles: { icon: <Layers size={14} />,       color: 'text-violet-400',  page: 'principles' },
    Tactics:    { icon: <Target size={14} />,       color: 'text-emerald-400', page: 'tactics' },
};

const QUICK_LINKS: { label: string; page: Page; category: Category }[] = [
    { label: 'Squad Roster',       page: 'team',           category: 'Players' },
    { label: 'Session Planner',    page: 'session-planner', category: 'Sessions' },
    { label: 'Training Manager',   page: 'training',        category: 'Exercises' },
    { label: 'Basics Library',     page: 'basics',          category: 'Basics' },
    { label: 'Principles Library', page: 'principles',      category: 'Principles' },
    { label: 'Tactics Library',    page: 'tactics',         category: 'Tactics' },
];

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (page: Page) => void;
}

export default function CommandPalette({ isOpen, onClose, onNavigate }: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Result[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const allDataRef = useRef<Result[]>([]);

    // Fetch all data once when opened
    useEffect(() => {
        if (!isOpen) return;
        setQuery('');
        setSelectedIdx(0);
        setTimeout(() => inputRef.current?.focus(), 50);

        if (allDataRef.current.length > 0) return; // already loaded

        setLoading(true);
        Promise.allSettled([
            PlayerService.getAll(),
            TrainingService.getAll(),
            ExerciseService.getAll(),
            LibraryService.getBasics(),
            LibraryService.getPrinciples(),
            LibraryService.getTactics(),
        ]).then(([players, sessions, exercises, basics, principles, tactics]) => {
            const all: Result[] = [];

            if (players.status === 'fulfilled') {
                players.value.forEach(p =>
                    all.push({ id: `player-${p.id}`, label: `${p.firstName} ${p.lastName}`, sub: `${p.position} · #${p.jerseyNumber}`, page: 'team', category: 'Players' })
                );
            }
            if (sessions.status === 'fulfilled') {
                sessions.value.forEach(s =>
                    all.push({ id: `session-${s.id}`, label: s.focus || 'Training Session', sub: s.date, page: 'session-planner', category: 'Sessions' })
                );
            }
            if (exercises.status === 'fulfilled') {
                exercises.value.forEach(e =>
                    all.push({ id: `ex-${e.id}`, label: e.name, sub: 'Exercise', page: 'training', category: 'Exercises' })
                );
            }
            if (basics.status === 'fulfilled') {
                basics.value.forEach(b =>
                    all.push({ id: `basic-${b.id}`, label: b.name, sub: 'Basics', page: 'basics', category: 'Basics' })
                );
            }
            if (principles.status === 'fulfilled') {
                principles.value.forEach(p =>
                    all.push({ id: `prin-${p.id}`, label: p.name, sub: 'Principles', page: 'principles', category: 'Principles' })
                );
            }
            if (tactics.status === 'fulfilled') {
                tactics.value.forEach(t =>
                    all.push({ id: `tact-${t.id}`, label: t.name, sub: 'Tactics', page: 'tactics', category: 'Tactics' })
                );
            }
            allDataRef.current = all;
        }).finally(() => setLoading(false));
    }, [isOpen]);

    // Filter on query change
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setSelectedIdx(0);
            return;
        }
        const q = query.toLowerCase();
        const filtered = allDataRef.current.filter(r =>
            r.label.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
        ).slice(0, 12);
        setResults(filtered);
        setSelectedIdx(0);
    }, [query]);

    const displayItems: (Result | { type: 'quicklink'; label: string; page: Page; category: Category })[] =
        query.trim() ? results : QUICK_LINKS.map(q => ({ type: 'quicklink' as const, ...q }));

    const handleSelect = useCallback((page: Page) => {
        onNavigate(page);
        onClose();
    }, [onNavigate, onClose]);

    // Keyboard nav
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { onClose(); return; }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIdx(i => Math.min(i + 1, displayItems.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIdx(i => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
                const item = displayItems[selectedIdx];
                if (item) handleSelect(item.page);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, displayItems, selectedIdx, onClose, handleSelect]);

    // Scroll selected item into view
    useEffect(() => {
        const el = listRef.current?.children[selectedIdx] as HTMLElement | undefined;
        el?.scrollIntoView({ block: 'nearest' });
    }, [selectedIdx]);

    // Group results by category
    const grouped = query.trim()
        ? Object.entries(
            results.reduce<Record<Category, Result[]>>((acc, r) => {
                (acc[r.category] = acc[r.category] || []).push(r);
                return acc;
            }, {} as Record<Category, Result[]>)
          )
        : null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        key="cmd-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
                        <motion.div
                            key="cmd-panel"
                            initial={{ opacity: 0, scale: 0.96, y: -12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: -12 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl shadow-black/20 overflow-hidden pointer-events-auto"
                        >
                            {/* Search input */}
                            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
                                <Search size={18} className="text-muted flex-shrink-0" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Search players, sessions, exercises..."
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    className="flex-1 bg-transparent text-foreground placeholder-muted text-sm outline-none"
                                />
                                <kbd className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded border border-border text-[10px] font-semibold text-muted">
                                    ESC
                                </kbd>
                            </div>

                            {/* Results */}
                            <div ref={listRef} className="max-h-80 overflow-y-auto py-2 custom-scrollbar">
                                {loading && (
                                    <div className="space-y-1 px-3 py-2">
                                        {[1,2,3].map(i => <div key={i} className="h-10 rounded-xl bg-surface-hover animate-pulse" />)}
                                    </div>
                                )}

                                {!loading && displayItems.length === 0 && query.trim() && (
                                    <div className="px-4 py-10 text-center text-muted text-sm">
                                        No results for "{query}"
                                    </div>
                                )}

                                {!loading && !query.trim() && (
                                    <div className="px-3 pt-1 pb-1">
                                        <p className="px-2 pb-2 text-[10px] font-semibold text-muted uppercase tracking-wider">Quick navigation</p>
                                        {QUICK_LINKS.map((link, i) => {
                                            const meta = CATEGORY_META[link.category];
                                            const isSelected = i === selectedIdx;
                                            return (
                                                <button
                                                    key={link.page}
                                                    onClick={() => handleSelect(link.page)}
                                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-surface-hover text-foreground'}`}
                                                >
                                                    <span className={`flex-shrink-0 ${meta.color}`}>{meta.icon}</span>
                                                    <span className="flex-1 text-sm font-medium">{link.label}</span>
                                                    <ChevronRight size={14} className={`flex-shrink-0 transition-opacity ${isSelected ? 'opacity-60' : 'opacity-0'}`} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {!loading && query.trim() && grouped && grouped.length > 0 && (
                                    <div className="px-3 space-y-0">
                                        {(() => {
                                            let globalIdx = 0;
                                            return grouped.map(([cat, items]) => {
                                                const meta = CATEGORY_META[cat as Category];
                                                const nodes = items.map(item => {
                                                    const idx = globalIdx++;
                                                    const isSelected = idx === selectedIdx;
                                                    return (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => handleSelect(item.page)}
                                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-surface-hover'}`}
                                                        >
                                                            <span className={`flex-shrink-0 ${meta.color}`}>{meta.icon}</span>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>{item.label}</p>
                                                                <p className="text-[10px] text-muted truncate">{item.sub}</p>
                                                            </div>
                                                            <ChevronRight size={14} className={`flex-shrink-0 transition-opacity ${isSelected ? 'opacity-60 text-primary' : 'opacity-0 text-muted'}`} />
                                                        </button>
                                                    );
                                                });
                                                return (
                                                    <div key={cat} className="pt-2">
                                                        <p className="px-2 pb-1 text-[10px] font-semibold text-muted uppercase tracking-wider">{cat}</p>
                                                        {nodes}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                )}
                            </div>

                            {/* Footer hint */}
                            <div className="px-4 py-2.5 border-t border-border flex items-center gap-4 text-[10px] text-muted font-medium bg-surface/50">
                                <span className="flex items-center gap-1"><kbd className="border border-border rounded px-1 py-0.5 text-[9px] bg-surface">↑↓</kbd> navigate</span>
                                <span className="flex items-center gap-1"><kbd className="border border-border rounded px-1 py-0.5 text-[9px] bg-surface">↵</kbd> select</span>
                                <span className="flex items-center gap-1"><kbd className="border border-border rounded px-1 py-0.5 text-[9px] bg-surface">ESC</kbd> close</span>
                                <span className="ml-auto flex items-center gap-1 opacity-70">
                                    <Command size={10} /> K
                                </span>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
