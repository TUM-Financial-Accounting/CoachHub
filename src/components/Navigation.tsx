import { useState } from 'react';
import { Home, Users, Calendar, BookOpen, Lightbulb, Trophy, Target, LogOut, Clipboard, ChevronLeft, ChevronRight } from 'lucide-react';
import { Page, NavigationProps } from '../types/ui';
import { motion, AnimatePresence } from 'framer-motion';
import TeamSwitcher from './TeamSwitcher';

const NAV_ITEMS: { id: Page; label: string; icon: React.ElementType; color: string; activeBar: string; activeBg: string }[] = [
  { id: 'dashboard',       label: 'Dashboard',    icon: Home,      color: 'text-blue-400',    activeBar: 'bg-blue-500',    activeBg: 'bg-blue-500/10' },
  { id: 'team',            label: 'Team',         icon: Users,     color: 'text-indigo-400',  activeBar: 'bg-indigo-500',  activeBg: 'bg-indigo-500/10' },
  { id: 'session-planner', label: 'Training',     icon: Calendar,  color: 'text-cyan-400',    activeBar: 'bg-cyan-500',    activeBg: 'bg-cyan-500/10' },
  { id: 'training',        label: 'Exercises',    icon: Clipboard, color: 'text-amber-400',   activeBar: 'bg-amber-500',   activeBg: 'bg-amber-500/10' },
  { id: 'basics',          label: 'Basics',       icon: BookOpen,  color: 'text-sky-400',     activeBar: 'bg-sky-500',     activeBg: 'bg-sky-500/10' },
  { id: 'principles',      label: 'Principles',   icon: Lightbulb, color: 'text-purple-400',  activeBar: 'bg-purple-500',  activeBg: 'bg-purple-500/10' },
  { id: 'tactics',         label: 'Tactics',      icon: Trophy,    color: 'text-emerald-400', activeBar: 'bg-emerald-500', activeBg: 'bg-emerald-500/10' },
  { id: 'match',           label: 'Match',        icon: Target,    color: 'text-rose-400',    activeBar: 'bg-rose-500',    activeBg: 'bg-rose-500/10' },
];

export default function Navigation({ currentPage, onNavigate, onLogout }: NavigationProps) {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative flex flex-col h-screen bg-[#0b0f19] border-r border-white/5 z-40 flex-shrink-0 overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5 min-h-[72px]">
        <div className="flex-shrink-0 bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
          <Trophy className="w-5 h-5 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="text-base font-bold text-white tracking-tight whitespace-nowrap overflow-hidden"
            >
              CoachHub
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Team Switcher */}
      <TeamSwitcher collapsed={collapsed} />

      {/* Nav Items */}
      <nav className="flex-1 flex flex-col gap-1 px-2 py-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              className={`relative flex items-center gap-3 w-full rounded-xl px-3 py-2.5 transition-all duration-150 group
                ${isActive
                  ? `${item.activeBg} border border-white/5`
                  : 'hover:bg-white/5 border border-transparent'
                }`}
            >
              {/* Active left bar */}
              {isActive && (
                <motion.div
                  layoutId="sidebar-bar"
                  className={`absolute left-0 top-0 bottom-0 my-auto w-1 h-5 rounded-r-full ${item.activeBar}`}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              <Icon
                className={`w-[18px] h-[18px] flex-shrink-0 transition-colors
                  ${isActive ? item.color : 'text-slate-500 group-hover:text-slate-300'}`}
              />

              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.12 }}
                    className={`text-sm font-medium whitespace-nowrap overflow-hidden
                      ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </nav>

      {/* ⌘K hint */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="px-4 py-2"
          >
            <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-[10px] font-semibold text-slate-700">
              <span>Search</span>
              <div className="flex items-center gap-0.5">
                <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/5">⌘</kbd>
                <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/5">K</kbd>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom: Logout + Toggle */}
      <div className="px-2 py-3 border-t border-white/5 space-y-1">
        <button
          type="button"
          onClick={onLogout}
          title={collapsed ? 'Logout' : undefined}
          className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent transition-all duration-150 group"
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.12 }}
                className="text-sm font-medium whitespace-nowrap"
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-slate-600 hover:text-slate-300 hover:bg-white/5 border border-transparent transition-all duration-150"
        >
          {collapsed
            ? <ChevronRight className="w-[18px] h-[18px] flex-shrink-0" />
            : <ChevronLeft className="w-[18px] h-[18px] flex-shrink-0" />
          }
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.12 }}
                className="text-xs font-medium text-slate-500 whitespace-nowrap"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}
