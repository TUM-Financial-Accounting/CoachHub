import { useState, useEffect } from 'react';
import { Upload, FileText, Trash2, Eye, Download, Plus, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// UI Components
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

// --- Services ---
import { apiClient } from '../services/api-client';
import { uploadFile } from '../lib/uploadFile';

interface Vision {
    id: string;
    title: string;
    filename: string;
    uploaded_at: string;
}

export default function VisionLibrary() {
    const [visions, setVisions] = useState<Vision[]>([]);
    const [, setIsLoading] = useState(true);
    const [viewingVision, setViewingVision] = useState<Vision | null>(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const [selectedVisionId, setSelectedVisionId] = useState<string | null>(null);

    useEffect(() => {
        fetchVisions();
    }, []);

    const fetchVisions = async () => {
        try {
            const data = await apiClient.get<Vision[]>('/visions');
            setVisions(data);
        } catch (err) {
            toast.error("Failed to load vision log");
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile || !newTitle) return;

        setUploading(true);
        try {
            // 1. Upload the file to static storage
            const url = await uploadFile(selectedFile);
            const filename = url.split('/').pop() || '';

            // 2. Create the Vision record
            await apiClient.post('/visions', {
                title: newTitle,
                filename: filename
            });

            toast.success("Vision uploaded successfully");
            setShowUploadModal(false);
            setNewTitle('');
            setSelectedFile(null);
            fetchVisions();
        } catch (err) {
            toast.error("Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this version?")) return;
        try {
            await apiClient.delete(`/visions/${id}`);
            toast.success("Version deleted");
            fetchVisions();
        } catch (err) {
            toast.error("Delete failed");
        }
    };

    const selectedVision = visions.find(v => v.id === selectedVisionId) || visions[0] || null;

    return (
        <div className="h-full w-full flex flex-col p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto gap-6 overflow-y-auto lg:overflow-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-10 rounded-full bg-pink-500 flex-shrink-0" />
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Coaching Vision</h1>
                        <p className="text-sm text-muted mt-0.5">Manage and present your tactical philosophy</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button 
                        onClick={() => setShowUploadModal(true)}
                        icon={<Plus size={18} />}
                        className="shadow-lg shadow-pink-500/20"
                    >
                        New Version
                    </Button>
                </div>
            </div>

            {/* Master / Detail */}
            <div className="grid grid-cols-12 gap-6 lg:flex-1 lg:min-h-0">
                {/* LEFT: List */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-3">
                    <div className="space-y-2 lg:overflow-y-auto custom-scrollbar pr-1 lg:flex-1 lg:min-h-0">
                        <AnimatePresence>
                            {visions.length === 0 && (
                                <div className="text-center py-16 text-muted">
                                    <FileText size={32} className="mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">No visions found</p>
                                </div>
                            )}
                            {visions.map((v, idx) => {
                                const isSelected = selectedVision?.id === v.id;
                                const isLatest = idx === 0;
                                return (
                                    <motion.div
                                        key={v.id}
                                        layout
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.97 }}
                                        onClick={() => setSelectedVisionId(v.id)}
                                        className={`group relative rounded-xl border cursor-pointer transition-all p-4 ${
                                            isSelected
                                                ? 'bg-pink-500/10 border-pink-500/30'
                                                : 'bg-surface-hover/40 border-border hover:border-border hover:bg-surface-hover/70'
                                        }`}
                                    >
                                        <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-pink-500 ${isSelected ? 'opacity-100' : 'opacity-20 group-hover:opacity-50'} transition-opacity`} />
                                        <div className="pl-3 flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold truncate ${isSelected ? 'text-foreground' : 'text-foreground/90'}`}>{v.title}</p>
                                                <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 inline-block ${isLatest ? 'text-pink-500' : 'text-muted'}`}>
                                                    {isLatest ? 'Active Version' : 'Archived'}
                                                </span>
                                                <p className="text-xs text-muted mt-1">
                                                    {new Date(v.uploaded_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                {isSelected && <ChevronRight size={14} className="text-pink-500 mt-0.5" />}
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                                                    {!isLatest && (
                                                        <button
                                                            onClick={e => { e.stopPropagation(); handleDelete(v.id); }}
                                                            className="p-1.5 rounded-lg bg-surface-hover hover:bg-rose-500/10 text-muted hover:text-rose-500 border border-border transition-colors"
                                                        ><Trash2 size={11} /></button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </div>

                {/* RIGHT: Detail View */}
                <div className="col-span-12 lg:col-span-8 lg:h-full lg:overflow-hidden">
                    {selectedVision ? (
                        <motion.div
                            key={selectedVision.id}
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2 }}
                            className="h-full rounded-2xl border border-pink-500/20 bg-surface flex flex-col overflow-hidden"
                        >
                            <div className="p-6 border-b border-pink-500/20 bg-pink-500/5">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border mb-3 border-pink-500/20 bg-pink-500/10 text-pink-500`}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                                            {selectedVision.id === visions[0]?.id ? 'Current Phase' : 'Archived Phase'}
                                        </span>
                                        <h2 className="text-2xl font-bold text-foreground tracking-tight">{selectedVision.title}</h2>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <Button 
                                            variant="primary" 
                                            onClick={() => setViewingVision(selectedVision)}
                                            icon={<Eye size={16} />}
                                        >
                                            Present
                                        </Button>
                                        <a 
                                            href={`/static/uploads/${selectedVision.filename}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-surface text-muted hover:text-foreground text-xs font-bold border border-border transition-colors"
                                        >
                                            <Download size={14} /> Download
                                        </a>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Preview Window inside panel */}
                            <div className="flex-1 relative bg-background overflow-hidden isolate">
                                <iframe 
                                    src={`/static/uploads/${selectedVision.filename}#toolbar=0`}
                                    className="w-full h-full border-none pointer-events-none opacity-60"
                                    title="Active Vision Preview"
                                />
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/60 opacity-0 hover:opacity-100 transition-opacity text-foreground backdrop-blur-sm">
                                    <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-4 border border-white/20">
                                        <Eye size={24} />
                                    </div>
                                    <Button 
                                        variant="secondary"
                                        onClick={() => setViewingVision(selectedVision)}
                                        className="shadow-xl"
                                    >
                                        Click to Present Fullscreen
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <Card className="h-full flex flex-col items-center justify-center py-20 text-center border-dashed border-border bg-surface">
                            <div className="w-20 h-20 rounded-full bg-surface-hover flex items-center justify-center text-muted mb-6 shadow-none">
                                <FileText size={40} />
                            </div>
                            <h3 className="text-xl font-bold text-foreground mb-2">No Vision Found</h3>
                            <p className="text-muted max-w-xs mb-8">Upload your tactical vision PDF to share it with your staff.</p>
                            <Button onClick={() => setShowUploadModal(true)}>Upload Your First Vision</Button>
                        </Card>
                    )}
                </div>
            </div>

            {/* Upload Modal */}
            <Modal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                title="Upload New Vision"
                icon={<Upload className="text-blue-400" />}
            >
                <form onSubmit={handleFileUpload} className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-400 mb-2">Version Title</label>
                        <input
                            type="text"
                            placeholder="e.g., Pre-Season Vision 2024"
                            className="w-full bg-surface-raised border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            required
                        />
                    </div>

                    <div 
                        className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all
                            ${selectedFile ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border hover:border-primary/30 bg-surface-hover/50'}`}
                    >
                        <input
                            type="file"
                            accept=".pdf"
                            id="pdf-upload"
                            className="hidden"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        />
                        <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center">
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 
                                ${selectedFile ? 'bg-emerald-500/20 text-emerald-400' : 'bg-surface-raised text-muted'}`}>
                                <Upload size={24} />
                            </div>
                            <span className="text-sm font-medium text-foreground mb-1">
                                {selectedFile ? selectedFile.name : "Choose PDF Vision"}
                            </span>
                            <span className="text-xs text-slate-500">Only .pdf files supported</span>
                        </label>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button 
                            className="flex-1" 
                            variant="primary" 
                            type="submit" 
                            disabled={uploading || !selectedFile || !newTitle}
                            isLoading={uploading}
                        >
                            Upload & Set as Active
                        </Button>
                        <Button 
                            variant="secondary" 
                            onClick={() => setShowUploadModal(false)}
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Presentation Modal (Full Page Preview) */}
            <Modal
                isOpen={!!viewingVision}
                onClose={() => setViewingVision(null)}
                title={viewingVision?.title || "Vision Presenter"}
                maxWidth="6xl"
            >
                {viewingVision && (
                    <div className="flex flex-col h-[80vh]">
                        <iframe 
                            src={`/static/uploads/${viewingVision.filename}`}
                            className="w-full flex-1 rounded-xl border border-border bg-background"
                            title="Vision Viewer"
                        />
                        <div className="mt-6 flex justify-between items-center px-2">
                             <div className="text-slate-500 text-xs">
                                Uploaded on {new Date(viewingVision.uploaded_at).toLocaleString()}
                            </div>
                            <Button variant="secondary" onClick={() => setViewingVision(null)}>Close Presenter</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

