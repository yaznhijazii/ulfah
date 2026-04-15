import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Settings,
    Heart,
    Sparkles,
    ChevronLeft,
    MapPin,
    Compass,
    Gift,
    Moon,
    Sun,
    ShieldCheck,
    Target,
    Zap,
    Navigation,
    User,
    Calendar,
    ArrowUpRight,
    Cloud,
    Camera,
    Bell,
    Share2,
    Layout,
    Clock
} from 'lucide-react';
import { Logo } from './Logo';
import { Button } from './ui/button';
import { supabase } from '../../lib/supabase';
import { getAIRecommendation } from '../../utils/aiAdvisor';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface HomeScreenProps {
    onNavigate: (screen: string) => void;
    userId: string;
    partnershipId: string | null;
    isDarkMode: boolean;
}

export function HomeScreen({ onNavigate, userId, partnershipId, isDarkMode }: HomeScreenProps) {
    // --- STATE ---
    const [daysTogether, setDaysTogether] = useState<number>(0);
    const [showMoodPrompt, setShowMoodPrompt] = useState(true);
    const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
    const [avatars, setAvatars] = useState<{ me: string | null, partner: string | null }>({ me: null, partner: null });
    const [partnerTracking, setPartnerTracking] = useState<{ last_seen: string | null, lat: number | null, lng: number | null }>({ last_seen: null, lat: null, lng: null });
    const [myLocation, setMyLocation] = useState<{ lat: number | null, lng: number | null }>({ lat: null, lng: null });
    const [distance, setDistance] = useState<string | null>(null);
    const [nudgeActive, setNudgeActive] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [partnership, setPartnership] = useState<any>(null);
    const [moodLoading, setMoodLoading] = useState(false);
    const [selectedMoodId, setSelectedMoodId] = useState<string | null>(null);
    const [partnerMood, setPartnerMood] = useState<any>(null);
    const [aiRecommendation, setAiRecommendation] = useState<{ title: string; advice: string } | null>(null);
    const [showMap, setShowMap] = useState(false);

    // --- REFINED DATA ---
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 5) return 'ليلة هادئة بذكر الله';
        if (hour < 12) return 'صباح المودة والسكينة';
        if (hour < 18) return 'طاب يومكم بكل مودة';
        return 'مساء السكينة والمحبة';
    }, []);

    const moods = useMemo(() => [
        { id: 'happy', icon: Sun, label: 'مشرقة', color: 'text-amber-500', bg: 'bg-amber-500/10', glow: 'shadow-amber-500/20' },
        { id: 'calm', icon: ShieldCheck, label: 'مطمئنة', color: 'text-emerald-500', bg: 'bg-emerald-500/10', glow: 'shadow-emerald-500/20' },
        { id: 'tired', icon: Moon, label: 'منهكة', color: 'text-indigo-500', bg: 'bg-indigo-500/10', glow: 'shadow-indigo-500/20' },
        { id: 'sad', icon: Cloud, label: 'غائمة', color: 'text-rose-500', bg: 'bg-rose-500/10', glow: 'shadow-rose-500/20' },
    ], []);

    // --- LOGIC ---
    const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c;
        if (d < 1) return `${Math.round(d * 1000)} م`;
        return `${d.toFixed(1)} كم`;
    }, []);

    const updateMyStatus = useCallback(async () => {
        if (!userId) return;
        setIsSyncing(true);
        let lat = null, lng = null;

        const cachedLat = localStorage.getItem('ulfah_last_lat');
        const cachedLng = localStorage.getItem('ulfah_last_lng');
        if (cachedLat && cachedLng) {
            setMyLocation({ lat: parseFloat(cachedLat), lng: parseFloat(cachedLng) });
        }

        if ("geolocation" in navigator) {
            try {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 });
                });
                lat = position.coords.latitude;
                lng = position.coords.longitude;
                setMyLocation({ lat, lng });
                localStorage.setItem('ulfah_last_lat', (lat ?? 0).toString());
                localStorage.setItem('ulfah_last_lng', (lng ?? 0).toString());
            } catch (e) { }
        }
        
        await supabase.from('users').update({ last_seen: new Date().toISOString(), ...(lat && lng ? { latitude: lat, longitude: lng } : {}) }).eq('id', userId);
        setTimeout(() => setIsSyncing(false), 1000);
    }, [userId]);

    const loadData = useCallback(async () => {
        if (!partnershipId || !userId) return;
        const today = new Date().toISOString().split('T')[0];

        try {
            const { data: p } = await supabase.from('partnerships')
                .select('*, user1:user1_id(avatar_url, last_seen, latitude, longitude), user2:user2_id(avatar_url, last_seen, latitude, longitude)')
                .eq('id', partnershipId)
                .single();

            if (p) {
                setPartnership(p);
                const isUser1 = p.user1_id === userId;
                const partner = isUser1 ? p.user2 : p.user1;
                const partnerId = isUser1 ? p.user2_id : p.user1_id;

                setAvatars({ me: (isUser1 ? p.user1 : p.user2)?.avatar_url, partner: partner?.avatar_url });
                setPartnerTracking({ last_seen: partner?.last_seen, lat: partner?.latitude, lng: partner?.longitude });
                
                const start = new Date(p.relationship_start_date || p.created_at);
                setDaysTogether(Math.floor((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

                const [{ data: myMood }, { data: pMood }, { data: events }] = await Promise.all([
                    supabase.from('mood_logs').select('mood').eq('user_id', userId).eq('mood_date', today).maybeSingle(),
                    supabase.from('mood_logs').select('mood').eq('user_id', partnerId).eq('mood_date', today).maybeSingle(),
                    supabase.from('calendar_events').select('*').eq('partnership_id', partnershipId).gte('event_date', today).order('event_date', { ascending: true }).limit(3)
                ]);

                if (myMood) { setSelectedMoodId(myMood.mood); setShowMoodPrompt(false); }
                if (pMood) setPartnerMood(pMood.mood);
                setUpcomingEvents(events || []);

                const { data: latestNote } = await supabase.from('love_notes').select('content').eq('author_id', partnerId).order('created_at', { ascending: false }).limit(1).maybeSingle();
                setAiRecommendation(getAIRecommendation({ mood: pMood?.mood || null, lastNote: latestNote?.content || null }));
            }
        } catch (e) { console.error("Error loading data", e); }
    }, [partnershipId, userId]);

    useEffect(() => {
        loadData();
        updateMyStatus();
        const interval = setInterval(() => { updateMyStatus(); loadData(); }, 60000);
        
        const channel = supabase.channel(`nudge_${userId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
            const newNotif = payload.new as any;
            if (newNotif.type === 'nudge') {
                setNudgeActive(true);
                setTimeout(() => setNudgeActive(false), 3000);
                toast.success(newNotif.title, { description: newNotif.body, icon: '💖' });
            }
        }).subscribe();

        return () => { clearInterval(interval); supabase.removeChannel(channel); };
    }, [userId, partnershipId, loadData, updateMyStatus]);

    useEffect(() => {
        if (partnerTracking.lat && partnerTracking.lng && myLocation.lat && myLocation.lng) {
            setDistance(calculateDistance(myLocation.lat, myLocation.lng, partnerTracking.lat, partnerTracking.lng));
        }
    }, [myLocation, partnerTracking, calculateDistance]);

    const handleNudge = async () => {
        if (!userId || !partnershipId || !partnership) return;
        setNudgeActive(true);
        setTimeout(() => setNudgeActive(false), 2000);
        try {
            const partnerId = partnership.user1_id === userId ? partnership.user2_id : partnership.user1_id;
            await supabase.from('notifications').insert({ user_id: partnerId, title: 'تنبيه مودة 💖', body: `شريكك يفكر بك الآن! المسافة بينكما: ${distance || '--'}`, type: 'nudge' });
        } catch (e) { }
    };

    const handleMoodSelect = async (mood: string) => {
        if (!userId || moodLoading) return;
        setMoodLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            await supabase.from('mood_logs').upsert({ user_id: userId, mood_date: today, mood: mood }, { onConflict: 'user_id,mood_date' });
            setSelectedMoodId(mood);
            setShowMoodPrompt(false);
            loadData();
        } catch (err) { } finally { setMoodLoading(false); }
    };

    const isPartnerOnline = () => {
        if (!partnerTracking.last_seen) return false;
        return (new Date().getTime() - new Date(partnerTracking.last_seen).getTime()) < 120000;
    };

    const formatLastSeen = (lastSeen: string | null) => {
        if (!lastSeen) return 'غير متوفر';
        const diff = Math.floor((new Date().getTime() - new Date(lastSeen).getTime()) / 60000);
        if (diff < 2) return 'نشط الآن';
        if (diff < 60) return `منذ ${diff} د`;
        if (diff < 1440) return `منذ ${Math.floor(diff / 60)} س`;
        return new Date(lastSeen).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
    };

    return (
        <div dir="rtl" className="flex-1 bg-[#fcfcfd] dark:bg-[#0a0505] overflow-x-hidden scrollbar-hide pb-40 relative font-sans selection:bg-rose-500/10">
            {/* --- PREMIUM AMBIENT BACKGROUND --- */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.08, 0.12, 0.08] }} transition={{ duration: 10, repeat: Infinity }} className="absolute top-[-15%] right-[-10%] w-[120%] h-[80%] bg-rose-500/20 blur-[180px] rounded-full" />
                <motion.div animate={{ scale: [1.1, 1, 1.1], opacity: [0.05, 0.08, 0.05] }} transition={{ duration: 8, repeat: Infinity }} className="absolute bottom-[-10%] left-[-15%] w-[100%] h-[70%] bg-amber-500/20 blur-[160px] rounded-full" />
                <div className="absolute top-[40%] left-[30%] w-[30%] h-[30%] bg-indigo-500/10 blur-[140px] rounded-full" />
            </div>

            {/* --- TOP NAVIGATION BAR --- */}
            <header className="px-8 pt-12 pb-6 sticky top-0 bg-white/5 backdrop-blur-2xl z-50 border-b border-white/10">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col text-right">
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 group px-2 py-1">
                            <div className="relative">
                                <Logo size="sm" />
                                <motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 5, repeat: Infinity }} className="absolute inset-0 bg-rose-500/30 blur-2xl rounded-full -z-10" />
                            </div>
                            <h1 className="text-3xl font-black text-foreground tracking-tighter bg-clip-text text-transparent bg-gradient-to-l from-foreground to-foreground/60">أُلْفَة</h1>
                        </motion.div>
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} transition={{ delay: 0.3 }} className="text-[9px] font-bold uppercase tracking-[0.4em] text-rose-500 mt-2 px-2 leading-none">
                            {greeting}
                        </motion.p>
                    </div>
                    <div className="flex items-center gap-3">
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-11 h-11 glass rounded-2xl flex items-center justify-center text-foreground/30 relative">
                             <Bell size={20} />
                             <div className="absolute top-3 right-3 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-black" />
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => onNavigate('settings')} className="w-11 h-11 glass rounded-2xl flex items-center justify-center text-foreground/30 hover:text-rose-500">
                            <Settings size={20} />
                        </motion.button>
                    </div>
                </div>
            </header>

            <main className="px-7 mt-8 space-y-10">
                {/* --- SOUL CONNECTION HERO --- */}
                <section>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative glass rounded-[4rem] p-8 border-white/60 dark:border-white/5 shadow-[0_40px_80px_-20px_rgba(244,63,94,0.12)] bg-gradient-to-br from-white/60 to-white/20 dark:from-zinc-900/40 dark:to-transparent overflow-hidden">
                        {/* Decorative Wave */}
                        <svg className="absolute top-0 right-0 w-32 h-32 text-rose-500/5 rotate-12" viewBox="0 0 100 100" fill="currentColor">
                             <path d="M0 50 Q 25 0, 50 50 T 100 50" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                        </svg>

                        <div className="relative z-10 flex flex-col items-center">
                            {/* Infinity Bridge */}
                            <div className="w-full flex items-center justify-center gap-6 mb-8 relative">
                                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-[1px] bg-gradient-to-r from-transparent via-rose-200/40 to-transparent -z-10" />
                                
                                <div className="flex flex-col items-center gap-2">
                                    <motion.div whileHover={{ scale: 1.05 }} className="w-22 h-22 rounded-[2.5rem] ring-[6px] ring-white dark:ring-zinc-900 shadow-2xl overflow-hidden relative border border-black/5 bg-zinc-50">
                                        {avatars.me ? <img src={avatars.me} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-rose-200"><User size={40} /></div>}
                                    </motion.div>
                                    <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/5 px-3 py-1 rounded-full border border-emerald-500/10 tracking-widest">أنت متصل</span>
                                </div>

                                <motion.button onClick={handleNudge} whileTap={{ scale: 0.8 }} className="w-16 h-16 rounded-[2rem] glass border-white shadow-2xl flex items-center justify-center bg-white/95 dark:bg-zinc-900 z-10 hover:shadow-rose-500/20 transition-all">
                                    <motion.div animate={{ scale: nudgeActive ? [1, 1.5, 1] : 1 }}>
                                        <Heart size={30} className={nudgeActive ? "text-rose-500 fill-rose-500" : "text-rose-400 fill-rose-500/5"} />
                                    </motion.div>
                                    {nudgeActive && <motion.div initial={{ scale: 0.5, opacity: 1 }} animate={{ scale: 3, opacity: 0 }} transition={{ duration: 1.5 }} className="absolute inset-0 rounded-full border-2 border-rose-500" />}
                                </motion.button>

                                <div className="flex flex-col items-center gap-2">
                                    <motion.div whileHover={{ scale: 1.05 }} className="w-22 h-22 rounded-[2.5rem] ring-[6px] ring-white dark:ring-zinc-900 shadow-2xl overflow-hidden relative border border-black/5 bg-zinc-50">
                                        {avatars.partner ? <img src={avatars.partner} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-rose-100"><Heart fill="currentColor" size={40} /></div>}
                                    </motion.div>
                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-black/5 bg-white/40 dark:bg-black/20">
                                         <div className={`w-1.5 h-1.5 rounded-full ${isPartnerOnline() ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-300'}`} />
                                         <span className="text-[9px] font-black opacity-40 uppercase tracking-widest">{isPartnerOnline() ? 'متصل' : formatLastSeen(partnerTracking.last_seen)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Dynamic Stat Cards */}
                            <div className="grid grid-cols-2 gap-5 w-full">
                                <div className="glass rounded-[2.5rem] p-5 flex flex-col items-center justify-center gap-1 border-white/40 bg-white/40 shadow-sm">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Compass size={12} className="text-rose-500/50" />
                                        <span className="text-[9px] font-black text-rose-500/40 uppercase tracking-[0.2em]">تبعد المسافة</span>
                                    </div>
                                    <h2 className="text-3xl font-black text-foreground tabular-nums">{distance || '--'}</h2>
                                </div>
                                <div className="glass rounded-[2.5rem] p-5 flex flex-col items-center justify-center gap-1 border-white/40 bg-white/40 shadow-sm">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Clock size={12} className="text-rose-500/50" />
                                        <span className="text-[9px] font-black text-rose-500/40 uppercase tracking-[0.2em]">معاً منذ</span>
                                    </div>
                                    <h2 className="text-3xl font-black text-foreground tabular-nums">{daysTogether} <span className="text-xs font-medium text-muted-foreground opacity-30">يوم</span></h2>
                                </div>
                            </div>

                            {/* Primary Controls */}
                            <div className="flex items-center gap-4 mt-8 w-full">
                                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowMap(true)} className="flex-1 h-15 glass rounded-3xl flex items-center justify-center gap-3 text-rose-500 font-black text-sm shadow-xl bg-white/90 group">
                                    <MapPin size={20} className="group-hover:scale-110 transition-transform" />
                                    <span>الخريطة الحية</span>
                                </motion.button>
                                <motion.button whileTap={{ scale: 0.9 }} onClick={updateMyStatus} className="w-15 h-15 glass rounded-3xl flex items-center justify-center text-rose-500 shadow-xl bg-rose-50/50">
                                    <Zap size={22} className={isSyncing ? 'animate-spin' : ''} />
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                </section>

                {/* --- DYNAMIC BENTO GRID SYSTEM --- */}
                <section className="grid grid-cols-2 gap-5 auto-rows-max">
                    {/* 1. AI ADVISOR (Full Width Header) */}
                    <AnimatePresence mode="wait">
                        {aiRecommendation && (
                            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="col-span-2 glass rounded-[2.5rem] p-7 border-indigo-500/20 bg-gradient-to-l from-indigo-500/[0.04] to-transparent relative group overflow-hidden">
                                <div className="absolute top-0 left-0 w-32 h-full bg-indigo-500/5 -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                                <div className="flex gap-5 items-center relative z-10 text-right">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0 shadow-inner">
                                        <Sparkles size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-1">{aiRecommendation.title}</h3>
                                        <p className="text-[11px] font-medium leading-[1.6] text-foreground/75 italic line-clamp-2 pr-2">"{aiRecommendation.advice}"</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* 2. ADVENTURE BUCKET (Tall Rectangle) */}
                    <motion.div whileTap={{ scale: 0.98 }} onClick={() => onNavigate('adventure_bucket')} className="row-span-2 glass rounded-[3.2rem] p-8 border-amber-200/40 bg-amber-500/[0.02] flex flex-col justify-between items-start text-right group relative overflow-hidden">
                         <div className="absolute top-[-10%] left-[-10%] w-24 h-24 bg-amber-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                         <div className="w-14 h-14 rounded-3xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-xl group-hover:rotate-[-8deg] transition-transform">
                             <Compass size={28} />
                         </div>
                         <div className="mt-8 space-y-1">
                             <h3 className="text-xl font-black text-foreground tracking-tight leading-none mb-1">أفق أحلامنا</h3>
                             <p className="text-[10px] font-black text-amber-600/40 tracking-[0.4em] uppercase">رحلاتنا القادمة</p>
                         </div>
                         <div className="mt-6 flex items-center gap-2 text-amber-500/30">
                             <span className="text-[10px] font-black">اكتشف المزيد</span>
                             <ArrowUpRight size={14} />
                         </div>
                    </motion.div>

                    {/* 3. WISHLIST (Square) */}
                    <motion.div whileTap={{ scale: 0.98 }} onClick={() => onNavigate('wishlist')} className="aspect-square glass rounded-[2.8rem] p-6 border-rose-200/40 bg-rose-500/[0.02] flex flex-col items-center justify-center text-center gap-3 group">
                        <div className="w-14 h-14 rounded-3xl bg-rose-500/10 flex items-center justify-center text-rose-500 shadow-inner group-hover:scale-110 transition-transform">
                            <Gift size={28} />
                        </div>
                        <span className="text-sm font-black text-foreground/80 tracking-tight">أمنياتي</span>
                    </motion.div>

                    {/* 4. COMMITMENTS (Horizontal Slim) */}
                    <motion.div whileTap={{ scale: 0.98 }} onClick={() => onNavigate('commitments')} className="aspect-square glass rounded-[2.8rem] p-6 border-emerald-200/40 bg-emerald-500/[0.02] flex flex-col items-center justify-center text-center gap-3 group">
                        <div className="w-14 h-14 rounded-3xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-inner group-hover:rotate-12 transition-transform">
                            <Target size={28} />
                        </div>
                        <span className="text-sm font-black text-foreground/80 tracking-tight">تعهداتنا</span>
                    </motion.div>
                </section>

                {/* --- MOOD SANCTUARY - IMMERSIVE PANEL --- */}
                <section>
                    <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="glass rounded-[3.8rem] p-10 relative overflow-hidden border-white/40 shadow-2xl bg-gradient-to-br from-white/30 to-transparent dark:from-zinc-900/40">
                         <div className="absolute top-0 left-10 w-40 h-40 bg-rose-500/5 blur-[100px] rounded-full pointer-events-none" />
                         <div className="absolute bottom-0 right-10 w-40 h-40 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />

                         <div className="relative z-10 flex flex-col items-center gap-10">
                            <div className="text-center">
                                <h3 className="text-2xl font-black tracking-tight mb-2">سكنات الروح</h3>
                                <div className="flex items-center justify-center gap-3">
                                    <div className="h-[1px] w-6 bg-rose-500/20" />
                                    <p className="text-[10px] font-black text-rose-500/30 uppercase tracking-[0.5em]">بوح الوجدان</p>
                                    <div className="h-[1px] w-6 bg-rose-500/20" />
                                </div>
                            </div>

                            <AnimatePresence mode="wait">
                                {showMoodPrompt ? (
                                    <motion.div key="mood-grid" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-wrap justify-center gap-6">
                                        {moods.map((m) => (
                                            <motion.button key={m.id} onClick={() => handleMoodSelect(m.id)} whileHover={{ y: -8, scale: 1.05 }} className="flex flex-col items-center gap-4 group/mood">
                                                <div className={`w-18 h-18 rounded-[2rem] glass flex items-center justify-center ${m.color} text-2xl shadow-xl border-white/40 bg-white/60 dark:bg-zinc-800/40 relative group-hover/mood:${m.glow} transition-all`}>
                                                    <m.icon size={32} />
                                                    <div className={`absolute inset-0 rounded-[2rem] bg-current opacity-0 group-hover/mood:opacity-5 transition-opacity`} />
                                                </div>
                                                <span className="text-[10px] font-black text-muted-foreground/40 group-hover/mood:text-foreground/50 uppercase tracking-widest">{m.label}</span>
                                            </motion.button>
                                        ))}
                                    </motion.div>
                                ) : (
                                    <motion.div key="mood-saved" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-8 w-full max-w-[340px]">
                                        <div className="flex items-center justify-between w-full relative h-28">
                                            {/* Soul Connection Line */}
                                            <div className="absolute left-1/2 top-12 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-rose-500/20 to-transparent" />

                                            <div className="flex flex-col items-center gap-4">
                                                <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 4, repeat: Infinity }} className="w-22 h-22 glass rounded-[2.2rem] border-rose-500/20 flex items-center justify-center text-rose-500 shadow-2xl relative bg-white/80 dark:bg-zinc-800/80 ring-4 ring-rose-500/5">
                                                    {selectedMoodId && moods.find(m => m.id === selectedMoodId) && (() => {
                                                        const Icon = moods.find(m => m.id === selectedMoodId)!.icon;
                                                        return <Icon size={40} />;
                                                    })()}
                                                    <div className="absolute -bottom-3 text-[9px] bg-emerald-500 text-white px-3 py-1.5 rounded-xl shadow-lg font-black uppercase tracking-widest">أنا</div>
                                                </motion.div>
                                            </div>

                                            <div className="flex flex-col items-center gap-4">
                                                <motion.div animate={{ y: [0, 5, 0] }} transition={{ duration: 4, repeat: Infinity, delay: 1 }} className="w-22 h-22 glass rounded-[2.2rem] border-rose-500/20 flex items-center justify-center shadow-2xl relative bg-white/80 dark:bg-zinc-800/80 ring-4 ring-rose-500/5">
                                                    {partnerMood ? (
                                                        <div className="text-rose-500">
                                                            {moods.find(m => m.id === partnerMood) && (() => {
                                                                const Icon = moods.find(m => m.id === partnerMood)!.icon;
                                                                return <Icon size={40} />;
                                                            })()}
                                                        </div>
                                                    ) : (
                                                        <div className="text-zinc-200 animate-pulse"><User size={40} /></div>
                                                    )}
                                                    <div className="absolute -bottom-3 text-[9px] bg-rose-500 text-white px-3 py-1.5 rounded-xl shadow-lg font-black uppercase tracking-widest">الشريك</div>
                                                </motion.div>
                                            </div>
                                        </div>
                                        
                                        <div className="text-center pt-4">
                                            <p className="text-xl font-black text-foreground/80 tracking-tight h-8 mb-2">
                                                 {partnerMood ? 'توافق القلوب متصل ✨' : 'بصمتك الوجدانية محفوظة'}
                                            </p>
                                            <button onClick={() => setShowMoodPrompt(true)} className="text-[10px] font-black text-rose-500/40 hover:text-rose-500 uppercase tracking-[0.4em] transition-colors bg-rose-500/5 px-6 py-2.5 rounded-2xl border border-rose-500/5">تحديث البوح</button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                         </div>
                    </motion.div>
                </section>

                {/* --- SMART TIMELINE PREVIEW --- */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between px-3">
                         <div className="flex items-center gap-3">
                            <h3 className="text-2xl font-black tracking-tight">محطاتنا القادمة</h3>
                            <span className="bg-rose-500/10 text-rose-500 px-2.5 py-1 rounded-lg text-[10px] font-black">{upcomingEvents.length}</span>
                         </div>
                         <button onClick={() => onNavigate('calendar')} className="flex items-center gap-2 group">
                             <span className="text-[11px] font-black text-rose-500 opacity-60 group-hover:opacity-100 transition-opacity uppercase tracking-widest">السجل الكامل</span>
                             <div className="w-8 h-8 rounded-xl glass border-white/60 flex items-center justify-center text-rose-500 shadow-sm group-hover:bg-rose-500 group-hover:text-white transition-all">
                                <ArrowUpRight size={16} />
                             </div>
                         </button>
                    </div>

                    <div className="space-y-4">
                        {upcomingEvents.map((event, i) => {
                            const eventDate = new Date(event.event_date);
                            const daysLeft = Math.ceil((eventDate.getTime() - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
                            
                            return (
                                <motion.div key={event.id} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} onClick={() => onNavigate('calendar')} className="glass rounded-[2.5rem] p-5 border-white shadow-sm flex items-center justify-between group active:scale-98 transition-all hover:bg-white/60 dark:hover:bg-zinc-800/60 cursor-pointer">
                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 rounded-[1.8rem] bg-rose-50 flex items-center justify-center text-rose-300 group-hover:text-rose-500 overflow-hidden shadow-inner transition-colors">
                                            {event.image_url ? <img src={event.image_url} className="w-full h-full object-cover transition-transform group-hover:scale-110" /> : <Calendar size={24} />}
                                        </div>
                                        <div className="text-right">
                                            <h4 className="font-black text-base text-foreground/80 group-hover:text-foreground transition-colors mb-0.5">{event.title}</h4>
                                            <p className="text-[10px] font-bold text-muted-foreground/50 tracking-wide">{eventDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}</p>
                                        </div>
                                    </div>
                                    <div className={`px-5 py-2.5 rounded-[1.2rem] font-black text-[10px] shadow-lg shadow-rose-500/10 ${daysLeft <= 1 ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/20' : 'bg-rose-50 text-rose-500 border border-rose-100'}`}>
                                        {daysLeft === 0 ? 'اليوم!' : daysLeft === 1 ? 'غداً' : `باقي ${daysLeft} يوم`}
                                    </div>
                                </motion.div>
                            );
                        })}
                        {upcomingEvents.length === 0 && (
                            <div className="py-16 glass rounded-[3rem] border-dashed border-2 flex flex-col items-center justify-center gap-4 opacity-15">
                                <Calendar size={50} />
                                <p className="text-xs font-black uppercase tracking-[0.4em]">لا توجد خطط قريبة..</p>
                            </div>
                        )}
                    </div>
                </section>
            </main>

            {/* --- IMMERSIVE MAP OVERLAY --- */}
            <AnimatePresence>
                {showMap && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-background backdrop-blur-3xl flex flex-col p-6 font-sans">
                         {/* Aura Background */}
                         <div className="absolute inset-x-0 top-0 h-1/2 bg-rose-500/5 blur-[120px] rounded-full -z-10" />

                        <header className="flex items-center justify-between mb-8 px-2 mt-4">
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowMap(false)} className="w-14 h-14 glass rounded-2xl flex items-center justify-center text-rose-500 shadow-xl border-white">
                                <ChevronLeft className="rotate-180" size={24} />
                            </motion.button>
                            <div className="text-right">
                                <h2 className="text-2xl font-black italic tracking-tighter">موقع الروح</h2>
                                <p className="text-[10px] font-black text-rose-500/40 uppercase tracking-[0.5em] leading-none mt-1">اتصال فوري الآن</p>
                            </div>
                        </header>

                        <motion.div initial={{ scale: 0.95, y: 30 }} animate={{ scale: 1, y: 0 }} className="flex-1 rounded-[4rem] overflow-hidden border-[6px] border-white shadow-3xl relative mb-10 group bg-zinc-100 dark:bg-zinc-900 ring-1 ring-black/5">
                            {partnerTracking.lat ? (
                                <iframe width="100%" height="100%" frameBorder="0" style={{ border: 0, filter: isDarkMode ? 'invert(90%) hue-rotate(180deg) contrast(1.1) brightness(0.9)' : 'grayscale(0.1) brightness(1.05)' }} src={`https://maps.google.com/maps?q=${partnerTracking.lat},${partnerTracking.lng}&z=15&output=embed`} />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-5 opacity-30">
                                    <Compass size={80} className="animate-spin-slow text-rose-500" />
                                    <p className="text-sm font-black tracking-widest">جاري الاتصال بالأقمار الوجدانية...</p>
                                </div>
                            )}
                            
                            {/* Map Floating UI */}
                            <div className="absolute top-6 right-6 flex flex-col gap-3">
                                 <button onClick={() => updateMyStatus()} className="w-12 h-12 glass rounded-xl flex items-center justify-center shadow-lg text-rose-500 bg-white/90"><Zap size={20} className={isSyncing ? 'animate-spin' : ''} /></button>
                                 <button className="w-12 h-12 glass rounded-xl flex items-center justify-center shadow-lg text-foreground/40 bg-white/90"><Share2 size={20} /></button>
                            </div>
                        </motion.div>

                        {/* Bottom Info Card */}
                        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="glass rounded-[3.5rem] p-8 flex items-center justify-between border-white shadow-2xl bg-white/60 backdrop-blur-2xl ring-1 ring-black/5">
                             <div className="flex items-center gap-6">
                                <div className="w-22 h-22 rounded-[2.2rem] ring-[6px] ring-white shadow-xl overflow-hidden relative">
                                     {avatars.partner ? <img src={avatars.partner} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-rose-50 flex items-center justify-center text-rose-200"><User size={44} /></div>}
                                     <div className={`absolute top-3 left-3 w-4 h-4 ${isPartnerOnline() ? 'bg-emerald-400 border-2 border-white animate-pulse' : 'bg-zinc-300 border-2 border-white'} rounded-full shadow-lg`} />
                                </div>
                                <div className="text-right">
                                    <h3 className="text-xl font-black mb-1">{isPartnerOnline() ? 'متصل الآن' : formatLastSeen(partnerTracking.last_seen)}</h3>
                                    <div className="flex items-center gap-2 text-rose-600/60 font-black text-xs">
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500/30" />
                                        <span>يبعد عنك {distance}</span>
                                    </div>
                                </div>
                             </div>
                             <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { if (partnerTracking.lat) window.open(`https://www.google.com/maps/dir/?api=1&destination=${partnerTracking.lat},${partnerTracking.lng}`, '_blank'); }} className="w-20 h-20 bg-rose-500 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-rose-500/40 hover:bg-rose-600 group transition-all">
                                <Navigation fill="currentColor" size={30} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                             </motion.button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- DOCK SPACING --- */}
            <div className="h-40" />
        </div>
    );
}
