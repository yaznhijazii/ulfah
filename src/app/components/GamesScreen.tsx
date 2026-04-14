import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Search, ChevronRight, Gamepad2, Brain, Binary, Zap, Image, Split, Radio, Bomb, X, Trophy, Heart, Sparkles, Flame, Star } from 'lucide-react';
import { Button } from './ui/button';
import { BoomBoomGame } from './BoomBoomGame';
import { WordGuessGame } from './WordGuessGame';
import { NumberGuessGame } from './NumberGuessGame';
import { MindSyncGame } from './MindSyncGame';
import { MemoryMapGame } from './MemoryMapGame';
import { WouldYouRatherGame } from './WouldYouRatherGame';
import { RadarHuntGame } from './RadarHuntGame';
import { supabase } from '../../lib/supabase';

interface GamesScreenProps {
  onNavigate: (screen: string) => void;
  isDarkMode?: boolean;
  userId: string;
  partnershipId: string | null;
}

const ALL_GAMES = [
  { id: 'mind-sync', title: 'تزامن الأرواح', desc: 'هل تفكران بنفس الشيء؟', icon: Zap, category: 'connection', badge: 'NEW', color: 'rose', colorHex: 'text-rose-500', bgHex: 'bg-rose-500/10' },
  { id: 'would-you-rather', title: 'لو كنت مكاني', desc: 'تخمين القرارات الصعبة', icon: Split, category: 'connection', badge: 'HOT', color: 'blue', colorHex: 'text-blue-500', bgHex: 'bg-blue-500/10' },
  { id: 'memory-map', title: 'خريطة الذكريات', desc: 'رحلة في أغلى اللحظات', icon: Image, category: 'connection', color: 'purple', colorHex: 'text-purple-500', bgHex: 'bg-purple-500/10' },
  { id: 'word-guess', title: 'لعبة الكلمة', desc: 'ذكاء وتواصل ممتع', icon: Brain, category: 'intelligence', color: 'teal', colorHex: 'text-teal-500', bgHex: 'bg-teal-500/10' },
  { id: 'number-guess', title: 'احزر الرقم', desc: 'تحدي الأرقام السريعة', icon: Binary, category: 'intelligence', color: 'amber', colorHex: 'text-amber-500', bgHex: 'bg-amber-500/10' },
  { id: 'radar-hunt', title: 'الرادار', desc: 'تتبع الأهداف سراً', icon: Radio, category: 'adventure', color: 'emerald', colorHex: 'text-emerald-500', bgHex: 'bg-emerald-500/10' },
  { id: 'boom-boom', title: 'بوم بوم', desc: 'تكتيك ومناورة ذكية', icon: Bomb, category: 'intelligence', color: 'indigo', colorHex: 'text-indigo-500', bgHex: 'bg-indigo-500/10' },
];

const CATEGORIES = [
  { id: 'connection', title: 'اتصال وفهم', icon: Heart },
  { id: 'intelligence', title: 'ذكاء وتحدي', icon: Brain },
  { id: 'adventure', title: 'مغامرة واكتشاف', icon: Star },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100
    }
  }
};

