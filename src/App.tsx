import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Trophy, Users } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TeamProvider } from './contexts/TeamContext';
import { SeasonProvider, useSeason } from './contexts/SeasonContext';
import { Button } from './components/ui/Button';

// Components
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import TeamManagement from './components/TeamManagement';
import TrainingManager from './components/TrainingManager';
import ExercisesLibrary from './components/ExercisesLibrary';
import BasicsLibrary from './components/BasicsLibrary';
import PrinciplesLibrary from './components/PrinciplesLibrary';
import TacticsLibrary from './components/TacticsLibrary';
import MatchLineup from './components/MatchLineup';
import Navigation from './components/Navigation';
import CommandPalette from './components/CommandPalette';
import TeamFormModal from './components/TeamFormModal';
import SeasonFormModal from './components/SeasonFormModal';
import VisionLibrary from './components/VisionLibrary';
import StatisticsView from './components/StatisticsView';
import FeedbackView from './components/FeedbackView';
import BottomNav from './components/BottomNav';
import { Page } from './types/ui';

// Services
import { AuthService } from './services';
import { useTeam } from './contexts/TeamContext';
import { useTheme } from './contexts/ThemeContext';

export default function App() {
  console.log("[App] Rendering component...");
  // 1. Initialize Auth State from LocalStorage
  // If 'isAuthenticated' exists in browser memory, start as true.
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAuthenticated') === 'true';
  });

  // 2. Initialize Page State
  // If logged in, start at 'dashboard', otherwise 'login'
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    return localStorage.getItem('isAuthenticated') === 'true' ? 'dashboard' : 'login';
  });

  const { theme } = useTheme();
  const toasterTheme = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;

  const handleLogout = () => {
    // 1. Instant local logout for snappy UX
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    setIsAuthenticated(false);
    setCurrentPage('login');
    toast.success("Logged out successfully");

    // 2. Clear backend session in background
    AuthService.logout().catch(err => {
      console.error("Backend logout failed:", err);
    });
  };

  // 3. Check Session on Mount
  // Verify if the JWT cookie is still valid even if LocalStorage says we are authenticated.
  useEffect(() => {
    const checkSession = async () => {
      console.log(`[App] checkSession. isAuthenticated: ${isAuthenticated}`);
      if (isAuthenticated) {
        try {
          console.log("[App] Calling getCurrentUser...");
          await AuthService.getCurrentUser();
          console.log("[App] Session valid.");
        } catch (error) {
          console.error("[App] Session check failed:", error);
          // If the cookie is invalid or expired, the API will return 401
          // and our api-client will handle the reload/logout, but we can also do it here.
          handleLogout();
        }
      }
    };
    checkSession();
  }, [isAuthenticated]);

  const handleLogin = () => {
    // Save to browser memory
    localStorage.setItem('isAuthenticated', 'true');
    setIsAuthenticated(true);
    setCurrentPage('dashboard');
  };

  const navigateToPage = (page: Page) => {
    setCurrentPage(page);
  };

// If authenticated, show the Main App
  if (!isAuthenticated) {
    return (
      <>
        <LoginPage onLogin={handleLogin} />
        <Toaster position="top-right" theme={toasterTheme} />
      </>
    );
  }

  return (
    <SeasonProvider isAuthenticated={isAuthenticated}>
      <TeamProvider isAuthenticated={isAuthenticated}>
        <DndProvider backend={HTML5Backend}>
          <AppLayout currentPage={currentPage} navigateToPage={navigateToPage} handleLogout={handleLogout} />
          <Toaster position="top-right" theme={toasterTheme} />
        </DndProvider>
      </TeamProvider>
    </SeasonProvider>
  );
}

