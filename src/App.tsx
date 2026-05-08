import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TeamProvider } from './contexts/TeamContext';

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
import { Page } from './types/ui';

// Services
import { AuthService } from './services';
import { useTeam } from './contexts/TeamContext';

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

  // Force Dark Mode 
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const handleLogout = () => {
    // 1. Instant local logout for snappy UX
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('user'); 
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

function AppLayout({ currentPage, navigateToPage, handleLogout }: { currentPage: Page, navigateToPage: (page: Page) => void, handleLogout: () => void }) {
  const { loading } = useTeam();
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const handleOpenTeamModal = () => setIsTeamModalOpen(true);
    window.addEventListener('open-create-team', handleOpenTeamModal);
    return () => window.removeEventListener('open-create-team', handleOpenTeamModal);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
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
  };

  return (
      <div className="flex h-screen bg-[#0b0f19] text-slate-200 selection:bg-blue-500/30 overflow-hidden">
        <Navigation 
          currentPage={currentPage} 
          onNavigate={navigateToPage}
          onLogout={handleLogout}
        />
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18, ease: 'easeInOut' }}
              className="min-h-full flex flex-col"
            >
              {loading ? (
                <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-100px)]">
                  <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                </div>
              ) : (
                pageContent[currentPage as Exclude<Page, 'login'>]
              )}
            </motion.div>
          </AnimatePresence>
        </main>
        
        <TeamFormModal 
          isOpen={isTeamModalOpen} 
          onClose={() => setIsTeamModalOpen(false)} 
          onSuccess={() => setIsTeamModalOpen(false)} 
        />

        <CommandPalette
          isOpen={cmdOpen}
          onClose={() => setCmdOpen(false)}
          onNavigate={(page) => { navigateToPage(page as Page); }}
        />
      </div>
  );
}

// If authenticated, show the Main App
  if (!isAuthenticated) {
    return (
      <>
        <LoginPage onLogin={handleLogin} />
        <Toaster position="top-right" theme="dark" />
      </>
    );
  }

  return (
    <TeamProvider isAuthenticated={isAuthenticated}>
      <DndProvider backend={HTML5Backend}>
        <AppLayout currentPage={currentPage} navigateToPage={navigateToPage} handleLogout={handleLogout} />
        <Toaster position="top-right" theme="dark" />
      </DndProvider>
    </TeamProvider>
  );
}