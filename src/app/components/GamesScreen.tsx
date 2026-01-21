import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Heart, Sparkles, User, Clock, ChevronRight, CheckCircle, Bomb, Crown, Gamepad2 } from 'lucide-react';
import { Button } from './ui/button';
import { BoomBoomGame } from './BoomBoomGame';
import { ChessGame } from './ChessGame';
import { supabase } from '../../lib/supabase';

interface GamesScreenProps {
  onNavigate: (screen: string) => void;
  isDarkMode?: boolean;
  userId: string;
}

export function GamesScreen({ onNavigate, isDarkMode, userId }: GamesScreenProps) {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [userName, setUserName] = useState('');

  // Fetch user name for games
  useEffect(() => {
    if (userId) {
      supabase.from('users').select('name').eq('id', userId).single().then(({ data }) => {
        if (data) setUserName(data.name);
      });
    }
  }, [userId]);

  return (
    <div className="flex-1 bg-background flex flex-col relative overflow-hidden h-full mood-games">
      {/* Playful Purple Aura */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-[-10%] right-[-10%] w-[100%] h-[70%] bg-purple-500/10 blur-[150px] rounded-full opacity-60" />
      </div>

      <header className="px-8 pt-10 pb-4 flex items-center justify-between sticky top-0 bg-background/40 backdrop-blur-3xl z-30">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => selectedGame !== null ? setSelectedGame(null) : onNavigate('home')}
          className="w-12 h-12 flex items-center justify-center glass rounded-2xl border-white/60 shadow-xl"
        >
          <ArrowLeft className="w-5 h-5 text-foreground/40" />
        </motion.button>
        <div className="text-center">
          <h1 className="text-xl font-black text-foreground tracking-tighter">
            {selectedGame === 'boom-boom' ? 'بوم بوم' : selectedGame === 'chess' ? 'الشطرنج' : 'مرفأ الألعاب'}
          </h1>
          <p className="text-[9px] font-black text-purple-600/40 uppercase tracking-[0.4em]">منافسة بكل حب</p>
        </div>
        <div className="w-12 h-12 flex items-center justify-center glass rounded-2xl border-white/60 text-purple-500 shadow-xl">
          <Gamepad2 className="w-6 h-6" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-8 pb-40 space-y-12">
        <AnimatePresence mode="wait">
          {selectedGame === null ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-10"
            >
              <section className="space-y-6">
                <div className="px-2">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50">تحديات ثنائية</h3>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <motion.button
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedGame('boom-boom')}
                    className="glass rounded-[2rem] p-6 flex items-center justify-between border-white/20 group overflow-hidden relative"
                  >
                    <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                      <Bomb className="w-24 h-24 text-indigo-500" />
                    </div>

                    <div className="flex items-center gap-5 relative z-10 text-right">
                      <div className="w-14 h-14 bg-indigo-500/10 rounded-[1.5rem] flex items-center justify-center text-indigo-500 group-hover:shadow-lg group-hover:shadow-indigo-500/20 transition-all">
                        <Bomb className="w-6 h-6" />
                      </div>
                      <div className="text-right">
                        <h4 className="text-lg font-black text-foreground mb-1">بوم بوم</h4>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">تحدي الذكاء والمناورة</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:translate-x-[-4px] transition-transform" />
                  </motion.button>

                  <motion.button
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedGame('chess')}
                    className="glass rounded-[2rem] p-6 flex items-center justify-between border-white/20 group overflow-hidden relative"
                  >
                    <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                      <Crown className="w-24 h-24 text-amber-500" />
                    </div>

                    <div className="flex items-center gap-5 relative z-10 text-right">
                      <div className="w-14 h-14 bg-amber-500/10 rounded-[1.5rem] flex items-center justify-center text-amber-500 group-hover:shadow-lg group-hover:shadow-amber-500/20 transition-all">
                        <Crown className="w-6 h-6" />
                      </div>
                      <div className="text-right">
                        <h4 className="text-lg font-black text-foreground mb-1">الشطرنج</h4>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">تحدي الملوك الراقي</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:translate-x-[-4px] transition-transform" />
                  </motion.button>
                </div>
              </section>
            </motion.div>
          ) : selectedGame === 'chess' ? (
            <ChessGame
              onBack={() => setSelectedGame(null)}
              userId={userId}
              userName={userName}
            />
          ) : (
            <BoomBoomGame
              onBack={() => setSelectedGame(null)}
              userId={userId}
              userName={userName || 'اللاعب'}
            />
          )}
        </AnimatePresence>
      </div>
    </div >
  );
}
