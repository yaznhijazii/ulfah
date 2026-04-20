import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Search, Gamepad2, Brain, Binary,
  Zap, Image as ImageIcon, Bomb, X, MapPin,
  Trophy, Heart, Star, Play, ChevronLeft, HelpCircle, UserCircle, Smile, Sparkles
} from 'lucide-react';
import { BoomBoomGame } from './BoomBoomGame';
import { WordGuessGame } from './WordGuessGame';
import { NumberGuessGame } from './NumberGuessGame';
import { MindSyncGame } from './MindSyncGame';
import { MemoryMapGame } from './MemoryMapGame';
import { PartnerPredictGame } from './PartnerPredictGame';
import { IfIWereYouGame } from './IfIWereYouGame';
import { EmojiMoodGame } from './EmojiMoodGame';
import { ReactionWarGame } from './ReactionWarGame';
import { HeartCatchGame } from './HeartCatchGame';
import { supabase } from '../../lib/supabase';

interface GamesScreenProps {
  onNavigate: (screen: string) => void;
  isDarkMode?: boolean;
  userId: string;
  partnershipId: string | null;
  initialGame?: string;
  initialCode?: string;
  onConsumedParams?: () => void;
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
    cover: '/Pixelated-Heart-Transparent.png',
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
    cover: '/Untitled (2).png',
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
    cover: '/Untitled (1).png',
  },
  {
    id: 'memory-map',
    title: 'مرفأ الذكريات',
    desc: 'رحلة في أغلى اللحظات',
    icon: ImageIcon,
    category: 'connection',
    gradient: 'from-violet-500 to-purple-700',
    iconGradient: 'from-violet-400 to-purple-700',
    cover: '/Untitled.png',
  },
  {
    id: 'footprint-trail',
    title: 'أثر الخطوات',
    desc: 'اكتشف كم يعرف شريكك عن يومياتك وتفاصيلك!',
    icon: MapPin,
    category: 'connection',
    badge: 'يوميات 👣',
    gradient: 'from-emerald-400 to-teal-600',
    iconGradient: 'from-emerald-400 to-teal-600',
    cover: '/Pixelated-Heart-Transparent.png'
  },
  {
    id: 'word-guess',
    title: 'لعبة الكلمة',
    desc: 'ذكاء وتواصل ممتع',
    icon: Brain,
    category: 'intelligence',
    gradient: 'from-teal-400 to-emerald-600',
    iconGradient: 'from-teal-400 to-emerald-600',
    cover: '/Adobe Express - file.png',
  },
  {
    id: 'number-guess',
    title: 'احزر الرقم',
    desc: 'تحدي الأرقام السريعة',
    icon: Binary,
    category: 'intelligence',
    gradient: 'from-amber-400 to-orange-600',
    iconGradient: 'from-amber-400 to-orange-500',
    cover: '/Adobe Express - file (1).png',
  },
  {
    id: 'boom-boom',
    title: 'بوم بوم',
    desc: 'تكتيك ومناورة ذكية',
    icon: Bomb,
    category: 'intelligence',
    gradient: 'from-indigo-500 to-violet-700',
    iconGradient: 'from-indigo-400 to-violet-600',
    cover: '/Gemini_Generated_Image_4ss4mu4ss4mu4ss4-removebg-preview.png',
  },
  {
    id: 'reaction-war',
    title: 'حرب السرعة',
    desc: 'تحدي أسرع أصابع بينكم!',
    icon: Zap,
    category: 'adventure',
    badge: 'حماس 🔥',
    gradient: 'from-indigo-600 to-blue-700',
    iconGradient: 'from-indigo-500 to-blue-600',
    cover: '/Gemini_Generated_Image_eoxlcdeoxlcdeoxl-removebg-preview.png',
  },
  {
    id: 'heart-catch',
    title: 'صياد القلوب',
    desc: 'لمّ القلوب وابعد عن النبض السيء!',
    icon: Heart,
    category: 'adventure',
    badge: 'إدمان 🎯',
    gradient: 'from-rose-500 to-pink-600',
    iconGradient: 'from-rose-400 to-pink-500',
    cover: '/Gemini_Generated_Image_2fgsx62fgsx62fgs-removebg-preview.png',
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

export function GamesScreen({ 
  onNavigate, isDarkMode, userId, partnershipId, 
  initialGame, initialCode, onConsumedParams 
}: GamesScreenProps) {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [stats, setStats] = useState({ xp: 0, level: 1, streak: 0, hearts: 3 });

  // 1. Load Stats & Real-time Subscription
  useEffect(() => {
    if (!partnershipId) return;

    const fetchAndSubscribe = async () => {
      try {
        // First fetch
        let { data, error } = await supabase
          .from('partnerships_stats')
          .select('*')
          .eq('partnership_id', partnershipId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // Record doesn't exist, create it
            const { data: newStats } = await supabase
              .from('partnerships_stats')
              .insert([{ partnership_id: partnershipId, xp: 0, level: 1, streak: 0, hearts: 3 }])
              .select()
              .single();
            if (newStats) setStats(newStats);
          } else {
            console.warn('Stats table might be missing or error:', error.message);
          }
        } else if (data) {
          setStats(data);
        }

        // Real-time subscription - only if it didn't totaly fail
        const statsSub = supabase
          .channel('stats-changes')
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'partnerships_stats',
            filter: `partnership_id=eq.${partnershipId}`
          }, (payload) => {
            if (payload.new) setStats(payload.new as any);
          })
          .subscribe();

        return () => {
          supabase.removeChannel(statsSub);
        };
      } catch (err) {
        console.error('Stats sync error:', err);
      }
    };

    fetchAndSubscribe();
  }, [partnershipId]);

  useEffect(() => {
    if (initialGame) {
      setSelectedGame(initialGame);
    }
  }, [initialGame]);

  // Clean up params once used
  useEffect(() => {
    if (selectedGame && initialGame && onConsumedParams) {
      onConsumedParams();
    }
  }, [selectedGame, initialGame, onConsumedParams]);

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
    <div dir="rtl" className="flex-1 bg-zinc-950 flex flex-col relative overflow-hidden h-full font-sans">

      {/* ─── Ambient Particles Layer ─── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <motion.div
          animate={{ x: [-20, 20, -20], y: [-20, 20, -20], opacity: [0.1, 0.15, 0.1] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          className="absolute top-[20%] right-[15%] w-[400px] h-[400px] bg-indigo-600/10 blur-[120px] rounded-full"
        />
        <motion.div
          animate={{ x: [20, -20, 20], y: [20, -20, 20], opacity: [0.08, 0.12, 0.08] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          className="absolute bottom-[20%] left-[10%] w-[350px] h-[350px] bg-rose-600/10 blur-[100px] rounded-full"
        />
      </div>

      {/* ─── SMART THEMED HEADER ─── */}
      <header className={`px-6 z-40 sticky top-0 transition-all duration-500 border-b ${
        selectedGame 
          ? 'pt-4 pb-3 bg-[#fcfbf7]/90 backdrop-blur-xl border-black/5 shadow-sm' 
          : 'pt-10 pb-6 bg-zinc-950/80 backdrop-blur-3xl border-white/5 shadow-[0_10px_40px_rgba(0,0,0,0.5)]'
      }`}>

        {/* Top Operation Row */}
        <div className={`flex items-center justify-between transition-all duration-500 ${selectedGame ? 'mb-0' : 'mb-7'}`}>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => selectedGame !== null ? setSelectedGame(null) : onNavigate('home')}
            className={`flex items-center justify-center rounded-2xl border transition-all duration-500 ${
              selectedGame
                ? 'w-10 h-10 bg-black/5 border-black/5'
                : 'w-12 h-12 bg-white/5 border-white/10 shadow-xl'
            }`}
          >
            <ArrowLeft className={`w-5 h-5 transition-colors ${selectedGame ? 'text-black/40' : 'text-white/70'}`} />
          </motion.button>

          <div className="text-center">
            <h1 className={`font-black italic tracking-tighter flex items-center justify-center gap-3 transition-all duration-500 ${
              selectedGame 
                ? 'text-lg text-black/80' 
                : 'text-2xl text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]'
            }`}>
              {selectedGame
                ? ALL_GAMES.find(g => g.id === selectedGame)?.title
                : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    مرفـأ الألعاب
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  </>
                )}
            </h1>
            {!selectedGame && (
              <div className="flex items-center justify-center gap-2 mt-1">
                 <div className="h-[1px] w-4 bg-white/10" />
                 <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em]">
                    Digital Arena v2.0
                 </span>
                 <div className="h-[1px] w-4 bg-white/10" />
              </div>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.1, rotate: 10 }}
            whileTap={{ scale: 0.9 }}
            className={`flex items-center justify-center rounded-2xl border transition-all duration-500 ${
              selectedGame
                ? 'w-10 h-10 bg-amber-500/10 border-amber-500/20 shadow-none'
                : 'w-12 h-12 bg-gradient-to-br from-amber-400/20 to-orange-600/20 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
            }`}
          >
            <Trophy className={`w-5 h-5 text-amber-500 transition-all ${selectedGame ? '' : 'drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} />
          </motion.button>
        </div>

        {/* Search & Tactics Row */}
        {selectedGame === null && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Cyber Search */}
            <div className="relative group">
              <input
                type="text"
                placeholder="ابحث عن التحدي القادم..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                dir="rtl"
                className="w-full h-14 bg-white/[0.03] border border-white/5 rounded-2xl px-6 pl-14 text-[13px] font-bold text-white outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-white/10"
              />
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" />
              
              <AnimatePresence>
                {searchTerm && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={() => setSearchTerm('')}
                    className="absolute right-5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <X className="w-3 h-3 text-white" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Neon Category Tabs */}
            <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
              {CATEGORIES.map(cat => {
                const active = activeCategory === cat.id;
                return (
                  <motion.button
                    key={cat.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex-shrink-0 flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[10px] font-black transition-all duration-300 border ${
                      active
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-[0_0_20px_rgba(79,70,229,0.4)]'
                        : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
                    }`}
                  >
                    <cat.icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-white/30'}`} />
                    <span className="tracking-wide">{cat.title}</span>
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
              className="absolute inset-0 overflow-y-auto px-5 pt-8 pb-36 bg-[#02040a]"
              style={{ scrollbarWidth: 'none' }}
            >
              {/* Global Cosmic Backdrop */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none fixed">
                 <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-indigo-600/15 blur-[150px] rounded-full animate-pulse" />
                 <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-rose-600/10 blur-[150px] rounded-full" />
                 <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'url("https://grainy-gradients.vercel.app/noise.svg")' }} />
                 <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '50px 50px', perspective: '1000px', transform: 'rotateX(65deg) translateY(120px)' }} />
              </div>

              <div className="grid grid-cols-2 gap-8 relative z-10">

                {/* ═══ PRO GAMING HUB ═══ */}
                <motion.div 
                   initial={{ y: -30, opacity: 0 }}
                   animate={{ y: 0, opacity: 1 }}
                   className="col-span-2 relative p-7 rounded-[3rem] bg-zinc-900/60 backdrop-blur-3xl border border-white/5 shadow-[0_30px_70px_rgba(0,0,0,0.7)] overflow-hidden mb-4"
                >
                   {/* Scanning Line Animation */}
                   <motion.div 
                     animate={{ top: ['-10%', '110%'] }} 
                     transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                     className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent z-20" 
                   />

                   <div className="relative z-10 flex flex-col gap-6">
                      <div className="flex justify-between items-center">
                         <div className="flex items-center gap-4">
                            <div className="relative">
                               <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-rose-600 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.5)] border border-white/30">
                                  <Trophy className="w-8 h-8 text-white" />
                               </div>
                               <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-zinc-950 border border-white/10 flex items-center justify-center">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                </div>
                            </div>
                            <div className="flex flex-col">
                               <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.3em] font-mono">Rank: {stats.level > 10 ? 'Legendary' : 'Novice'}</span>
                                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                               </div>
                               <h2 className="text-2xl font-black text-white italic tracking-tighter drop-shadow-lg uppercase">أساطير أولفـة (LVL {stats.level})</h2>
                            </div>
                         </div>
                         <div className="flex -space-x-3">
                            {Array.from({ length: stats.hearts }).map((_, i) => (
                               <div key={i} className="w-11 h-11 rounded-full bg-zinc-900 border-2 border-zinc-800 flex items-center justify-center shadow-xl">
                                  <Heart className="w-6 h-6 text-rose-500 fill-rose-500 drop-shadow-[0_0_12px_rgba(244,63,94,1)]" />
                               </div>
                            ))}
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <div className="bg-white/5 rounded-2xl p-4 border border-white/5 backdrop-blur-md">
                            <span className="block text-[8px] font-black text-white/40 uppercase mb-1 tracking-widest">Global XP</span>
                            <span className="text-[1.3rem] font-black text-white font-mono leading-none tracking-tight">{stats.xp.toLocaleString()} <span className="text-[10px] opacity-20 font-sans ml-1 text-white">XP</span></span>
                         </div>
                         <div className="bg-white/5 rounded-2xl p-4 border border-white/5 backdrop-blur-md">
                            <span className="block text-[8px] font-black text-white/40 uppercase mb-1 tracking-widest">Win Streak</span>
                            <span className="text-[1.3rem] font-black text-rose-500 font-mono leading-none tracking-tight">{stats.streak} <span className="text-[10px] opacity-20 font-sans ml-1 text-white uppercase italic font-black">Days</span></span>
                         </div>
                      </div>
                   </div>
                </motion.div>

                {/* ═══ HERO CARD (Mind Sync) ═══ */}
                {showHero && (
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 70, damping: 18 }}
                    className="col-span-2"
                  >
                    <motion.button
                      whileTap={{ scale: 0.975 }}
                      onClick={() => setSelectedGame('mind-sync')}
                      className="w-full h-[250px] rounded-[3.8rem] relative overflow-hidden group shadow-[0_50px_100px_rgba(0,0,0,0.8)] text-right border border-white/10"
                    >
                      {/* Interactive Gaming Core BG */}
                      <div className="absolute inset-0 bg-gradient-to-br from-[#0c0d12] via-[#1a1b25] to-[#252a44]" />
                      <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay" style={{ backgroundImage: 'url("https://grainy-gradients.vercel.app/noise.svg")' }} />
                      
                      {/* Pulsing Core */}
                      <motion.div 
                        animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.2, 0.1] }}
                        transition={{ duration: 6, repeat: Infinity }}
                        className="absolute inset-0 bg-indigo-500 blur-[120px] rounded-full"
                      />

                      {/* Content Stack */}
                      <div className="absolute inset-0 p-9 flex flex-col justify-between relative z-10">
                        <div className="flex items-start justify-between">
                          <div className="flex flex-col items-start gap-1">
                             <div className="bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 px-4 py-1.5 rounded-2xl flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em]">{heroGame.badge}</span>
                             </div>
                          </div>
                          <motion.div 
                             animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.1, 1] }}
                             transition={{ duration: 5, repeat: Infinity }}
                             className="w-20 h-20 bg-white/5 backdrop-blur-3xl rounded-[2.2rem] flex items-center justify-center border border-white/10 shadow-2xl"
                          >
                             <Zap className="w-10 h-10 text-indigo-400 fill-indigo-400/30" />
                          </motion.div>
                        </div>

                        <div className="text-right">
                          <h2 className="text-[2.8rem] font-black text-white leading-[0.85] tracking-tighter italic mb-3 drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)]">
                             {heroGame.title}
                          </h2>
                          <p className="text-[13px] font-bold text-indigo-200/50 mb-7 max-w-[320px] mr-0 ml-auto leading-relaxed">
                             {heroGame.desc}
                          </p>
                          <div className="flex justify-end">
                             <div className="bg-white text-zinc-950 px-9 py-3.5 rounded-2xl text-[12px] font-black shadow-[0_20px_40px_rgba(255,255,255,0.15)] group-hover:scale-110 group-hover:bg-indigo-50 transition-all flex items-center gap-3 active:scale-90">
                                ENTER CHALLENGE
                                <div className="w-6 h-6 rounded-lg bg-zinc-950 flex items-center justify-center">
                                   <Play className="w-3 h-3 text-white fill-current translate-x-[0.5px]" />
                                </div>
                             </div>
                          </div>
                        </div>
                      </div>

                      {/* Animated Scanner side */}
                      <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-indigo-500 to-rose-500 shadow-[0_0_30px_rgba(99,102,241,1)]" />
                    </motion.button>
                  </motion.div>
                )}

                {/* ═══ PRO CYBER GAME TILES ═══ */}
                {gridGames.map((game, idx) => {
                  const hasCover = (game as any).cover;

                  return (
                    <motion.button
                      key={game.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1, transition: { delay: 0.12 * idx, type: 'spring' } }}
                      whileHover={{ y: -12 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setSelectedGame(game.id)}
                      className="col-span-2 h-[175px] relative rounded-[3.2rem] overflow-hidden text-right border border-white/5 shadow-2xl group transition-all"
                    >
                      {/* Material: Frosted Void Glass */}
                      <div className="absolute inset-0 bg-zinc-950/80 group-hover:bg-zinc-900/90 transition-all duration-500" />
                      <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'url("https://grainy-gradients.vercel.app/noise.svg")' }} />
                      
                      {/* Aura Glow */}
                      <div className={`absolute -right-24 -top-24 w-72 h-72 bg-gradient-to-br ${game.gradient} opacity-15 blur-[100px] group-hover:opacity-30 transition-opacity duration-700`} />

                      {/* Content Architecture */}
                      <div className="absolute inset-0 p-7 pr-10 flex items-center gap-10 z-10">
                         
                         {/* LEFT: Operation Panel */}
                         <div className="flex flex-col justify-between h-full py-2">
                            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md w-fit flex items-center gap-2">
                               <div className="w-2 h-2 rounded-full bg-green- green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                               <span className="text-[8px] font-black text-white/50 uppercase tracking-[0.2em] font-mono">Status: Ready</span>
                            </div>

                            <div className="group/btn relative px-6 py-3 rounded-2xl bg-white/5 text-white/40 border border-white/10 hover:bg-white hover:text-zinc-950 hover:shadow-[0_15px_30px_rgba(255,255,255,0.1)] transition-all flex items-center gap-3">
                               <Play className="w-3 h-3 fill-current" />
                               <span className="text-[10px] font-black uppercase tracking-[0.1em]">Engage</span>
                            </div>
                         </div>

                         {/* CENTER: Meta Info */}
                         <div className="flex-1 text-right flex flex-col justify-center">
                            <div className="mb-1">
                               <span className="text-[8px] font-black text-indigo-400/60 uppercase tracking-widest">{game.category}</span>
                            </div>
                            <h4 className="text-[1.8rem] font-black text-white tracking-tighter leading-none mb-1.5 transition-all">
                               {game.title}
                            </h4>
                            <p className="text-[11px] font-bold text-white/30 leading-snug max-w-[220px] mr-0 ml-auto italic">
                               {game.desc}
                            </p>
                         </div>

                         {/* RIGHT: 3D Pop-out Visualization */}
                         <div className="relative w-32 h-32 flex-shrink-0 flex items-center justify-center">
                            {/* Reflection Glow */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${game.gradient} blur-[50px] opacity-20 group-hover:opacity-60 transition-all`} />
                            
                            <motion.div 
                               animate={{ y: [0, -6, 0], rotate: [0, 3, 0] }}
                               transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                               className="relative z-20 w-28 h-28"
                            >
                               {hasCover ? (
                                 <img 
                                   src={(game as any).cover} 
                                   alt="" 
                                   className="w-full h-full object-contain drop-shadow-[0_25px_45px_rgba(0,0,0,0.9)] scale-110 group-hover:scale-[1.35] transition-transform duration-700 ease-[0.34,1.56,0.64,1] transform group-hover:-translate-x-6" 
                                 />
                               ) : (
                                 <div className={`w-full h-full rounded-3xl bg-gradient-to-br ${game.iconGradient} flex items-center justify-center shadow-2xl border border-white/20`}>
                                    <game.icon className="w-12 h-12 text-white" />
                                 </div>
                               )}
                            </motion.div>
                         </div>

                      </div>

                      {/* Side Power Rail */}
                      <div className={`absolute top-0 right-0 w-2 h-full bg-gradient-to-b ${game.iconGradient} group-hover:w-3 transition-all`} />
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
                <MindSyncGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName} partnershipId={partnershipId} initialCode={initialCode} />
              ) : selectedGame === 'memory-map' || selectedGame === 'footprint-trail' ? (
                <MemoryMapGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName} partnershipId={partnershipId} initialCode={initialCode} />
              ) : selectedGame === 'partner-predict' ? (
                <PartnerPredictGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName} partnershipId={partnershipId} initialCode={initialCode} />
              ) : selectedGame === 'if-i-were-you' ? (
                <IfIWereYouGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName} partnershipId={partnershipId} initialCode={initialCode} />
              ) : selectedGame === 'emoji-mood' ? (
                <EmojiMoodGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName} partnershipId={partnershipId} initialCode={initialCode} />
              ) : selectedGame === 'word-guess' ? (
                <WordGuessGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName} partnershipId={partnershipId} initialCode={initialCode} />
              ) : selectedGame === 'number-guess' ? (
                <NumberGuessGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName} partnershipId={partnershipId} initialCode={initialCode} />
              ) : selectedGame === 'boom-boom' ? (
                <BoomBoomGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName} partnershipId={partnershipId} initialCode={initialCode} />
              ) : selectedGame === 'reaction-war' ? (
                <ReactionWarGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName} partnershipId={partnershipId} initialCode={initialCode} />
              ) : selectedGame === 'heart-catch' ? (
                <HeartCatchGame onBack={() => setSelectedGame(null)} userId={userId} userName={userName} partnershipId={partnershipId} initialCode={initialCode} />
              ) : (
                <div className="flex items-center justify-center h-full text-white/20 font-black">قريباً..</div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
