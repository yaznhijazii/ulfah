import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Search, Gamepad2, Brain, Binary,
  Zap, Image as ImageIcon, Bomb, X,
  Trophy, Heart, Star, Play, ChevronLeft, HelpCircle, UserCircle, Smile
} from 'lucide-react';
import { BoomBoomGame } from './BoomBoomGame';
import { WordGuessGame } from './WordGuessGame';
import { NumberGuessGame } from './NumberGuessGame';
import { MindSyncGame } from './MindSyncGame';
import { MemoryMapGame } from './MemoryMapGame';
import { PartnerPredictGame } from './PartnerPredictGame';
import { IfIWereYouGame } from './IfIWereYouGame';
import { EmojiMoodGame } from './EmojiMoodGame';
import { supabase } from '../../lib/supabase';

interface GamesScreenProps {
  onNavigate: (screen: string) => void;
  isDarkMode?: boolean;
  userId: string;
  partnershipId: string | null;
}

const ALL_GAMES = [
  {
    id: 'mind-sync',
    title: 'تزامن الأرواح',
    desc: 'هل تفكران بنفس الشيء الآن؟',
    icon: Zap,
    category: 'connection',
    badge: 'الأكثر لعباً',
    gradient: 'from-rose-500 via-pink-500 to-violet-600',
    iconGradient: 'from-rose-400 to-violet-600',
    glowColor: 'rgba(244,63,94,0.4)',
    accentClass: 'text-rose-500',
    bgAccent: 'bg-rose-500/8',
  },
  {
    id: 'partner-predict',
    title: 'ماذا يختار شريكك؟',
    desc: 'خمّن اختياره في مواقف صعبة',
    icon: HelpCircle,
    category: 'connection',
    badge: 'جديد',
    gradient: 'from-violet-500 to-fuchsia-600',
    iconGradient: 'from-violet-400 to-fuchsia-600',
    glowColor: 'rgba(139,92,246,0.35)',
    accentClass: 'text-violet-500',
    bgAccent: 'bg-violet-500/8',
  },
  {
    id: 'if-i-were-you',
    title: 'لو كنت مكاني',
    desc: 'موقف واحد وردّ بصراحة',
    icon: UserCircle,
    category: 'connection',
    badge: '💬',
    gradient: 'from-sky-500 to-blue-600',
    iconGradient: 'from-sky-400 to-blue-600',
    glowColor: 'rgba(14,165,233,0.35)',
    accentClass: 'text-sky-500',
    bgAccent: 'bg-sky-500/8',
  },
  {
    id: 'emoji-mood',
    title: 'إيموجي مزاج',
    desc: 'بالدور: إيموجي بلا حدّ والثاني يفسّر',
    icon: Smile,
    category: 'connection',
    badge: '😊',
    gradient: 'from-amber-400 to-orange-500',
    iconGradient: 'from-amber-400 to-orange-500',
    glowColor: 'rgba(245,158,11,0.38)',
    accentClass: 'text-amber-600',
    bgAccent: 'bg-amber-500/8',
  },
  {
    id: 'memory-map',
    title: 'خريطة الذكريات',
    desc: 'رحلة في أغلى اللحظات',
    icon: ImageIcon,
    category: 'connection',
    gradient: 'from-violet-500 to-purple-700',
    iconGradient: 'from-violet-400 to-purple-700',
    glowColor: 'rgba(139,92,246,0.35)',
    accentClass: 'text-violet-500',
    bgAccent: 'bg-violet-500/8',
  },
  {
    id: 'word-guess',
    title: 'لعبة الكلمة',
    desc: 'ذكاء وتواصل ممتع',
    icon: Brain,
    category: 'intelligence',
    gradient: 'from-teal-400 to-emerald-600',
    iconGradient: 'from-teal-400 to-emerald-600',
    glowColor: 'rgba(20,184,166,0.35)',
    accentClass: 'text-teal-500',
    bgAccent: 'bg-teal-500/8',
  },
  {
    id: 'number-guess',
    title: 'احزر الرقم',
    desc: 'تحدي الأرقام السريعة',
    icon: Binary,
    category: 'intelligence',
    gradient: 'from-amber-400 to-orange-600',
    iconGradient: 'from-amber-400 to-orange-500',
    glowColor: 'rgba(245,158,11,0.35)',
    accentClass: 'text-amber-500',
    bgAccent: 'bg-amber-500/8',
  },
  {
    id: 'boom-boom',
    title: 'بوم بوم',
    desc: 'تكتيك ومناورة ذكية',
    icon: Bomb,
    category: 'intelligence',
    gradient: 'from-indigo-500 to-violet-700',
    iconGradient: 'from-indigo-400 to-violet-600',
    glowColor: 'rgba(99,102,241,0.35)',
    accentClass: 'text-indigo-500',
    bgAccent: 'bg-indigo-500/8',
  },
];

