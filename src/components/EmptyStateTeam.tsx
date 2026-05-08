import { Users, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmptyStateTeamProps {
  onCreateTeam: () => void;
}

export default function EmptyStateTeam({ onCreateTeam }: EmptyStateTeamProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-100px)] p-6">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="max-w-md w-full bg-slate-900 border border-white/5 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <div className="relative mb-6">
          <div className="w-20 h-20 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto border border-indigo-500/20 transform -rotate-6 group-hover:rotate-0 transition-transform duration-300">
            <Users className="w-10 h-10 text-indigo-400" />
          </div>
          <div className="absolute top-0 right-1/2 translate-x-12 -translate-y-2 w-8 h-8 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20 transform rotate-12 group-hover:rotate-6 transition-transform duration-300 backdrop-blur-sm">
            <Plus className="w-4 h-4 text-blue-400" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-3">Welcome to CoachHub</h2>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          You don't have any teams yet. Create your first team to start managing players, tracking performances, and designing training sessions.
        </p>

        <button
          onClick={onCreateTeam}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/25"
        >
          <Plus size={18} />
          <span>Create Your First Team</span>
        </button>
      </motion.div>
    </div>
  );
}
