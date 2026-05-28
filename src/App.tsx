import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Trophy, Users, Plus } from 'lucide-react';
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
import { Page } from './types/ui';

// Services
import { AuthService } from './services';
import { useTeam } from './contexts/TeamContext';
import { useTheme } from './contexts/ThemeContext';
import { bootPrefetch } from './lib/bootPrefetch';
import { clearAllPageCache } from './lib/pageCache';

export default function App() {
  // 1. Initialize Auth State from LocalStorage
  // If 'isAuthenticated' exists in browser memory, start as true.
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAuthenticated') === 'true';
  });

  // 2. Boot session-validation gate. If we *claim* to be authenticated,
  // we block the UI behind a splash until we confirm with the backend.
  // This prevents the dashboard from flashing before we redirect to login
  // when the stored session has expired.
  const [bootChecking, setBootChecking] = useState(() => {
    return localStorage.getItem('isAuthenticated') === 'true';
  });

  // 3. Initialize Page State
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
    // Clear cached lists so the next user doesn't briefly see the previous
    // user's seasons / teams during their initial paint.
    localStorage.removeItem('cache:seasons:v1');
    localStorage.removeItem('cache:teams:v1');
    localStorage.removeItem('activeTeamId');
    localStorage.removeItem('activeSeasonId');
    clearAllPageCache();
    setIsAuthenticated(false);
    setCurrentPage('login');
    toast.success("Logged out successfully");

    // 2. Clear backend session in background
    AuthService.logout().catch(err => {
      console.error("Backend logout failed:", err);
    });
  };

  // 4. Boot session validation. Keeps the splash up until we've confirmed the
  // session is good, or quickly cleared it and bounced to login.
  useEffect(() => {
    if (!bootChecking) return; // not authenticated → nothing to validate

    let cancelled = false;
    (async () => {
      try {
        // Prefer the in-flight request kicked off at module load.
        const prefetched = bootPrefetch.takeMe();
        if (prefetched) {
          await prefetched;
        } else {
          await AuthService.getCurrentUser();
        }
      } catch (error: any) {
        if (cancelled) return;
        const isNetworkError = error.name === 'TypeError' || error.name === 'AbortError'
          || error.message?.includes('timed out') || error.message?.includes('Failed to fetch');
        if (isNetworkError) {
          // Backend unreachable — trust local state and let user in.
          console.warn("[App] Boot session check failed due to network error, staying logged in:", error.message);
        } else {
          // Invalid / expired session — clear and route to login.
          localStorage.removeItem('isAuthenticated');
          localStorage.removeItem('user');
          localStorage.removeItem('access_token');
          setIsAuthenticated(false);
          setCurrentPage('login');
        }
      } finally {
        if (!cancelled) setBootChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bootChecking]);

  const handleLogin = () => {
    // Save to browser memory
    localStorage.setItem('isAuthenticated', 'true');
    setIsAuthenticated(true);
    setCurrentPage('dashboard');
  };

  const navigateToPage = (page: Page) => {
    setCurrentPage(page);
  };

  // Splash while we validate the stored session, so the dashboard never
  // flashes before we possibly redirect to login.
  if (bootChecking) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-primary p-3 rounded-2xl shadow-lg shadow-primary/20 text-white">
            <Trophy className="w-7 h-7" />
          </div>
          <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

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
  const showNoSeasonGuard = !isLoading && !activeSeason && currentPage !== 'feedback';
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
        
        <main className="flex-1 overflow-hidden h-full flex flex-col min-h-0 relative">
          {/* Mobile Header */}
          <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 bg-primary p-1.5 rounded-lg shadow-sm shadow-primary/20 text-white">
                <Trophy className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold text-foreground tracking-tight">CoachHub</span>
            </div>
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -mr-2 text-muted hover:text-foreground hover:bg-surface-hover rounded-xl transition-colors"
            >
              <Menu size={20} />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {showNoSeasonGuard ? (
              <motion.div
                key="no-season-guard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/50 backdrop-blur-sm"
              >
                <div className="max-w-md space-y-6">
                  <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Trophy size={40} />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight text-foreground">Start Your Coaching Journey</h2>
                  <p className="text-muted leading-relaxed">
                    First, let's define a season (e.g. "2024/2025") so you can organize your teams and sessions.
                  </p>
                  <div className="pt-4">
                    <Button 
                      onClick={() => setIsSeasonModalOpen(true)} 
                      icon={<Plus size={18} />}
                      className="w-full sm:w-auto"
                    >
                      Create Your First Season
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : showNoTeamGuard ? (
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
                  <h2 className="text-3xl font-bold tracking-tight text-foreground">Setup Your Squad</h2>
                  <p className="text-muted leading-relaxed">
                    You're in the <b>{activeSeason?.name}</b> season. Now you just need to create a team to start managing your roster.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                    <Button 
                      onClick={() => setIsTeamModalOpen(true)} 
                      icon={<Users size={18} />}
                      className="w-full sm:w-auto"
                    >
                      Create My Team
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
      </div>
  );
}