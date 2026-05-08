import { useState } from 'react';
import { Home, Users, Calendar, BookOpen, Lightbulb, Trophy, Target, LogOut, Clipboard, ChevronLeft, ChevronRight, Sun, Moon, Monitor } from 'lucide-react';
import { Page, NavigationProps } from '../types/ui';
import { motion, AnimatePresence } from 'framer-motion';
import TeamSwitcher from './TeamSwitcher';
import { useTheme } from '../contexts/ThemeContext';

const NAV_GROUPS: { 
  label: string; 
  items: { id: Page; label: string; icon: React.ElementType; color: string; activeBar: string; activeBg: string }[] 
}[] = [
  {
    label: 'Team',
    items: [
      { id: 'dashboard',       label: 'Dashboard',    icon: Home,      color: 'text-blue-500',    activeBar: 'bg-blue-500',    activeBg: 'bg-blue-500/15 dark:bg-blue-500/25' },
      { id: 'team',            label: 'Squad Roster', icon: Users,     color: 'text-indigo-500',  activeBar: 'bg-indigo-500',  activeBg: 'bg-indigo-500/15 dark:bg-indigo-500/25' },
      { id: 'session-planner', label: 'Training',     icon: Calendar,  color: 'text-cyan-500',    activeBar: 'bg-cyan-500',    activeBg: 'bg-cyan-500/15 dark:bg-cyan-500/25' },
      { id: 'match',           label: 'Matches',      icon: Target,    color: 'text-rose-500',    activeBar: 'bg-rose-500',    activeBg: 'bg-rose-500/15 dark:bg-rose-500/25' },
    ]
  },
  {
    label: 'Playbook',
    items: [
      { id: 'training',        label: 'Exercises',    icon: Clipboard, color: 'text-amber-500',   activeBar: 'bg-amber-500',   activeBg: 'bg-amber-500/15 dark:bg-amber-500/25' },
      { id: 'basics',          label: 'Basics',       icon: BookOpen,  color: 'text-sky-500',     activeBar: 'bg-sky-500',     activeBg: 'bg-sky-500/15 dark:bg-sky-500/25' },
      { id: 'principles',      label: 'Principles',   icon: Lightbulb, color: 'text-purple-500',  activeBar: 'bg-purple-500',  activeBg: 'bg-purple-500/15 dark:bg-purple-500/25' },
      { id: 'tactics',         label: 'Tactics',      icon: Trophy,    color: 'text-emerald-500', activeBar: 'bg-emerald-500', activeBg: 'bg-emerald-500/15 dark:bg-emerald-500/25' },
    ]
  },
  {
    label: 'Vision',
    items: [
      { id: 'vision',          label: 'Vision Library', icon: Target,    color: 'text-pink-500',    activeBar: 'bg-pink-500',    activeBg: 'bg-pink-500/15 dark:bg-pink-500/25' },
    ]
  }
];

export default function Navigation({ currentPage, onNavigate, onLogout, isMobileOpen, onMobileClose }: NavigationProps) {
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  };

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else setTheme('light');
  };

  const ThemeIcon = theme === 'system' ? Monitor : theme === 'light' ? Sun : Moon;

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            onClick={onMobileClose}
          />
        )}
      </AnimatePresence>

      <motion.aside
        animate={{ width: collapsed && !isMobileOpen ? 72 : 240 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`fixed md:relative inset-y-0 left-0 flex flex-col h-screen bg-surface border-r border-border z-50 md:z-40 flex-shrink-0 overflow-hidden transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border min-h-[72px]">
        <div className="flex-shrink-0 bg-primary p-2 rounded-xl shadow-lg shadow-blue-500/20 text-white">
          <Trophy className="w-5 h-5" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="text-base font-bold text-foreground tracking-tight whitespace-nowrap overflow-hidden"
            >
              CoachHub
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Team Switcher */}
      <TeamSwitcher collapsed={collapsed} />

      {/* Nav Items */}
      <nav className="flex-1 flex flex-col gap-6 px-2 py-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            {!collapsed && (
              <div className="px-3 mb-1">
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest leading-none">
                  {group.label}
                </span>
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    if (onMobileClose) onMobileClose();
                  }}
                  title={collapsed && !isMobileOpen ? item.label : undefined}
                  className={`relative flex items-center gap-3 w-full rounded-xl px-3 py-2 transition-all duration-150 group
                    ${isActive
                      ? `${item.activeBg} border border-transparent`
                      : 'hover:bg-surface-hover border border-transparent'
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
                      ${isActive ? item.color : 'text-muted group-hover:text-foreground'}`}
                  />

                  <AnimatePresence>
                    {(!collapsed || isMobileOpen) && (
                      <motion.span
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.12 }}
                        className={`text-sm font-medium whitespace-nowrap overflow-hidden
                          ${isActive ? 'text-foreground' : 'text-muted group-hover:text-foreground'}`}
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ⌘K hint */}
      <AnimatePresence>
        {(!collapsed || isMobileOpen) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="px-4 py-2"
          >
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-search'));
                if (onMobileClose) onMobileClose();
              }}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl bg-surface-hover hover:bg-surface-hover/80 border border-border text-[10px] font-semibold text-muted cursor-pointer transition-colors"
            >
              <span>Search</span>
              <div className="flex items-center gap-0.5">
                <kbd className="px-1 py-0.5 rounded bg-surface-raised border border-border">⌘</kbd>
                <kbd className="px-1 py-0.5 rounded bg-surface-raised border border-border">K</kbd>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom: Theme + Logout + Toggle */}
      <div className="px-2 py-3 border-t border-border space-y-1">
        {/* Theme Toggle */}
        <button
          type="button"
          onClick={cycleTheme}
          title={collapsed && !isMobileOpen ? `Theme: ${theme}` : undefined}
          className="flex items-center gap-3 w-full rounded-xl px-3 py-2 text-muted hover:text-primary hover:bg-primary/10 border border-transparent transition-all duration-150 group"
        >
          <ThemeIcon className="w-[18px] h-[18px] flex-shrink-0" />
          <AnimatePresence>
            {(!collapsed || isMobileOpen) && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.12 }}
                className="text-sm font-medium whitespace-nowrap capitalize"
              >
                {theme} Mode
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <button
          type="button"
          onClick={onLogout}
          title={collapsed && !isMobileOpen ? 'Logout' : undefined}
          className="flex items-center gap-3 w-full rounded-xl px-3 py-2 text-muted hover:text-red-500 hover:bg-red-500/10 border border-transparent transition-all duration-150 group"
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          <AnimatePresence>
            {(!collapsed || isMobileOpen) && (
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
          onClick={toggleSidebar}
          title={collapsed && !isMobileOpen ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden md:flex items-center gap-3 w-full rounded-xl px-3 py-2 text-muted/60 hover:text-muted hover:bg-surface-hover border border-transparent transition-all duration-150"
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
                className="text-xs font-medium text-muted/60 whitespace-nowrap"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
    </>
  );
}
