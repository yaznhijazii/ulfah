import { useState, useEffect } from 'react';
import { AuthLogin } from './components/AuthLogin';
import { AuthSignup } from './components/AuthSignup';
import { HomeScreen } from './components/HomeScreen';
import { MemoriesScreen } from './components/MemoriesScreen';
import { CalendarScreen } from './components/CalendarScreen';
import { TravelScreen } from './components/TravelScreen';
import { GamesScreen } from './components/GamesScreen';
import { PromisesScreen } from './components/PromisesScreen';
import { CommitmentsScreen } from './components/CommitmentsScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { supabase } from '../lib/supabase';

type Screen =
  | 'login'
  | 'signup'
  | 'home'
  | 'memories'
  | 'calendar'
  | 'travel'
  | 'games'
  | 'promises'
  | 'commitments'
  | 'settings';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [userId, setUserId] = useState<string>('');
  const [partnershipId, setPartnershipId] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      loadPartnershipId();
    }
  }, [userId]);

  const loadPartnershipId = async () => {
    try {
      const { data: partnership } = await supabase
        .from('partnerships')
        .select('id')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .eq('is_active', true)
        .single();

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
    setUserId('');
    setPartnershipId(null);
    setCurrentScreen('login');
  };

  return (
    <div className="min-h-screen">
      {currentScreen === 'login' && (
        <AuthLogin onLogin={handleLogin} onNavigateToSignup={() => setCurrentScreen('signup')} />
      )}
      {currentScreen === 'signup' && (
        <AuthSignup onSignup={handleSignup} onNavigateToLogin={() => setCurrentScreen('login')} />
      )}
      {currentScreen === 'home' && <HomeScreen onNavigate={handleNavigate} userId={userId} />}
      {currentScreen === 'memories' && <MemoriesScreen onNavigate={handleNavigate} userId={userId} partnershipId={partnershipId} />}
      {currentScreen === 'calendar' && <CalendarScreen onNavigate={handleNavigate} userId={userId} partnershipId={partnershipId} />}
      {currentScreen === 'travel' && <TravelScreen onNavigate={handleNavigate} />}
      {currentScreen === 'games' && <GamesScreen onNavigate={handleNavigate} />}
      {currentScreen === 'promises' && <PromisesScreen onNavigate={handleNavigate} userId={userId} partnershipId={partnershipId} />}
      {currentScreen === 'commitments' && <CommitmentsScreen onBack={() => handleNavigate('home')} userId={userId} partnershipId={partnershipId} />}
      {currentScreen === 'settings' && <SettingsScreen onNavigate={handleNavigate} userId={userId} onLogout={handleLogout} onPartnershipCreated={loadPartnershipId} />}
    </div>
  );
}

export default App;