function AppLayout({ currentPage, navigateToPage, handleLogout }: { currentPage: Page, navigateToPage: (page: Page) => void, handleLogout: () => void }) {
  const { activeTeam, loading: teamLoading } = useTeam();
  const { activeSeason, loading: seasonLoading } = useSeason();
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleOpenTeamModal = () => setIsTeamModalOpen(true);
    const handleOpenSeasonModal = () => setIsSeasonModalOpen(true);
    window.addEventListener('open-create-team', handleOpenTeamModal);
    window.addEventListener('open-create-season', handleOpenSeasonModal);
    return () => {
       window.removeEventListener('open-create-team', handleOpenTeamModal);
       window.removeEventListener('open-create-season', handleOpenSeasonModal);
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);

    const handleOpenSearch = () => setCmdOpen(true);
    window.addEventListener('open-search', handleOpenSearch);

    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('open-search', handleOpenSearch);
    };
  }, []);

  const pageContent: Record<Exclude<Page, 'login'>, React.ReactNode> = {
    dashboard:      <Dashboard onNavigate={navigateToPage} />,
    team:           <TeamManagement />,
    training:       <ExercisesLibrary />,
    'session-planner': <TrainingManager />,
    basics:         <BasicsLibrary />,
    principles:     <PrinciplesLibrary />,
    tactics:        <TacticsLibrary />,
    match:          <MatchLineup />,
    vision:         <VisionLibrary />,
    statistics:     <StatisticsView />,
    feedback:       <FeedbackView />,
  };

  const isLoading = teamLoading || seasonLoading;
  const showNoTeamGuard = !isLoading && activeSeason && !activeTeam && currentPage !== 'feedback';

  return (
      <div className="flex h-[100dvh] bg-background text-foreground selection:bg-blue-500/30 overflow-hidden">
        <Navigation 
          currentPage={currentPage} 
          onNavigate={navigateToPage}
          onLogout={handleLogout}
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />
        
        <main className="flex-1 overflow-hidden h-full flex flex-col min-h-0 relative pb-16 md:pb-0">
          {/* Mobile Branding Bar (Mini) */}
          <div className="md:hidden flex items-center justify-center py-2 bg-background/50 backdrop-blur-sm border-b border-border/50">
             <div className="flex items-center gap-2 opacity-50">
                <Trophy size={12} className="text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest">CoachHub</span>
             </div>
          </div>

          <AnimatePresence mode="wait">
            {showNoTeamGuard ? (
              <motion.div
                key="no-team-guard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/50 backdrop-blur-sm"
              >
                <div className="max-w-md space-y-6">
                  <div className="w-20 h-20 bg-amber-500/10 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Users size={40} />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight text-foreground">No Team in {activeSeason.name}</h2>
                  <p className="text-muted leading-relaxed">
                    Every season needs at least one team to manage players, matches, and training sessions.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                    <Button 
                      onClick={() => setIsTeamModalOpen(true)} 
                      icon={<Trophy size={18} />}
                      className="w-full sm:w-auto"
                    >
                      Setup Your Team
                    </Button>
                    <Button 
                      variant="secondary"
                      onClick={() => setIsSeasonModalOpen(true)}
                      className="w-full sm:w-auto"
                    >
                      Change Season
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={currentPage}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18, ease: 'easeInOut' }}
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
              >
                {teamLoading || seasonLoading ? (
                  <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-100px)]">
                    <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  </div>
                ) : (
                  pageContent[currentPage as Exclude<Page, 'login'>]
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
        
        <TeamFormModal 
          isOpen={isTeamModalOpen} 
          onClose={() => setIsTeamModalOpen(false)} 
          onSuccess={() => setIsTeamModalOpen(false)} 
        />
        <SeasonFormModal 
          isOpen={isSeasonModalOpen} 
          onClose={() => setIsSeasonModalOpen(false)} 
          onSuccess={() => setIsSeasonModalOpen(false)} 
        />

        <CommandPalette
          isOpen={cmdOpen}
          onClose={() => setCmdOpen(false)}
          onNavigate={(page) => { navigateToPage(page as Page); }}
        />

        <BottomNav currentPage={currentPage} onNavigate={navigateToPage} />
      </div>
  );
}