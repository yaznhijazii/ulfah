import { useState, useEffect } from 'react';
import { AuthLogin } from './components/AuthLogin';
import { AuthSignup } from './components/AuthSignup';
import { HomeScreen } from './components/HomeScreen';
import { CalendarScreen } from './components/CalendarScreen';
import { GamesScreen } from './components/GamesScreen';
import { CommitmentsScreen } from './components/CommitmentsScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { DialogueScreen } from './components/DialogueScreen';
import { BottomNav } from './components/BottomNav';
import { LoveNotesScreen } from './components/LoveNotesScreen';
import { AdventureBucketScreen } from './components/AdventureBucketScreen';
import { FinanceScreen } from './components/FinanceScreen';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

type Screen =
  | 'login'
  | 'signup'
  | 'home'
  | 'calendar'
  | 'games'
  | 'commitments'
  | 'settings'
  | 'dialogues'
  | 'love_notes'
  | 'finance'
  | 'adventure_bucket';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>(() => {
    const savedUserId = localStorage.getItem('ulfah_userId');
    return savedUserId ? 'home' : 'login';
  });
  const [userId, setUserId] = useState<string>(() => {
    return localStorage.getItem('ulfah_userId') || '';
  });
  const [partnershipId, setPartnershipId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (userId) {
      localStorage.setItem('ulfah_userId', userId);
      loadPartnershipId();
    } else {
      localStorage.removeItem('ulfah_userId');
    }
  }, [userId]);

  const loadPartnershipId = async () => {
    if (!userId) return;
    try {
      const { data: partnership } = await supabase
        .from('partnerships')
        .select('id')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .eq('is_active', true)
        .maybeSingle();

      if (partnership) {
        setPartnershipId(partnership.id);
      }
    } catch (err) {
      console.error('Error loading partnership:', err);
    }
  };

  const handleLogin = (id: string) => {
    setUserId(id);
    setCurrentScreen('home');
  };

  const handleSignup = (id: string) => {
    setUserId(id);
    setCurrentScreen('home');
  };

  const handleNavigate = (screen: string) => {
    setCurrentScreen(screen as Screen);
  };

  const handleLogout = () => {
    localStorage.removeItem('ulfah_userId');
    setUserId('');
    setPartnershipId(null);
    setCurrentScreen('login');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return <HomeScreen onNavigate={handleNavigate} userId={userId} partnershipId={partnershipId} isDarkMode={isDarkMode} />;
      case 'calendar':
        return <CalendarScreen onNavigate={handleNavigate} userId={userId} partnershipId={partnershipId} isDarkMode={isDarkMode} />;
      case 'games':
        return <GamesScreen onNavigate={handleNavigate} isDarkMode={isDarkMode} userId={userId} />;
      case 'commitments':
        return <CommitmentsScreen onBack={() => handleNavigate('home')} userId={userId} partnershipId={partnershipId} isDarkMode={isDarkMode} />;
      case 'settings':
        return (
          <SettingsScreen
            onNavigate={handleNavigate}
            userId={userId}
            partnershipId={partnershipId}
            onLogout={handleLogout}
            onPartnershipCreated={loadPartnershipId}
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          />
        );
      case 'dialogues':
        return <DialogueScreen onBack={() => handleNavigate('home')} userId={userId} partnershipId={partnershipId} isDarkMode={isDarkMode} />;
      case 'love_notes':
        return <LoveNotesScreen onNavigate={handleNavigate} userId={userId} partnershipId={partnershipId} isDarkMode={isDarkMode} />;
      case 'finance':
        return <FinanceScreen onNavigate={handleNavigate} userId={userId} partnershipId={partnershipId} isDarkMode={isDarkMode} />;
      case 'adventure_bucket':
        return <AdventureBucketScreen onNavigate={handleNavigate} userId={userId} partnershipId={partnershipId} />;
      default:
        return <HomeScreen onNavigate={handleNavigate} userId={userId} partnershipId={partnershipId} isDarkMode={isDarkMode} />;
    }
  };

  const renderLoggedOut = () => {
    if (currentScreen === 'signup') {
      return <AuthSignup onSignup={handleSignup} onNavigateToLogin={() => setCurrentScreen('login')} isDarkMode={isDarkMode} />;
    }
    return <AuthLogin onLogin={handleLogin} onNavigateToSignup={() => setCurrentScreen('signup')} isDarkMode={isDarkMode} />;
  };

  return (
    <div className={`min-h-screen bg-background mesh-gradient flex justify-center font-sans text-foreground antialiased selection:bg-mood-home/20 relative overflow-hidden ${isDarkMode ? 'dark' : ''}`}>
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-mood-adventure/10 rounded-full blur-[120px] animate-float-delayed" />
        <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] bg-mood-love/10 rounded-full blur-[100px] animate-float-slow" />
      </div>

      <div className="w-full max-w-[480px] bg-background/60 backdrop-blur-xl h-screen relative border-x border-border/20 overflow-hidden flex flex-col z-10 transition-all duration-300 shadow-2xl">
        {!userId ? (
          <div className="flex-1 flex flex-col">
            {renderLoggedOut()}
          </div>
        ) : (
          <>
            <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide pb-safe">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentScreen}
                  initial={{ opacity: 0, scale: 0.99, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.01, y: -10 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="min-h-full flex flex-col"
                >
                  {renderScreen()}
                </motion.div>
              </AnimatePresence>
            </main>

            {['home', 'calendar', 'commitments', 'dialogues', 'finance', 'games', 'love_notes', 'adventure_bucket'].includes(currentScreen) && (
              <footer className="shrink-0 bg-background/80 backdrop-blur-3xl border-t border-border/50 z-50">
                <BottomNav currentScreen={currentScreen} onNavigate={handleNavigate} />
              </footer>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;