const CATEGORIES = [
  { id: 'all',          title: 'الكل',            icon: Gamepad2 },
  { id: 'connection',   title: 'تواصل وفهم',       icon: Heart    },
  { id: 'intelligence', title: 'ذكاء وتحدي',       icon: Brain    },
  { id: 'adventure',    title: 'مغامرة',            icon: Star     },
];

// Staggered particle positions for hero card animation
const PARTICLES = [
  { x: '12%',  y: '25%', size: 6,  delay: 0 },
  { x: '28%',  y: '60%', size: 4,  delay: 0.4 },
  { x: '45%',  y: '18%', size: 5,  delay: 0.8 },
  { x: '62%',  y: '72%', size: 3,  delay: 0.2 },
  { x: '78%',  y: '35%', size: 6,  delay: 1.0 },
  { x: '88%',  y: '80%', size: 4,  delay: 0.6 },
];

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
      const matchesSearch =
        game.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        game.desc.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === 'all' || game.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, activeCategory]);

  // Show mind-sync as hero only when browsing "all" with no search
  const showHero = !searchTerm && activeCategory === 'all';
  const heroGame = ALL_GAMES[0]; // mind-sync
  const gridGames = filteredGames.filter(g => !showHero || g.id !== 'mind-sync');

  return (
    <div dir="rtl" className="flex-1 bg-[#f7f6ff] dark:bg-[#08060f] flex flex-col relative overflow-hidden h-full">

      {/* ─── Ambient Background ─── */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.18, 0.28, 0.18] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-1/3 -right-1/4 w-[90%] h-[80%] bg-violet-500/20 dark:bg-violet-600/15 rounded-full blur-[130px]"
        />
        <motion.div
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.12, 0.22, 0.12] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-1/3 -left-1/4 w-[80%] h-[70%] bg-rose-500/15 dark:bg-rose-600/10 rounded-full blur-[120px]"
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] bg-indigo-500/10 dark:bg-indigo-500/8 rounded-full blur-[100px]" />
      </div>

      {/* ─── Header ─── */}
      <header className="px-6 pt-10 pb-5 sticky top-0 bg-[#f7f6ff]/70 dark:bg-[#08060f]/70 backdrop-blur-2xl z-40 border-b border-violet-900/5 dark:border-white/5">

        {/* Top row */}
        <div className="flex items-center justify-between mb-5">
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => selectedGame !== null ? setSelectedGame(null) : onNavigate('home')}
            className="w-11 h-11 flex items-center justify-center bg-black/5 dark:bg-white/7 rounded-[1.1rem] border border-black/5 dark:border-white/8"
          >
            <ArrowLeft className="w-5 h-5 text-foreground/50" />
          </motion.button>

          <div className="text-center flex flex-col items-center">
            <h1 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
              {selectedGame
                ? ALL_GAMES.find(g => g.id === selectedGame)?.title
                : (
                  <>
                    مرفأ الألعاب
                    <motion.span
                      animate={{ rotate: [0, 12, -8, 0] }}
                      transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                      className="inline-block"
                    >
                      🎮
                    </motion.span>
                  </>
                )}
            </h1>
            {!selectedGame && (
              <p className="text-[10px] font-bold text-violet-500/60 dark:text-violet-400/50 uppercase tracking-[0.3em] mt-0.5">
                {ALL_GAMES.length} ألعاب معاً
              </p>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.08, rotate: 5 }}
            whileTap={{ scale: 0.92 }}
            className="w-11 h-11 flex items-center justify-center bg-amber-500/10 dark:bg-amber-500/8 rounded-[1.1rem] border border-amber-500/15"
          >
            <Trophy className="w-5 h-5 text-amber-500" />
          </motion.button>
        </div>

        {/* Search + Categories */}
        {selectedGame === null && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث عن تحدٍ..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                dir="rtl"
                className="w-full h-12 bg-white/60 dark:bg-white/5 border border-black/6 dark:border-white/8 rounded-[1.2rem] px-5 pl-12 text-sm font-bold outline-none focus:ring-2 focus:ring-violet-500/25 transition-all placeholder:text-muted-foreground/30 text-right"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
              <AnimatePresence>
                {searchTerm && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    onClick={() => setSearchTerm('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center bg-black/10 dark:bg-white/15 rounded-full"
                  >
                    <X className="w-3 h-3 text-foreground/50" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Category Chips */}
            <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              {CATEGORIES.map(cat => {
                const active = activeCategory === cat.id;
                return (
                  <motion.button
                    key={cat.id}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-[1rem] text-[11px] font-black transition-all duration-300 ${
                      active
                        ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25'
                        : 'bg-white/60 dark:bg-white/5 border border-black/6 dark:border-white/8 text-muted-foreground hover:bg-white/90 dark:hover:bg-white/10'
                    }`}
                  >
                    <cat.icon className="w-3 h-3" />
                    {cat.title}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </header>

      {/* ─── Content ─── */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">

          {/* ── Games List ── */}
          {selectedGame === null ? (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 overflow-y-auto px-5 pt-5 pb-36"
              style={{ scrollbarWidth: 'none' }}
            >
              <div className="grid grid-cols-2 gap-4">

                {/* ═══ HERO CARD (Mind Sync) ═══ */}
                {showHero && (
                  <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 80, damping: 15 }}
                    className="col-span-2"
                  >
                    <motion.button
                      whileTap={{ scale: 0.975 }}
                      onClick={() => setSelectedGame('mind-sync')}
                      className="w-full h-[230px] rounded-[2.8rem] relative overflow-hidden group shadow-2xl shadow-rose-500/20 text-right"
                    >
                      {/* Gradient BG */}
                      <div className="absolute inset-0 bg-gradient-to-br from-rose-500 via-fuchsia-600 to-violet-700" />

                      {/* Sheen overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/10" />

                      {/* Animated orbs */}
                      <motion.div
                        animate={{ scale: [1, 1.4, 1], opacity: [0.25, 0.45, 0.25] }}
                        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute -top-12 -right-12 w-52 h-52 bg-white/20 rounded-full blur-3xl pointer-events-none"
                      />
                      <motion.div
                        animate={{ scale: [1.2, 1, 1.2], opacity: [0.15, 0.3, 0.15] }}
                        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute -bottom-16 -left-8 w-56 h-56 bg-rose-300/30 rounded-full blur-3xl pointer-events-none"
                      />

                      {/* Floating particles */}
                      <div className="absolute inset-0 pointer-events-none">
                        {PARTICLES.map((p, i) => (
                          <motion.div
                            key={i}
                            animate={{ y: [0, -14, 0], opacity: [0.25, 0.7, 0.25] }}
                            transition={{ duration: 2.5 + i * 0.4, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
                            className="absolute bg-white rounded-full"
                            style={{ left: p.x, top: p.y, width: p.size, height: p.size }}
                          />
                        ))}
                      </div>

                      {/* Content */}
                      <div className="absolute inset-0 p-7 flex flex-col justify-between relative z-10">

                        {/* Top row */}
                        <div className="flex items-start justify-between">
                          <span className="bg-white/20 backdrop-blur-md border border-white/25 px-3 py-1.5 rounded-2xl text-[9px] font-black uppercase tracking-widest text-white">
                            ⚡ {heroGame.badge}
                          </span>
                          <motion.div
                            animate={{ rotate: [0, 18, -10, 0] }}
                            transition={{ duration: 4, repeat: Infinity, repeatDelay: 1 }}
                            className="w-[3.5rem] h-[3.5rem] bg-white/20 backdrop-blur-md rounded-[1.3rem] flex items-center justify-center border border-white/30 shadow-inner"
                          >
                            <Zap className="w-7 h-7 text-white fill-white/40" />
                          </motion.div>
                        </div>

                        {/* Bottom row */}
                        <div>
                          <h2 className="text-[2rem] font-black text-white leading-tight tracking-tight">
                            {heroGame.title}
                          </h2>
                          <p className="text-sm font-bold text-white/70 mt-1 mb-5">
                            {heroGame.desc}
                          </p>
                          <div className="flex items-center justify-end">
                            <motion.div
                              whileHover={{ gap: '12px' }}
                              className="flex items-center gap-2 bg-white text-violet-600 px-6 py-2.5 rounded-[1.1rem] text-xs font-black shadow-xl group-hover:bg-violet-50 transition-all"
                            >
                              ابدأ التحدي
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </motion.div>
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  </motion.div>
                )}

                {/* ═══ GAME CARDS ═══ */}
                {gridGames.map((game, idx) => {
                  const isWide = game.id === 'boom-boom';

                  return (
                    <motion.button
                      key={game.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: 0.06 * idx, type: 'spring', stiffness: 90, damping: 16 } }}
                      whileHover={{ y: -5, scale: 1.015 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setSelectedGame(game.id)}
                      className={`${isWide ? 'col-span-2 h-[130px]' : 'col-span-1 h-[195px]'} relative rounded-[2.2rem] overflow-hidden text-right bg-white dark:bg-white/[0.035] border border-black/5 dark:border-white/7 shadow-lg shadow-black/4 dark:shadow-black/30 group`}
                    >
                      {/* Gradient tint BG */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${game.gradient} opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500`} />

                      {/* Accent glow blob */}
                      <div
                        className={`absolute ${isWide ? 'top-0 right-0 w-28 h-28' : 'top-0 left-0 w-32 h-32'} bg-gradient-to-br ${game.gradient} opacity-15 blur-3xl rounded-full group-hover:opacity-25 transition-opacity duration-500 pointer-events-none`}
                      />

                      {isWide ? (
                        /* ── Wide layout ── */
                        <div className="absolute inset-0 px-6 flex items-center gap-5">
                          {/* Icon */}
                          <motion.div
                            whileHover={{ rotate: 8, scale: 1.08 }}
                            className={`w-[3.5rem] h-[3.5rem] rounded-[1.2rem] bg-gradient-to-br ${game.iconGradient} flex items-center justify-center shadow-lg flex-shrink-0`}
                            style={{ boxShadow: `0 8px 24px ${game.glowColor}` }}
                          >
                            <game.icon className="w-[1.5rem] h-[1.5rem] text-white" />
                          </motion.div>

                          {/* Text */}
                          <div className="flex-1 text-right">
                            <div className="flex items-center justify-end gap-2 mb-1">
                              {game.badge && (
                                <span className="text-[8px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-lg">
                                  {game.badge}
                                </span>
                              )}
                              <h4 className="text-base font-black text-foreground">{game.title}</h4>
                            </div>
                            <p className="text-[11px] font-bold text-muted-foreground/50">{game.desc}</p>
                          </div>

                          {/* Arrow */}
                          <div className={`w-9 h-9 rounded-[0.9rem] bg-gradient-to-br ${game.iconGradient} flex items-center justify-center flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity shadow-md`}>
                            <ChevronLeft className="w-4 h-4 text-white" />
                          </div>
                        </div>

                      ) : (
                        /* ── Square layout ── */
                        <div className="absolute inset-0 p-5 flex flex-col justify-between">

                          {/* Icon top-left (end in RTL) */}
                          <div className="flex justify-end">
                            <motion.div
                              whileHover={{ rotate: 10, scale: 1.1 }}
                              transition={{ type: 'spring', stiffness: 250, damping: 15 }}
                              className={`w-[3.5rem] h-[3.5rem] rounded-[1.2rem] bg-gradient-to-br ${game.iconGradient} flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-500`}
                              style={{ boxShadow: `0 8px 24px ${game.glowColor}` }}
                            >
                              <game.icon className="w-6 h-6 text-white" />
                            </motion.div>
                          </div>

                          {/* Bottom text */}
                          <div>
                            {game.badge && (
                              <motion.span
                                initial={{ opacity: 0.8 }}
                                whileHover={{ scale: 1.05 }}
                                className="inline-block mb-2 text-[8px] font-black bg-rose-500 text-white px-2.5 py-0.5 rounded-[0.5rem]"
                              >
                                {game.badge}
                              </motion.span>
                            )}
                            <h4 className="text-[1.05rem] font-black text-foreground leading-tight mb-1 tracking-tight">
                              {game.title}
                            </h4>
                            <p className="text-[10.5px] font-bold text-muted-foreground/45 leading-relaxed">
                              {game.desc}
                            </p>
                          </div>

                          {/* Play indicator */}
                          <div className="flex justify-start">
                            <div className={`flex items-center gap-1 ${game.accentClass} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}>
                              <Play className="w-3 h-3 fill-current" />
                              <span className="text-[10px] font-black">العب الآن</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.button>
                  );
                })}

                {/* ── Empty state ── */}
                {filteredGames.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="col-span-2 flex flex-col items-center justify-center py-24 text-center"
                  >
                    <div className="w-20 h-20 rounded-3xl bg-violet-500/10 flex items-center justify-center mb-5">
                      <Gamepad2 className="w-10 h-10 text-violet-400/40" />
                    </div>
                    <p className="font-black text-foreground/25 text-lg">لا توجد نتائج</p>
                    <p className="text-sm text-muted-foreground/25 mt-1.5">جرب كلمة مختلفة</p>
                  </motion.div>
                )}

              </div>
            </motion.div>

          ) : (
            /* ── Active Game ── */
            <motion.div
              key="game"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 overflow-hidden"
            >
              {selectedGame === 'mind-sync' ? (
                <MindSyncGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName} partnershipId={partnershipId} />
              ) : selectedGame === 'memory-map' ? (
                <MemoryMapGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName} partnershipId={partnershipId} />
              ) : selectedGame === 'partner-predict' ? (
                <PartnerPredictGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName} partnershipId={partnershipId} />
              ) : selectedGame === 'if-i-were-you' ? (
                <IfIWereYouGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName} partnershipId={partnershipId} />
              ) : selectedGame === 'emoji-mood' ? (
                <EmojiMoodGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName} partnershipId={partnershipId} />
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
    </div>
  );
}
