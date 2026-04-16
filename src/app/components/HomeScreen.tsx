import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Settings, Heart, Sparkles, ChevronLeft, MapPin, Compass, Gift, Moon, Sun, 
    ShieldCheck, Target, Zap, Navigation, User, Calendar, ArrowUpRight, 
    Cloud, Camera, Bell, Share2, Layout, Clock, Feather, Wallet
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
    const [selectedMoodId, setSelectedMoodId] = useState<string | null>(null);
    const [partnerMood, setPartnerMood] = useState<any>(null);
    const [aiRecommendation, setAiRecommendation] = useState<{ title: string; advice: string } | null>(null);
    const [latestNote, setLatestNote] = useState<any>(null);
    const [myCommitments, setMyCommitments] = useState<any[]>([]);
    const [showMap, setShowMap] = useState(false);

    const initialLoadDone = useRef(false);

    // --- LOGIC ---
    const fetchLatestNote = useCallback(async () => {
        if (!partnershipId || !userId) return;
        try {
            const { data, error } = await supabase
                .from('love_notes')
                .select('*, author:users!author_id(name, avatar_url)')
                .eq('partnership_id', partnershipId)
                .neq('author_id', userId) 
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            
            if (data && !error) setLatestNote(data);
        } catch (e) { }
    }, [partnershipId, userId]);

    const fetchMyCommitments = useCallback(async () => {
        if (!partnershipId || !userId) return;
        try {
            const { data, error } = await supabase
                .from('commitments')
                .select('id, title, status, current_count, target_count, period_type, is_active')
                .eq('partnership_id', partnershipId)
                .eq('owner_user_id', userId)
                .eq('is_active', true)
                .neq('status', 'completed')
                .order('created_at', { ascending: false })
                .limit(3);
            if (!error) setMyCommitments(data || []);
        } catch (e) { }
    }, [partnershipId, userId]);

    const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
        try {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const d = R * c;
            if (isNaN(d)) return null;
            return d < 1 ? `${Math.round(d * 1000)} م` : `${d.toFixed(1)} كم`;
        } catch (e) { return null; }
    }, []);

    const updateMyStatus = useCallback(async () => {
        if (!userId) return;
        setIsSyncing(true);
        let lat = null, lng = null;
        try {
            if ("geolocation" in navigator) {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
                });
                lat = position.coords.latitude;
                lng = position.coords.longitude;
                setMyLocation(prev => (prev.lat === lat && prev.lng === lng) ? prev : { lat, lng });
            }
        } catch (e) { }

        await supabase.from('users').update({ 
            last_seen: new Date().toISOString(), 
            ...(lat && lng ? { latitude: lat, longitude: lng } : {}) 
        }).eq('id', userId);
        setTimeout(() => setIsSyncing(false), 500);
    }, [userId]);

    const loadData = useCallback(async () => {
        if (!partnershipId || !userId) return;
        const today = new Date().toISOString().split('T')[0];
        try {
            const { data: p } = await supabase.from('partnerships')
                .select('*, user1:users!user1_id(avatar_url, last_seen, latitude, longitude, name), user2:users!user2_id(avatar_url, last_seen, latitude, longitude, name)')
                .eq('id', partnershipId)
                .maybeSingle();

            if (p) {
                setPartnership(p);
                fetchLatestNote();
                fetchMyCommitments();
                const isUser1 = p.user1_id === userId;
                const partner = isUser1 ? p.user2 : p.user1;
                const partnerId = isUser1 ? p.user2_id : p.user1_id;

                setAvatars({ me: (isUser1 ? p.user1 : p.user2)?.avatar_url, partner: partner?.avatar_url });
                setPartnerTracking({ last_seen: partner?.last_seen, lat: partner?.latitude, lng: partner?.longitude });

                const startStr = p.relationship_start_date || p.created_at;
                const start = new Date(startStr);
                const diff = Math.floor((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                setDaysTogether(isNaN(diff) ? 0 : diff);

                const [{ data: myMood }, { data: pMood }, { data: events }] = await Promise.all([
                    supabase.from('mood_logs').select('mood').eq('user_id', userId).eq('mood_date', today).maybeSingle(),
                    supabase.from('mood_logs').select('mood').eq('user_id', partnerId).eq('mood_date', today).maybeSingle(),
                    supabase.from('calendar_events').select('*').eq('partnership_id', partnershipId).gte('event_date', today).order('event_date', { ascending: true }).limit(3)
                ]);

                if (myMood) { setSelectedMoodId(myMood.mood); setShowMoodPrompt(false); }
                if (pMood) setPartnerMood(pMood.mood);
                setUpcomingEvents(events || []);

                const { data: pLNote } = await supabase.from('love_notes').select('content').eq('author_id', partnerId).order('created_at', { ascending: false }).limit(1).maybeSingle();
                setAiRecommendation(getAIRecommendation({ mood: pMood?.mood || null, lastNote: pLNote?.content || null }));
            }
        } catch (e) { }
    }, [partnershipId, userId, fetchLatestNote, fetchMyCommitments]);

    useEffect(() => {
        if (!partnershipId || !userId) return;
        if (!initialLoadDone.current) {
            loadData();
            updateMyStatus();
            initialLoadDone.current = true;
        }
        const interval = setInterval(() => { loadData(); updateMyStatus(); }, 120000);
        return () => clearInterval(interval);
    }, [userId, partnershipId, loadData, updateMyStatus]);

    const handleMoodSelect = async (moodId: string) => {
        if (!userId) return;
        const today = new Date().toISOString().split('T')[0];
        setSelectedMoodId(moodId);
        setShowMoodPrompt(false);
        try {
            const { data } = await supabase.from('mood_logs').select('id').eq('user_id', userId).eq('mood_date', today).maybeSingle();
            if (data) await supabase.from('mood_logs').update({ mood: moodId }).eq('id', data.id);
            else await supabase.from('mood_logs').insert({ user_id: userId, mood: moodId, mood_date: today });
            loadData();
        } catch (e) { }
    };

    const handleNudge = async () => {
        if (!userId || !partnershipId || !partnership) return;
        setNudgeActive(true);
        setTimeout(() => setNudgeActive(false), 2000);
        try {
            const partnerId = partnership.user1_id === userId ? partnership.user2_id : partnership.user1_id;
            await supabase.from('notifications').insert({ user_id: partnerId, title: 'تنبيه مودة 💖', body: `شريكك يفكر بك الآن! المسافة بينكما: ${distance || '--'}`, type: 'nudge' });
            toast.success('تم إرسال نبضة مودة');
        } catch (e) { }
    };

    useEffect(() => {
        if (partnerTracking.lat && partnerTracking.lng && myLocation.lat && myLocation.lng) {
            const d = calculateDistance(myLocation.lat, myLocation.lng, partnerTracking.lat, partnerTracking.lng);
            setDistance(prev => prev === d ? prev : d);
        }
    }, [myLocation.lat, myLocation.lng, partnerTracking.lat, partnerTracking.lng, calculateDistance]);

    const partnerName = (partnership?.user1_id === userId ? partnership?.user2?.name : partnership?.user1?.name) || 'Habibi';

    const isPartnerOnline = () => {
        if (!partnerTracking.last_seen) return false;
        return (new Date().getTime() - new Date(partnerTracking.last_seen).getTime()) < 120000;
    };

    const formatLastSeen = (lastSeen: string | null) => {
        if (!lastSeen) return 'غير متوفر';
        const date = new Date(lastSeen);
        return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
    };

    const moodsList = useMemo(() => [
        { id: 'happy', icon: Sun, label: 'بخير 😊', color: 'text-amber-500', bg: 'bg-amber-500/10', glow: 'shadow-amber-500/20' },
        { id: 'calm', icon: ShieldCheck, label: 'مرتاح 😌', color: 'text-emerald-500', bg: 'bg-emerald-500/10', glow: 'shadow-emerald-500/20' },
        { id: 'tired', icon: Moon, label: 'تعبان 😴', color: 'text-indigo-500', bg: 'bg-indigo-500/10', glow: 'shadow-indigo-500/20' },
        { id: 'sad', icon: Cloud, label: 'مو بمزاجي 🌧️', color: 'text-rose-500', bg: 'bg-rose-500/10', glow: 'shadow-rose-500/20' },
    ], []);

    return (
        <div dir="rtl" className={`flex flex-col min-h-screen bg-[#f8f9fa] dark:bg-[#080010] overflow-x-hidden pb-32 relative font-sans ${isDarkMode ? 'dark' : ''} safe-top`}>
            {/* --- MESH GRADIENT BACKGROUND --- */}
            <div className="absolute inset-0 -z-20 overflow-hidden pointer-events-none">
                {/* Light mode orbs */}
                <div className="dark:hidden absolute top-[-10%] left-[-10%] w-[55%] h-[55%] bg-rose-400/8 blur-[130px] rounded-full animate-pulse" />
                <div className="dark:hidden absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-400/6 blur-[120px] rounded-full" />
                <div className="dark:hidden absolute top-[30%] right-[-5%] w-[40%] h-[40%] bg-indigo-400/5 blur-[120px] rounded-full" />
                {/* Dark mode — deep cosmic palette */}
                <div className="hidden dark:block absolute top-[-15%] left-[-10%] w-[65%] h-[65%] bg-rose-700/20 blur-[140px] rounded-full" />
                <div className="hidden dark:block absolute bottom-[-20%] right-[-15%] w-[60%] h-[60%] bg-violet-800/15 blur-[140px] rounded-full" />
                <div className="hidden dark:block absolute top-[40%] right-[10%] w-[40%] h-[40%] bg-pink-800/12 blur-[120px] rounded-full" />
                <div className="hidden dark:block absolute top-[60%] left-[5%] w-[35%] h-[35%] bg-rose-900/20 blur-[100px] rounded-full" />
                {/* Subtle noise */}
                <div className="absolute inset-0 opacity-[0.025] mix-blend-overlay" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')" }} />
            </div>

            {/* --- TOP BAR --- */}
            <header className="px-6 pt-8 pb-4 flex items-center justify-between sticky top-0 z-50 bg-white/50 dark:bg-[#080010]/70 backdrop-blur-3xl border-b border-white/60 dark:border-white/5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <div className="flex flex-col">
                    <div className="flex items-center justify-center relative group px-4 py-1">
                        <Heart size={54} className="text-rose-500/10 fill-rose-500/5 absolute -z-10 group-hover:scale-125 group-hover:text-rose-500/20 transition-all duration-1000 ease-out animate-pulse" />
                        <h1 className="text-2xl font-black tracking-[0.2em] text-zinc-900 dark:text-white/95 relative">أُلْفَة</h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => onNavigate('settings')} className="w-11 h-11 rounded-2xl flex items-center justify-center text-zinc-500 dark:text-zinc-300 shadow-sm bg-white/80 dark:bg-white/8 border border-white/70 dark:border-white/10 transition-all hover:bg-white dark:hover:bg-white/15 hover:shadow-md">
                        <Settings size={20} />
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }} className="w-11 h-11 rounded-2xl flex items-center justify-center text-zinc-500 dark:text-zinc-300 shadow-sm bg-white/80 dark:bg-white/8 border border-white/70 dark:border-white/10 transition-all hover:bg-white dark:hover:bg-white/15 hover:shadow-md">
                        <Bell size={20} />
                    </motion.button>
                </div>
            </header>

            <main className="flex-1 px-5 pt-4 space-y-6">
                {/* --- SOUL CONNECTION HERO --- */}
                <section>
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        className="relative bg-white/75 dark:bg-white/[0.04] rounded-[3rem] p-7 border border-white/90 dark:border-white/[0.07] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.06)] dark:shadow-[0_30px_80px_-12px_rgba(244,63,94,0.12)] overflow-visible backdrop-blur-3xl"
                    >
                        <div className="absolute -top-6 -right-6 w-12 h-12 bg-rose-500/10 dark:bg-rose-500/20 blur-2xl rounded-full" />
                        <div className="relative z-10 flex flex-col items-center">
                            

                            {/* Avatars Bridge Container — PREMIUM INFINITY */}
                            <div className="w-full relative mb-12 mt-4">

                                {/* ── INFINITY SVG LAYER ── */}
                                <div className="absolute inset-x-0 top-[50px] -translate-y-1/2 -z-10 pointer-events-none flex justify-center">
                                    <svg viewBox="0 0 400 120" className="w-full max-w-[380px] h-auto overflow-visible">
                                        <defs>
                                            {/* Main gradient */}
                                            <linearGradient id="ig-main" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="#fda4af" stopOpacity="0.9" />
                                                <stop offset="40%" stopColor="#f43f5e" stopOpacity="1" />
                                                <stop offset="60%" stopColor="#e11d48" stopOpacity="1" />
                                                <stop offset="100%" stopColor="#fda4af" stopOpacity="0.9" />
                                            </linearGradient>
                                            {/* Soft glow gradient */}
                                            <linearGradient id="ig-glow" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0" />
                                                <stop offset="50%" stopColor="#f43f5e" stopOpacity="0.35" />
                                                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                                            </linearGradient>
                                            {/* Filter: glow */}
                                            <filter id="glow-filter" x="-30%" y="-50%" width="160%" height="200%">
                                                <feGaussianBlur stdDeviation="6" result="blur" />
                                                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                                            </filter>
                                            <filter id="soft-glow" x="-40%" y="-100%" width="180%" height="300%">
                                                <feGaussianBlur stdDeviation="10" />
                                            </filter>
                                        </defs>

                                        {/* Layer 1 — deep aura blur */}
                                        <path
                                            d="M 200,60 C 140,0 60,0 60,60 C 60,120 140,120 200,60 C 260,0 340,0 340,60 C 340,120 260,120 200,60"
                                            fill="none" stroke="#f43f5e" strokeWidth="18"
                                            strokeLinecap="round" opacity="0.12"
                                            filter="url(#soft-glow)"
                                        />

                                        {/* Layer 2 — mid glow — slow breathe 6s */}
                                        <motion.path
                                            d="M 200,60 C 140,0 60,0 60,60 C 60,120 140,120 200,60 C 260,0 340,0 340,60 C 340,120 260,120 200,60"
                                            fill="none" stroke="url(#ig-glow)" strokeWidth="14"
                                            strokeLinecap="round"
                                            animate={{ opacity: [0.3, 0.7, 0.3] }}
                                            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                                        />

                                        {/* Layer 3 — main crisp stroke — draws in 2.5s */}
                                        <motion.path
                                            d="M 200,60 C 140,0 60,0 60,60 C 60,120 140,120 200,60 C 260,0 340,0 340,60 C 340,120 260,120 200,60"
                                            fill="none"
                                            stroke="url(#ig-main)"
                                            strokeWidth="3.5"
                                            strokeLinecap="round"
                                            initial={{ pathLength: 0, opacity: 0 }}
                                            animate={{ pathLength: 1, opacity: 1 }}
                                            transition={{ pathLength: { duration: 2.5, ease: "easeOut" }, opacity: { duration: 0.8 } }}
                                            filter="url(#glow-filter)"
                                        />

                                        {/* Layer 3b — secondary accent stroke slightly offset for depth */}
                                        <motion.path
                                            d="M 200,60 C 140,0 60,0 60,60 C 60,120 140,120 200,60 C 260,0 340,0 340,60 C 340,120 260,120 200,60"
                                            fill="none"
                                            stroke="#fda4af"
                                            strokeWidth="1"
                                            strokeLinecap="round"
                                            opacity="0.4"
                                            filter="url(#glow-filter)"
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: 1 }}
                                            transition={{ duration: 3, ease: "easeOut", delay: 0.5 }}
                                        />

                                        {/* Layer 4 — dashed shimmer flowing along path — slow 8s */}
                                        <motion.path
                                            d="M 200,60 C 140,0 60,0 60,60 C 60,120 140,120 200,60 C 260,0 340,0 340,60 C 340,120 260,120 200,60"
                                            fill="none"
                                            stroke="white"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeDasharray="6 36"
                                            animate={{ strokeDashoffset: [0, -210] }}
                                            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                                            opacity="0.5"
                                        />

                                        {/* Traveling dot — slow 8s loop */}
                                        <motion.circle r="5" fill="white"
                                            filter="url(#glow-filter)"
                                            style={{ offsetPath: "path('M 200,60 C 140,0 60,0 60,60 C 60,120 140,120 200,60 C 260,0 340,0 340,60 C 340,120 260,120 200,60')" } as any}
                                            animate={{ offsetDistance: ["0%", "100%"] }}
                                            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                                        />
                                        {/* Trailing particle — 25% behind, same 8s */}
                                        <motion.circle r="3" fill="#fda4af" opacity="0.65"
                                            style={{ offsetPath: "path('M 200,60 C 140,0 60,0 60,60 C 60,120 140,120 200,60 C 260,0 340,0 340,60 C 340,120 260,120 200,60')" } as any}
                                            animate={{ offsetDistance: ["25%", "125%"] }}
                                            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                                        />
                                        {/* Third particle — 50% behind */}
                                        <motion.circle r="2" fill="#f43f5e" opacity="0.4"
                                            style={{ offsetPath: "path('M 200,60 C 140,0 60,0 60,60 C 60,120 140,120 200,60 C 260,0 340,0 340,60 C 340,120 260,120 200,60')" } as any}
                                            animate={{ offsetDistance: ["50%", "150%"] }}
                                            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                                        />
                                    </svg>
                                </div>

                                {/* ── AVATARS & HEART ROW ── */}
                                <div className="flex items-center justify-center gap-6 relative z-10 px-4">

                                    {/* My Avatar */}
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="relative">
                                            {/* Pulsing outer ring */}
                                            <motion.div
                                                className="absolute inset-0 rounded-full"
                                                style={{ background: 'conic-gradient(from 0deg, #f43f5e, #fda4af, #f43f5e)', padding: '3px' }}
                                                animate={{ rotate: 360 }}
                                                transition={{ repeat: Infinity, duration: 14, ease: "linear" }}
                                            >
                                                <div className="w-full h-full rounded-full bg-white dark:bg-zinc-900" />
                                            </motion.div>
                                            {/* Soft glow halo */}
                                            <motion.div
                                                className="absolute -inset-2 rounded-full bg-rose-400/20 blur-md"
                                                animate={{ scale: [1, 1.12, 1], opacity: [0.3, 0.6, 0.3] }}
                                                transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
                                            />
                                            <div className="w-[78px] h-[78px] rounded-full overflow-hidden relative z-10 border-[3px] border-white dark:border-zinc-900 shadow-xl bg-zinc-50">
                                                {avatars.me
                                                    ? <img src={avatars.me} className="w-full h-full object-cover" alt="me" />
                                                    : <div className="w-full h-full flex items-center justify-center text-rose-300"><User size={30} /></div>}
                                            </div>
                                            {/* Online dot */}
                                            <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-emerald-400 ring-2 ring-white z-20 shadow-md" />
                                        </div>
                                        {/* Status badge */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.3 }}
                                            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-600 px-3.5 py-1.5 rounded-full border border-emerald-200/60 shadow-sm"
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                                            <span className="text-[9px] font-black uppercase tracking-wider">أنت متصل</span>
                                        </motion.div>
                                    </div>

                                    {/* ── CENTER HEART BUTTON ── */}
                                    <div className="flex flex-col items-center justify-center -mx-1">
                                        <motion.div
                                            onClick={handleNudge}
                                            whileHover={{ scale: 1.08 }}
                                            whileTap={{ scale: 0.82 }}
                                            className="relative cursor-pointer"
                                        >
                                            {/* Ripple on nudge */}
                                            {nudgeActive && (
                                                <motion.div
                                                    className="absolute inset-0 rounded-full bg-rose-400"
                                                    initial={{ scale: 1, opacity: 0.5 }}
                                                    animate={{ scale: 2.5, opacity: 0 }}
                                                    transition={{ duration: 0.7 }}
                                                />
                                            )}
                                            {/* Subtle glow ring */}
                                            <motion.div
                                                className="absolute -inset-2 rounded-full bg-gradient-to-br from-rose-400/30 to-pink-400/20 blur-lg"
                                                animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
                                                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                                            />
                                            <div className="w-[54px] h-[54px] rounded-full bg-white dark:bg-zinc-900 shadow-2xl border border-rose-100/80 flex items-center justify-center relative z-10">
                                                <motion.div
                                                    animate={{ scale: nudgeActive ? [1, 1.35, 0.9, 1.15, 1] : [1, 1.06, 1] }}
                                                    transition={nudgeActive
                                                        ? { duration: 0.55 }
                                                        : { repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                                                >
                                                    <Heart size={26}
                                                        className={`transition-colors duration-300 ${nudgeActive ? 'text-rose-500 fill-rose-500' : 'text-rose-400 fill-rose-400/20'}`}
                                                    />
                                                </motion.div>
                                            </div>
                                        </motion.div>
                                    </div>

                                    {/* Partner Avatar */}
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="relative">
                                            {/* Static gradient ring */}
                                            <div
                                                className="absolute inset-0 rounded-full"
                                                style={{ background: 'conic-gradient(from 180deg, #fda4af, #f43f5e, #fda4af)', padding: '3px' }}
                                            >
                                                <div className="w-full h-full rounded-full bg-white dark:bg-zinc-900" />
                                            </div>
                                            {/* Soft glow halo */}
                                            <motion.div
                                                className="absolute -inset-2 rounded-full bg-rose-400/15 blur-md"
                                                animate={{ scale: [1, 1.1, 1], opacity: [0.25, 0.5, 0.25] }}
                                                transition={{ repeat: Infinity, duration: 6, ease: "easeInOut", delay: 1 }}
                                            />
                                            <div className="w-[78px] h-[78px] rounded-full overflow-hidden relative z-10 border-[3px] border-white dark:border-zinc-900 shadow-xl bg-zinc-50">
                                                {avatars.partner
                                                    ? <img src={avatars.partner} className="w-full h-full object-cover" alt="partner" />
                                                    : <div className="w-full h-full flex items-center justify-center text-rose-200"><User size={30} /></div>}
                                            </div>
                                            {/* Online/offline dot */}
                                            <div className={`absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full ring-2 ring-white z-20 shadow-md transition-colors ${isPartnerOnline() ? 'bg-emerald-400' : 'bg-zinc-300'}`} />
                                        </div>
                                        {/* Status badge */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.4 }}
                                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border shadow-sm ${
                                                isPartnerOnline()
                                                    ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-600 border-emerald-200/60'
                                                    : 'bg-white/70 text-zinc-500 border-zinc-200/60 backdrop-blur-md'
                                            }`}
                                        >
                                            {isPartnerOnline() && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />}
                                            <span className="text-[9px] font-black uppercase tracking-wider">
                                                {isPartnerOnline() ? 'متصل الآن' : formatLastSeen(partnerTracking.last_seen)}
                                            </span>
                                        </motion.div>
                                    </div>

                                </div>
                            </div>

                            {/* Stats & Actions */}
                            <div className="grid grid-cols-2 gap-5 w-full mb-8">
                                <motion.div whileHover={{ y: -2 }} className="bg-white/50 dark:bg-white/[0.05] rounded-[2.2rem] p-6 flex flex-col items-center justify-center border border-white/80 dark:border-white/[0.08] shadow-sm transition-all hover:bg-white/70 dark:hover:bg-white/[0.09]">
                                    <div className="flex items-center gap-2 mb-2 text-rose-500/70 dark:text-rose-400/70"><Clock size={14} /><span className="text-[10px] font-black uppercase tracking-widest">معاً منذ</span></div>
                                    <div className="flex items-baseline gap-1.5"><span className="text-3xl font-black text-rose-950/80 dark:text-white">{daysTogether}</span><span className="text-[11px] font-black text-rose-500/50 dark:text-rose-400/50 uppercase">يوم</span></div>
                                </motion.div>
                                <motion.div whileHover={{ y: -2 }} className="bg-white/50 dark:bg-white/[0.05] rounded-[2.2rem] p-6 flex flex-col items-center justify-center border border-white/80 dark:border-white/[0.08] shadow-sm transition-all hover:bg-white/70 dark:hover:bg-white/[0.09]">
                                    <div className="flex items-center gap-2 mb-2 text-rose-500/70 dark:text-rose-400/70"><Compass size={14} /><span className="text-[10px] font-black uppercase tracking-widest">المسافة</span></div>
                                    <h2 className="text-3xl font-black text-rose-950/80 dark:text-white tracking-tight">{distance || '--'}</h2>
                                </motion.div>
                            </div>

                            <div className="flex items-center gap-4 w-full">
                                <motion.div 
                                    whileTap={{ scale: 0.97 }} 
                                    onClick={() => setShowMap(true)} 
                                    className="flex-1 h-15 bg-gradient-to-r from-rose-500 to-rose-600 dark:from-rose-600 dark:to-rose-700 rounded-[1.8rem] flex items-center justify-center gap-3 text-white font-black shadow-[0_15px_30px_rgba(244,63,94,0.35)] dark:shadow-[0_15px_40px_rgba(244,63,94,0.25)] cursor-pointer py-4"
                                >
                                    <MapPin size={20} /><span className="text-[15px] font-black">الخريطة الحية</span>
                                </motion.div>
                                <motion.div 
                                    whileTap={{ scale: 0.92 }} 
                                    onClick={handleNudge} 
                                    className="w-15 h-15 bg-white dark:bg-white/10 rounded-[1.8rem] flex items-center justify-center text-rose-500 dark:text-rose-400 shadow-xl dark:shadow-rose-900/20 border border-rose-50 dark:border-white/10 group transition-all hover:bg-rose-50 dark:hover:bg-white/15 cursor-pointer p-4"
                                >
                                    <Zap size={24} className="group-hover:animate-bounce" />
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>
                </section>

                {/* ── مهامي اليوم — QUICK COMMITMENTS PREVIEW ── */}
                <section>
                    <motion.div
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onNavigate('commitments')}
                        className="bg-white/60 dark:bg-white/[0.05] rounded-[2.4rem] border border-blue-100/50 dark:border-blue-900/20 shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md group"
                    >
                        {/* Header row */}
                        <div className="flex items-center justify-between px-6 pt-6 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 dark:bg-blue-500/15 flex items-center justify-center text-blue-500 dark:text-blue-400 shadow-sm transition-transform group-hover:rotate-6">
                                    <Target size={20} />
                                </div>
                                <div>
                                    <h3 className="text-[15px] font-black text-zinc-800 dark:text-white/90 tracking-tight leading-none">مهامي اليوم</h3>
                                    <p className="text-[9px] font-bold text-blue-500/50 dark:text-blue-400/50 uppercase tracking-widest mt-0.5">ميثاق الغلا</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {myCommitments.length > 0 && (
                                    <span className="bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[9px] font-black px-2.5 py-1 rounded-full border border-blue-400/20">
                                        {myCommitments.length} نشطة
                                    </span>
                                )}
                                <div className="w-8 h-8 rounded-xl bg-white/60 dark:bg-white/[0.07] border border-white dark:border-white/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                    <ChevronLeft size={16} className="rotate-180" />
                                </div>
                            </div>
                        </div>

                        {/* Tasks list or empty CTA */}
                        {myCommitments.length === 0 ? (
                            <div className="px-6 pb-6">
                                <div className="bg-blue-50/60 dark:bg-blue-500/[0.07] rounded-2xl px-4 py-3 border border-blue-100/40 dark:border-blue-500/10 flex items-center gap-3">
                                    <span className="text-xl">🤝</span>
                                    <p className="text-[12px] font-bold text-blue-500/60 dark:text-blue-400/50">أضف أول ميثاق مودة لك</p>
                                </div>
                            </div>
                        ) : (
                            <div className="px-6 pb-6 space-y-3">
                                {myCommitments.map((c) => {
                                    const current = Number(c.current_count) || 0;
                                    const target = Number(c.target_count) || 1;
                                    const pct = Math.min(100, Math.round((current / target) * 100));
                                    const periodMap: Record<string, string> = { daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري' };
                                    const statusColor = c.status === 'completed' ? 'bg-emerald-500' : c.status === 'at-risk' ? 'bg-amber-500' : 'bg-blue-500';
                                    return (
                                        <div key={c.id} className="bg-white/50 dark:bg-white/[0.04] rounded-2xl px-4 py-3 border border-white/70 dark:border-white/[0.06]">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-base">🎯</span>
                                                    <span className="text-[13px] font-black text-zinc-800 dark:text-white/90 truncate">{c.title}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0 mr-2">
                                                    <span className="text-[9px] font-bold text-zinc-400 dark:text-white/30">{periodMap[c.period_type] || ''}</span>
                                                    <span className="text-[9px] font-black text-blue-600 dark:text-blue-400">{current}/{target}</span>
                                                </div>
                                            </div>
                                            <div className="h-1.5 bg-zinc-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                                                <motion.div
                                                    className={`h-full rounded-full ${statusColor}`}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${pct}%` }}
                                                    transition={{ duration: 1, ease: 'easeOut' }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                </section>

                {/* --- BENTO GRID SECTIONS --- */}
                <section className="grid grid-cols-2 gap-5 px-1">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }} 
                        whileInView={{ opacity: 1, scale: 1 }} 
                        whileTap={{ scale: 0.97 }}
                        viewport={{ once: true }} 
                        onClick={() => onNavigate('adventure_bucket')} 
                        className="col-span-1 bg-white/60 dark:bg-white/[0.05] rounded-[2.2rem] p-6 border border-white/80 dark:border-white/[0.08] shadow-sm bg-amber-500/[0.03] flex flex-col gap-5 group cursor-pointer transition-all hover:bg-white dark:hover:bg-white/[0.09] hover:shadow-md"
                    >
                        <div className="flex items-center justify-between">
                             <div className="w-11 h-11 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400 transition-transform group-hover:rotate-6 shadow-sm"><Compass size={22} /></div>
                             <ArrowUpRight size={16} className="text-amber-500/30 group-hover:text-amber-400 dark:group-hover:text-amber-400 transition-colors" />
                        </div>
                        <div>
                            <h3 className="text-[16px] font-black text-zinc-800 dark:text-white/90 leading-none mb-1.5">أفق أحلامنا</h3>
                            <p className="text-[10px] font-bold text-amber-600/50 dark:text-amber-500/60 uppercase tracking-widest">بوصلة الشغف</p>
                        </div>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }} 
                        whileInView={{ opacity: 1, scale: 1 }} 
                        whileTap={{ scale: 0.97 }}
                        viewport={{ once: true }} 
                        onClick={() => onNavigate('wishlist')} 
                        className="col-span-1 bg-white/60 dark:bg-white/[0.05] rounded-[2.2rem] p-6 border border-white/80 dark:border-white/[0.08] shadow-sm bg-indigo-500/[0.03] flex flex-col gap-5 group cursor-pointer transition-all hover:bg-white dark:hover:bg-white/[0.09] hover:shadow-md"
                    >
                        <div className="flex items-center justify-between">
                             <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-500 dark:text-indigo-400 transition-transform group-hover:scale-110 shadow-sm"><Gift size={22} /></div>
                             <ArrowUpRight size={16} className="text-indigo-500/30 group-hover:text-indigo-400 transition-colors" />
                        </div>
                        <div>
                            <h3 className="text-[16px] font-black text-zinc-800 dark:text-white/90 leading-none mb-1.5">صندوق الأمنيات</h3>
                            <p className="text-[10px] font-bold text-indigo-600/40 dark:text-indigo-400/50 uppercase tracking-widest">موالح الهدايا</p>
                        </div>
                    </motion.div>

                    {/* ── بذرة مودة — PREMIUM SEED CARD (AMBER-GOLD) ── */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="col-span-2 relative overflow-hidden rounded-[2.6rem] border border-amber-200/50 dark:border-amber-800/25"
                        style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.80) 0%, rgba(255,251,235,0.65) 50%, rgba(255,255,255,0.75) 100%)',
                        }}
                    >
                        {/* Dark mode bg override */}
                        <div className="absolute inset-0 hidden dark:block rounded-[2.6rem]"
                            style={{ background: 'linear-gradient(135deg, rgba(120,53,15,0.20) 0%, rgba(78,35,8,0.14) 60%, rgba(92,45,10,0.08) 100%)' }} />

                        {/* Background SVG decoration — abstract arcs / orbits */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.07] dark:opacity-[0.10]" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice">
                            <circle cx="340" cy="30" r="80" fill="none" stroke="#f59e0b" strokeWidth="18" />
                            <circle cx="340" cy="30" r="55" fill="none" stroke="#d97706" strokeWidth="8" />
                            <circle cx="340" cy="30" r="30" fill="#fbbf24" opacity="0.5" />
                            <path d="M 0,160 Q 80,120 160,150 Q 240,180 320,140 Q 380,110 400,130" stroke="#f59e0b" strokeWidth="2" fill="none" />
                            <path d="M 0,180 Q 100,150 200,170 Q 300,185 400,160" stroke="#fbbf24" strokeWidth="1.5" fill="none" />
                        </svg>

                        {/* Glow orbs */}
                        <motion.div
                            className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-amber-400/25 dark:bg-amber-500/18 blur-3xl rounded-full pointer-events-none"
                            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.85, 0.5] }}
                            transition={{ repeat: Infinity, duration: 5.5, ease: 'easeInOut' }}
                        />
                        <div className="absolute bottom-[-15px] left-[-10px] w-28 h-28 bg-orange-300/15 dark:bg-orange-500/10 blur-3xl rounded-full pointer-events-none" />

                        {/* Shimmer sweep */}
                        <motion.div
                            className="absolute inset-0 pointer-events-none"
                            style={{ background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.28) 50%, transparent 70%)' }}
                            animate={{ x: ['-100%', '200%'] }}
                            transition={{ repeat: Infinity, duration: 6, ease: 'linear', repeatDelay: 5 }}
                        />

                        <div className="relative z-10 p-7 flex gap-5 items-start">
                            {/* Seed orb */}
                            <div className="shrink-0 flex flex-col items-center gap-2.5 mt-1">
                                <div className="relative">
                                    <motion.div
                                        className="absolute -inset-3 rounded-full bg-amber-400/25 dark:bg-amber-500/30 blur-lg"
                                        animate={{ scale: [1, 1.28, 1], opacity: [0.4, 0.75, 0.4] }}
                                        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                                    />
                                    <div className="relative w-16 h-16 rounded-[1.6rem] bg-gradient-to-br from-amber-400 via-orange-400 to-amber-500 shadow-xl shadow-amber-500/35 flex items-center justify-center">
                                        <motion.span
                                            className="text-3xl select-none"
                                            animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                                            transition={{ repeat: Infinity, duration: 5.5, ease: 'easeInOut' }}
                                        >
                                            {aiRecommendation?.title?.includes('🕊') ? '🕊️'
                                                : aiRecommendation?.title?.includes('☕') ? '☕'
                                                : aiRecommendation?.title?.includes('🌟') ? '🌟'
                                                : aiRecommendation?.title?.includes('✍') ? '✍️'
                                                : '🌱'}
                                        </motion.span>
                                    </div>
                                </div>
                                {/* Today's Arabic day name */}
                                <div className="bg-amber-500/12 dark:bg-amber-400/15 border border-amber-400/25 dark:border-amber-500/25 rounded-xl px-2.5 py-1 text-center">
                                    <span className="text-[9px] font-black text-amber-700 dark:text-amber-400 tracking-wide">
                                        {['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][new Date().getDay()]}
                                    </span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                {/* Title pill */}
                                <div className="inline-flex items-center gap-2 bg-amber-500/10 dark:bg-amber-500/18 border border-amber-400/25 dark:border-amber-500/30 rounded-full px-3 py-1 mb-3">
                                    <motion.span
                                        className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 inline-block"
                                        animate={{ scale: [1, 1.6, 1], opacity: [0.7, 1, 0.7] }}
                                        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                                    />
                                    <span className="text-[9px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest">
                                        {aiRecommendation?.title || 'بذرة مودة 🌱'}
                                    </span>
                                </div>
                                {/* Advice text */}
                                <p className="text-[14px] font-bold text-zinc-700 dark:text-white/87 leading-[1.85] tracking-wide">
                                    {aiRecommendation?.advice || 'كن بجانب شريكك دائماً بالكلمة الطيبة والمشاعر الصادقة.'}
                                </p>
                                {/* Footer */}
                                <div className="flex items-center gap-2 mt-4 opacity-45">
                                    <div className="h-px flex-1 bg-gradient-to-r from-amber-500/50 to-transparent" />
                                    <span className="text-[9px] font-black text-amber-700 dark:text-amber-500 tracking-[0.3em]">نصيحة اليوم</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    <div className="col-span-2 flex items-center gap-4 px-2 mt-4">
                         <h3 className="text-xl font-black tracking-tight text-zinc-800 dark:text-white/90 uppercase">البريد الوجداني</h3>
                         <div className="h-px flex-1 bg-gradient-to-r from-rose-500/30 dark:from-rose-500/40 to-transparent" />
                    </div>

                    <motion.div 
                        whileTap={{ scale: 0.98 }} 
                        onClick={() => onNavigate('love_notes')} 
                        className="col-span-2 relative group cursor-pointer"
                    >
                        <div className="absolute -inset-4 bg-rose-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-full" />
                        <div className="relative aspect-[4/3] w-full max-w-[320px] mx-auto select-none perspective-1000">
                            <motion.div whileHover={{ rotateY: 2, rotateX: 2 }} className="w-full h-full transition-transform duration-500">
                                <img src="/assets/love_notes/card-base.png" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-0 drop-shadow-2xl" />
                                {latestNote ? (
                                    <div className="absolute inset-0 flex items-center justify-center z-10 px-[15%] pt-[5%] pb-[15%]">
                                        <div className="relative w-full h-full flex items-center justify-center rotate-[-1.5deg]">
                                            <img src="/assets/love_notes/card-paper.png" className="absolute inset-0 w-full h-full object-contain shadow-sm" />
                                            {(() => {
                                                const isAuthor = latestNote.author_id === userId;
                                                const [rawFont] = latestNote.font_style?.split('|') || [latestNote.font_style || 'font-ruqaa'];
                                                const fontClass = (rawFont === 'font-cedarville') ? 'font-cedarville' : 'font-ruqaa';
                                                return (
                                                    <div className="relative z-20 w-[85%] h-[65%] flex flex-col items-center justify-center p-4 text-center overflow-hidden">
                                                        <p className={`text-[1.1rem] text-black/80 leading-snug line-clamp-3 ${fontClass}`}>{latestNote.content}</p>
                                                        <div className="flex items-center gap-2 mt-3 opacity-40">
                                                            <div className="h-px w-3 bg-black" />
                                                            <span className={`text-[0.7rem] italic ${fontClass}`}>{isAuthor ? 'أنا' : (latestNote.author?.name || 'شريك حياتي')}</span>
                                                            <div className="h-px w-3 bg-black" />
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center z-20"><p className="text-[11px] font-black text-rose-500/40 uppercase tracking-[0.3em] text-center bg-rose-500/5 px-4 py-2 rounded-full border border-rose-500/10">أضف بسمتك الوجدانية</p></div>
                                )}
                            </motion.div>
                        </div>
                    </motion.div>
                </section>

                <section>
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        whileInView={{ opacity: 1 }} 
                        viewport={{ once: true }} 
                        className="bg-white/65 dark:bg-white/[0.04] rounded-[2.8rem] p-9 relative overflow-visible border border-white/80 dark:border-white/[0.07] shadow-xl dark:shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
                    >
                        <div className="absolute top-[-20px] left-10 w-40 h-40 bg-rose-500/8 dark:bg-rose-600/15 blur-[60px] rounded-full pointer-events-none animate-pulse" />
                        <div className="relative z-10 flex flex-col items-center gap-10">
                            <div className="text-center">
                                <h3 className="text-2xl font-black tracking-tight mb-2 text-zinc-800 dark:text-white/90">كيف حالك؟ 🫶</h3>
                                <div className="flex items-center justify-center gap-3">
                                    <div className="h-px w-6 bg-gradient-to-r from-transparent to-rose-500/30" />
                                    <p className="text-[10px] font-black text-rose-500/50 uppercase tracking-[0.5em]">مزاجك اليوم</p>
                                    <div className="h-px w-6 bg-gradient-to-l from-transparent to-rose-500/30" />
                                </div>
                            </div>
                            <AnimatePresence mode="wait">
                                {showMoodPrompt ? (
                                    <motion.div key="mood-grid" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex flex-wrap justify-center gap-6">
                                        {moodsList.map((m) => {
                                            const MoodIconComp = m.icon;
                                            return (
                                                <motion.button 
                                                    key={m.id} 
                                                    onClick={() => handleMoodSelect(m.id)} 
                                                    whileHover={{ y: -6, scale: 1.05 }} 
                                                    whileTap={{ scale: 0.95 }} 
                                                    className="flex flex-col items-center gap-4 group/mood"
                                                >
                                                    <div className={`w-16 h-16 rounded-[1.8rem] glass flex items-center justify-center ${m.color} shadow-lg border-white bg-white/90 dark:bg-zinc-800/90 transition-all group-hover/mood:shadow-rose-500/10`}><MoodIconComp size={28} /></div>
                                                    <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{m.label}</span>
                                                </motion.button>
                                            );
                                        })}
                                    </motion.div>
                                ) : (
                                    <motion.div key="mood-saved" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-8 w-full max-w-[320px]">
                                        <div className="flex items-center justify-between w-full relative h-24">
                                            <div className="absolute left-1/2 top-12 -translate-x-1/2 w-40 h-px bg-gradient-to-r from-transparent via-rose-500/30 to-transparent" />
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-18 h-18 glass rounded-[2rem] border-rose-500/30 flex items-center justify-center text-rose-500 shadow-xl relative bg-white ring-8 ring-rose-500/5">
                                                    {(() => { const mood = moodsList.find(m => m.id === selectedMoodId); const ActiveIcon = mood ? mood.icon : Sun; return <ActiveIcon size={32} />; })()}
                                                    <div className="absolute -bottom-3 text-[9px] bg-emerald-500 text-white px-3 py-1.5 rounded-xl shadow-lg font-black uppercase tracking-widest">أنا</div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-18 h-18 glass rounded-[2rem] border-rose-500/30 flex items-center justify-center shadow-xl relative bg-white ring-8 ring-rose-500/5">
                                                    {partnerMood ? (
                                                        <div className="text-rose-500">
                                                            {(() => { const pMoodObj = moodsList.find(m => m.id === partnerMood); const PartnerIcon = pMoodObj ? pMoodObj.icon : Heart; return <PartnerIcon size={32} />; })()}
                                                        </div>
                                                    ) : (
                                                        <div className="text-zinc-200 animate-pulse"><User size={32} /></div>
                                                    )}
                                                    <div className="absolute -bottom-3 text-[9px] bg-rose-500 text-white px-3 py-1.5 rounded-xl shadow-lg font-black uppercase tracking-widest">الشريك</div>
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={() => setShowMoodPrompt(true)} className="text-[11px] font-black text-rose-600/60 hover:text-rose-600 uppercase tracking-widest transition-all bg-rose-500/5 px-7 py-3 rounded-2xl border border-rose-500/10 hover:bg-rose-500/10">تعديل المزاج</button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </section>

                <section className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-black tracking-tight text-foreground/90 uppercase">محطاتنا القادمة</h3>
                            <span className="bg-rose-500/10 text-rose-500 px-3 py-1 rounded-full text-[10px] font-black shadow-sm">
                                {upcomingEvents.length}
                            </span>
                        </div>
                        <button onClick={() => onNavigate('calendar')} className="flex items-center gap-3 group">
                            <span className="text-[11px] font-black text-rose-500 opacity-60 group-hover:opacity-100 transition-opacity uppercase tracking-widest">السجل</span>
                            <div className="w-9 h-9 rounded-2xl glass border-white flex items-center justify-center text-rose-500 shadow-sm group-hover:bg-rose-500 group-hover:text-white transition-all">
                                <ArrowUpRight size={18} />
                            </div>
                        </button>
                    </div>
                    <div className="space-y-4">
                        {upcomingEvents.map((event, i) => {
                            const eventDate = new Date(event.event_date);
                            const daysLeft = Math.ceil((eventDate.getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
                            return (
                                <motion.div 
                                    key={event.id} 
                                    initial={{ opacity: 0, x: -15 }} 
                                    whileInView={{ opacity: 1, x: 0 }} 
                                    transition={{ delay: i * 0.1 }} 
                                    onClick={() => onNavigate('calendar')} 
                                    className="glass rounded-[2rem] p-5 border-white shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all hover:bg-white hover:shadow-md cursor-pointer"
                                >
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-400 group-hover:rotate-3 overflow-hidden shadow-inner transition-transform border border-rose-100/30">
                                            {event.image_url ? <img src={event.image_url} className="w-full h-full object-cover" /> : <Calendar size={24} />}
                                        </div>
                                        <div className="text-right">
                                            <h4 className="font-black text-[16px] text-foreground/90 group-hover:text-foreground transition-colors leading-none mb-1.5">{event.title}</h4>
                                            <p className="text-[10px] font-bold text-muted-foreground/40 tracking-wider uppercase">
                                                {eventDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`px-5 py-2.5 rounded-2xl font-black text-[10px] shadow-sm transition-all ${
                                        daysLeft <= 1 
                                            ? 'bg-gradient-to-br from-rose-500 to-rose-600 text-white animate-pulse shadow-rose-500/20' 
                                            : 'bg-white text-rose-600 border border-rose-100'
                                    }`}>
                                        {daysLeft === 0 ? 'اليوم!' : daysLeft === 1 ? 'غداً' : `باقي ${daysLeft} يوم`}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </section>
            </main>

            <AnimatePresence>
                {showMap && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-background backdrop-blur-3xl flex flex-col p-8 font-sans">
                         <div className="absolute inset-x-0 top-0 h-1/2 bg-rose-500/5 blur-[120px] rounded-full -z-10" />
                        <header className="flex items-center justify-between mb-8 px-2 mt-4"><motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowMap(false)} className="w-14 h-14 glass rounded-[1.5rem] flex items-center justify-center text-rose-500 shadow-xl border-white"><ChevronLeft className="rotate-180" size={24} /></motion.button><div className="text-right"><h2 className="text-2xl font-black italic tracking-tighter">موقع الروح</h2><p className="text-[10px] font-black text-rose-500/40 uppercase tracking-[0.5em] leading-none mt-1">اتصال فوري الآن</p></div></header>
                        <motion.div initial={{ scale: 0.95, y: 30 }} animate={{ scale: 1, y: 0 }} className="flex-1 rounded-[3.8rem] overflow-hidden border-[6px] border-white shadow-3xl relative mb-10 bg-zinc-100 ring-2 ring-black/5">
                            {partnerTracking.lat ? (
                                <iframe width="100%" height="100%" frameBorder="0" style={{ border: 0 }} src={`https://maps.google.com/maps?q=${partnerTracking.lat},${partnerTracking.lng}&z=15&output=embed`} />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-5 opacity-30"><Compass size={80} className="animate-spin-slow text-rose-500" /><p className="text-base font-black tracking-widest">جاري البحث...</p></div>
                            )}
                        </motion.div>
                        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass rounded-[3.5rem] p-8 flex items-center justify-between border-white shadow-2xl bg-white/80 ring-1 ring-black/5">
                             <div className="flex items-center gap-6"><div className="w-20 h-20 rounded-full ring-[6px] ring-white shadow-xl overflow-hidden relative">{avatars.partner ? <img src={avatars.partner} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-rose-50 flex items-center justify-center text-rose-200"><User size={40} /></div>}</div><div className="text-right"><h3 className="text-xl font-black mb-1">{isPartnerOnline() ? 'متصل الآن' : formatLastSeen(partnerTracking.last_seen)}</h3><p className="text-rose-600/60 font-black text-xs">يبعد عنك {distance}</p></div></div>
                             <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { if (partnerTracking.lat) window.open(`https://www.google.com/maps/dir/?api=1&destination=${partnerTracking.lat},${partnerTracking.lng}`, '_blank'); }} className="w-20 h-20 bg-rose-500 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-rose-500/40"><Navigation fill="currentColor" size={30} /></motion.button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