export function GamesScreen({ onNavigate, isDarkMode, userId, partnershipId }: GamesScreenProps) {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    if (userId) {
      supabase.from('users').select('name').eq('id', userId).single().then(({ data }) => {
        if (data) setUserName(data.name);
      });
    }
  }, [userId]);

  const filteredGames = useMemo(() => {
    return ALL_GAMES.filter(game => {
      const matchesSearch = game.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             game.desc.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === 'all' || game.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, activeCategory]);

  return (
    <div className="flex-1 bg-background flex flex-col relative overflow-hidden h-full mood-games">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .glass-premium {
          background: rgba(255, 255, 255, 0.4);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);
        }
        .dark .glass-premium {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
      `}</style>

      {/* Playful Floating Auras */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
          className="absolute top-[-10%] right-[-10%] w-[100%] h-[70%] bg-purple-500/5 blur-[120px] rounded-full" 
        />
        <motion.div 
          animate={{ scale: [1.2, 1, 1.2], rotate: [90, 0, 90] }}
          transition={{ duration: 15, repeat: Infinity }}
          className="absolute bottom-[-10%] left-[-10%] w-[80%] h-[60%] bg-rose-500/5 blur-[120px] rounded-full" 
        />
      </div>

      <header className="px-8 pt-8 pb-4 flex flex-col gap-6 sticky top-0 bg-background/20 backdrop-blur-3xl z-40">
        <div className="flex items-center justify-between">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => selectedGame !== null ? setSelectedGame(null) : onNavigate('home')}
            className="w-12 h-12 flex items-center justify-center glass-premium rounded-2xl shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-foreground/60" />
          </motion.button>
          
          <div className="flex flex-col items-center">
            <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
              {selectedGame ? ALL_GAMES.find(g => g.id === selectedGame)?.title : 'مرفأ الألعاب'}
              {!selectedGame && <Sparkles className="w-5 h-5 text-purple-500 animate-pulse" />}
            </h1>
            {!selectedGame && <div className="h-1 w-8 bg-purple-500/20 rounded-full mt-1" />}
          </div>

          <motion.div 
            whileHover={{ scale: 1.1, rotate: 5 }}
            className="w-12 h-12 flex items-center justify-center glass-premium rounded-2xl text-purple-500"
          >
            <Trophy className="w-6 h-6" />
          </motion.div>
        </div>

        {selectedGame === null && (
          <div className="space-y-4">
            <div className="relative">
              <input 
                type="text"
                placeholder="عن أي تحدٍ تبحث؟"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 rounded-2xl h-14 pl-12 pr-12 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500/20 transition-all text-right shadow-sm"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40" />
              {searchTerm && <X onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 cursor-pointer" />}
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              <button 
                onClick={() => setActiveCategory('all')}
                className={`flex-shrink-0 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${activeCategory === 'all' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-white/50 border border-white text-muted-foreground hover:bg-white/80'}`}
              >
                الكل
              </button>
              {CATEGORIES.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex-shrink-0 px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${activeCategory === cat.id ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-white/50 border border-white text-muted-foreground hover:bg-white/80'}`}
                >
                  <cat.icon className="w-3.5 h-3.5" />
                  {cat.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {selectedGame === null ? (
            <motion.div
              key="list"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 overflow-y-auto px-8 pt-4 pb-32 no-scrollbar"
            >
              <div className="grid grid-cols-2 gap-5">
                {/* HERO GAME: MIND SYNC (Full Width) */}
                {!searchTerm && activeCategory === 'all' && (
                  <motion.div variants={itemVariants} className="col-span-2">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedGame('mind-sync')}
                      className="w-full h-60 rounded-[3.5rem] bg-gradient-to-br from-rose-500 to-indigo-600 p-10 flex flex-col justify-between text-right relative overflow-hidden shadow-2xl shadow-rose-500/20 text-white group"
                    >
                      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
                      <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/20 rounded-full blur-[60px]" />
                      <Zap className="absolute left-10 bottom-10 w-32 h-32 text-white/10 group-hover:scale-110 transition-transform duration-1000" />
                      
                      <div className="relative z-10">
                        <div className="flex items-center justify-end gap-3 mb-4">
                           <span className="bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest">تزامن الأرواح</span>
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        </div>
                        <h2 className="text-4xl font-black leading-tight">تحدي النبض</h2>
                        <p className="text-sm font-bold opacity-80 mt-3 max-w-[200px]">هل تستطيعان التفكير كقلب واحد في هذه اللحظة؟</p>
                      </div>
                      
                      <div className="bg-white text-rose-600 self-end px-8 py-3 rounded-2xl text-xs font-black shadow-xl group-hover:bg-rose-50 transition-colors">
                         ابدأ اللعبة
                      </div>
                    </motion.button>
                  </motion.div>
                )}

                {/* FILTERED GAMES BENTO GRID */}
                {filteredGames.filter(g => g.id !== 'mind-sync' || searchTerm).map((game, idx) => {
                  const isWide = game.id === 'radar-hunt' || game.id === 'memory-map';
                  return (
                    <motion.button
                      key={game.id}
                      variants={itemVariants}
                      whileHover={{ y: -5 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedGame(game.id)}
                      className={`${isWide ? 'col-span-2 h-44' : 'col-span-1 h-56'} glass-premium rounded-[2.8rem] p-8 flex ${isWide ? 'flex-row items-center justify-between' : 'flex-col justify-between items-end'} text-right relative overflow-hidden group border-white/60 dark:border-white/5 shadow-xl`}
                    >
                      <div className={`absolute top-0 ${isWide ? 'right-0' : 'left-0'} w-24 h-24 ${game.bgHex} rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition-opacity`} />
                      
                      <div className={`${game.bgHex} ${game.colorHex} w-16 h-16 rounded-[1.8rem] flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform duration-500`}>
                        <game.icon className="w-8 h-8" />
                      </div>

                      <div className={`${isWide ? 'flex-1 pr-6' : ''}`}>
                        <div className="flex items-center justify-end gap-3 mb-1">
                          <h4 className="text-xl font-black text-foreground tracking-tight">{game.title}</h4>
                          {game.badge && (
                            <span className="bg-rose-500 text-white text-[8px] font-black px-2 py-0.5 rounded-lg">{game.badge}</span>
                          )}
                        </div>
                        <p className="text-[11px] font-bold text-muted-foreground/50 leading-relaxed">{game.desc}</p>
                      </div>

                      {isWide && (
                        <div className="w-12 h-12 rounded-2xl glass-premium flex items-center justify-center text-foreground/20 group-hover:text-rose-500 transition-colors">
                           <ChevronRight className="w-6 h-6" />
                        </div>
                      )}
                    </motion.button>
                  );
                })}

                {filteredGames.length === 0 && (
                  <div className="col-span-2 text-center py-24 opacity-20">
                    <Gamepad2 size={64} className="mx-auto mb-6" />
                    <p className="font-black text-lg">لم نجد أي تحديات بهذه المزايا</p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="game"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0 overflow-hidden"
            >
              {selectedGame === 'mind-sync' ? (
                <MindSyncGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName} partnershipId={partnershipId} />
              ) : selectedGame === 'memory-map' ? (
                <MemoryMapGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName} partnershipId={partnershipId} />
              ) : selectedGame === 'would-you-rather' ? (
                <WouldYouRatherGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName} partnershipId={partnershipId} />
              ) : selectedGame === 'radar-hunt' ? (
                <RadarHuntGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName} partnershipId={partnershipId} />
              ) : selectedGame === 'number-guess' ? (
                <NumberGuessGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName} partnershipId={partnershipId} />
              ) : selectedGame === 'boom-boom' ? (
                <BoomBoomGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName || 'اللاعب'} />
              ) : (
                <WordGuessGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName || 'اللاعب'} partnershipId={partnershipId} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div >
  );
}


