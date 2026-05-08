import { useState, useEffect } from 'react';
import { Download, Upload, Check, BookOpen, Lightbulb, Trophy, Clipboard, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { PlaybookService, PlaybookData } from '../services/playbook-service';
import { Exercise, Basic, Principle, Tactic } from '../types/models';

interface PlaybookManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportSuccess?: () => void;
}

type ItemType = 'exercises' | 'basics' | 'principles' | 'tactics';

export function PlaybookManagementModal({ isOpen, onClose, onImportSuccess }: PlaybookManagementModalProps) {
    const [mode, setMode] = useState<'export' | 'import'>('export');
    const [isLoading, setIsLoading] = useState(false);
    const [playbookData, setPlaybookData] = useState<PlaybookData | null>(null);
    const [selectedIds, setSelectedIds] = useState<Record<ItemType, Set<string>>>({
        exercises: new Set(),
        basics: new Set(),
        principles: new Set(),
        tactics: new Set()
    });

    useEffect(() => {
        if (isOpen && mode === 'export') {
            fetchData();
        }
    }, [isOpen, mode]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const data = await PlaybookService.exportPlaybook();
            setPlaybookData(data);
            // Default select all
            setSelectedIds({
                exercises: new Set(data.exercises.map(i => i.id)),
                basics: new Set(data.basics.map(i => i.id)),
                principles: new Set(data.principles.map(i => i.id)),
                tactics: new Set(data.tactics.map(i => i.id))
            });
        } catch (err) {
            toast.error("Failed to fetch playbook data");
        } finally {
            setIsLoading(false);
        }
    };

    const toggleItem = (type: ItemType, id: string) => {
        const next = new Set(selectedIds[type]);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds({ ...selectedIds, [type]: next });
    };

    const selectAll = () => {
        if (!playbookData) return;
        setSelectedIds({
            exercises: new Set(playbookData.exercises.map(i => i.id)),
            basics: new Set(playbookData.basics.map(i => i.id)),
            principles: new Set(playbookData.principles.map(i => i.id)),
            tactics: new Set(playbookData.tactics.map(i => i.id))
        });
    };

    const selectNone = () => {
        setSelectedIds({
            exercises: new Set(),
            basics: new Set(),
            principles: new Set(),
            tactics: new Set()
        });
    };

    const handleExport = () => {
        if (!playbookData) return;

        const dataToExport: PlaybookData = {
            exercises: playbookData.exercises.filter(i => selectedIds.exercises.has(i.id)),
            basics: playbookData.basics.filter(i => selectedIds.basics.has(i.id)),
            principles: playbookData.principles.filter(i => selectedIds.principles.has(i.id)),
            tactics: playbookData.tactics.filter(i => selectedIds.tactics.has(i.id))
        };

        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `playbook-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Playbook exported successfully");
    };

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target?.result as string) as PlaybookData;
                if (!data.exercises || !data.basics || !data.principles || !data.tactics) {
                    throw new Error("Invalid playbook format");
                }
                
                setIsLoading(true);
                const res = await PlaybookService.importPlaybook(data);
                toast.success(res.message);
                if (onImportSuccess) onImportSuccess();
                onClose();
            } catch (err) {
                toast.error("Failed to import playbook: " + (err instanceof Error ? err.message : "Invalid JSON"));
            } finally {
                setIsLoading(false);
            }
        };
        reader.readAsText(file);
    };

    const renderItemList = (type: ItemType, items: (Exercise | Basic | Principle | Tactic)[], icon: React.ReactNode, title: string) => {
        if (items.length === 0) return null;
        return (
            <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                    {icon}
                    <h4 className="text-xs font-bold text-muted uppercase tracking-widest">{title}</h4>
                    <span className="text-[10px] bg-surface-raised px-1.5 py-0.5 rounded text-dimmed">{items.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map(item => (
                        <div 
                            key={item.id}
                            onClick={() => toggleItem(type, item.id)}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group
                                ${selectedIds[type].has(item.id) 
                                    ? 'bg-primary/10 border-primary/30 text-foreground' 
                                    : 'bg-surface-hover border-border text-muted hover:border-border-subtle'}`}
                        >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all
                                ${selectedIds[type].has(item.id) ? 'bg-primary border-primary' : 'border-border'}`}>
                                {selectedIds[type].has(item.id) && <Check size={12} className="text-white" />}
                            </div>
                            <span className="text-sm font-medium truncate">{item.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'export' ? "Export Playbook" : "Import Playbook"}
            maxWidth="3xl"
            icon={mode === 'export' ? <Download className="text-blue-400" /> : <Upload className="text-emerald-400" />}
        >
            <div className="space-y-6">
                {/* Mode Switcher */}
                <div className="flex p-1 bg-surface-raised/50 rounded-xl border border-border">
                    <button 
                        onClick={() => setMode('export')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all
                            ${mode === 'export' ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-foreground'}`}
                    >
                        <Download size={16} /> Export
                    </button>
                    <button 
                        onClick={() => setMode('import')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all
                            ${mode === 'import' ? 'bg-emerald-600 text-white shadow-lg' : 'text-muted hover:text-foreground'}`}
                    >
                        <Upload size={16} /> Import
                    </button>
                </div>

                {mode === 'export' ? (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted">Select the items you want to include in your export file.</p>
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={selectNone}>Select None</Button>
                                <Button variant="secondary" onClick={selectAll}>Select All</Button>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4">
                                <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                                <span className="text-muted text-sm">Loading playbook data...</span>
                            </div>
                        ) : playbookData ? (
                            <div className="space-y-8 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                                {renderItemList('basics', playbookData.basics, <BookOpen size={14} className="text-sky-400" />, 'Basics')}
                                {renderItemList('principles', playbookData.principles, <Lightbulb size={14} className="text-purple-400" />, 'Principles')}
                                {renderItemList('tactics', playbookData.tactics, <Trophy size={14} className="text-emerald-400" />, 'Tactics')}
                                {renderItemList('exercises', playbookData.exercises, <Clipboard size={14} className="text-amber-400" />, 'Exercises')}
                            </div>
                        ) : (
                            <div className="py-20 text-center border-2 border-dashed border-border rounded-2xl">
                                <p className="text-muted">No data found to export</p>
                            </div>
                        )}

                        <div className="pt-4 border-t border-border flex justify-end gap-3">
                            <Button variant="secondary" onClick={onClose}>Cancel</Button>
                            <Button 
                                onClick={handleExport} 
                                disabled={isLoading || !playbookData || (selectedIds.exercises.size === 0 && selectedIds.basics.size === 0 && selectedIds.principles.size === 0 && selectedIds.tactics.size === 0)}
                            >
                                Download Export (.json)
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 py-4">
                        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-2xl bg-surface-hover/50 hover:bg-surface-hover hover:border-emerald-500/30 transition-all group">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-6 group-hover:scale-110 transition-transform">
                                <FileJson size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-foreground mb-2">Upload Playbook File</h3>
                            <p className="text-muted text-sm text-center max-w-xs mb-8">
                                Select a .json playbook file exported from another CoachHub account to import it into your library.
                            </p>
                            
                            <input 
                                type="file" 
                                id="playbook-import" 
                                className="hidden" 
                                accept=".json" 
                                onChange={handleImportFile}
                                disabled={isLoading}
                            />
                            <label htmlFor="playbook-import" className="inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-bold cursor-pointer transition-all bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20">
                                {isLoading ? 'Importing...' : 'Choose File'}
                            </label>
                        </div>

                        <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl">
                            <p className="text-xs text-amber-200/70 leading-relaxed">
                                <strong>Note:</strong> Items with the same name as existing ones in your library will be skipped to prevent duplicates. This process cannot be undone.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
