import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Settings, Heart, Sparkles, ChevronLeft, MapPin, Compass, Gift, Moon, Sun,
    ShieldCheck, Target, Zap, Navigation, User, Calendar, ArrowUpRight,
    Cloud, Camera, Bell, Share2, Layout, Clock, Feather, Wallet, Lock, Music, Armchair, Mail, LayoutGrid, Smile, UtensilsCrossed
} from 'lucide-react';
import { Logo } from './Logo';
import { Button } from './ui/button';
import { supabase } from '../../lib/supabase';
import { getAIRecommendation } from '../../utils/aiAdvisor';
import { FloatingChatbot } from './FloatingChatbot';
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
    const [statsCount, setStatsCount] = useState({ notes: 0, commitments: 0, goals: 0, songs: 0, memories: 0, adventures: 0 });
    const [monthlyMoods, setMonthlyMoods] = useState<Record<string, string>>({});

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
        let lat: number | null = null, lng: number | null = null;
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
            ...(lat !== null && lng !== null ? { latitude: lat, longitude: lng } : {})
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
                setPartnerTracking(prev => {
                    const next = { last_seen: partner?.last_seen, lat: partner?.latitude, lng: partner?.longitude };
                    if (prev.last_seen === next.last_seen && prev.lat === next.lat && prev.lng === next.lng) return prev;
                    return next;
                });

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

                // Map partner's mood history too? No, let's keep it to their current mood as requested for now.

                // Fetch monthly moods for the calendar
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                
                const { data: monthLogs } = await supabase
                    .from('mood_logs')
                    .select('mood, mood_date')
                    .eq('user_id', userId)
                    .gte('mood_date', startOfMonth)
                    .lte('mood_date', endOfMonth);

                if (monthLogs) {
                    const moodMap: Record<string, string> = {};
                    monthLogs.forEach(log => {
                        moodMap[log.mood_date] = log.mood;
                    });
                    setMonthlyMoods(moodMap);
                }

                // Fetch stats for عداد اللحظات و بستان ألفة
                const [
                    { count: notesCount },
                    { count: commitmentsCount },
                    { count: goalsCount },
                    { count: songsCount },
                    { count: memoriesCount },
                    { count: adventuresCount }
                ] = await Promise.all([
                    supabase.from('love_notes').select('*', { count: 'exact', head: true }).eq('partnership_id', partnershipId),
                    supabase.from('commitments').select('*', { count: 'exact', head: true }).eq('partnership_id', partnershipId),
                    supabase.from('finance_jars').select('*', { count: 'exact', head: true }).eq('partnership_id', partnershipId),
                    supabase.from('playlist_songs').select('*', { count: 'exact', head: true }).eq('partnership_id', partnershipId),
                    supabase.from('memories').select('*', { count: 'exact', head: true }).eq('partnership_id', partnershipId),
                    supabase.from('adventure_items').select('*', { count: 'exact', head: true }).eq('partnership_id', partnershipId).eq('status', 'completed'),
                ]);
                setStatsCount(prev => {
                    const next = {
                        notes: notesCount || 0,
                        commitments: commitmentsCount || 0,
                        goals: goalsCount || 0,
                        songs: songsCount || 0,
                        memories: memoriesCount || 0,
                        adventures: adventuresCount || 0
                    };
                    if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
                    return next;
                });

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
        if (partnerTracking.lat !== null && partnerTracking.lng !== null && myLocation.lat !== null && myLocation.lng !== null) {
            const d = calculateDistance(myLocation.lat, myLocation.lng, partnerTracking.lat, partnerTracking.lng);
            setDistance(prev => prev === d ? prev : d);
        }
    }, [myLocation.lat, myLocation.lng, partnerTracking.lat, partnerTracking.lng, calculateDistance]);

    const partnerName = (partnership?.user1_id === userId ? partnership?.user2?.name : partnership?.user1?.name) || 'الشريك';

    const isPartnerOnline = () => {
        if (!partnerTracking.last_seen) return false;
        return (new Date().getTime() - new Date(partnerTracking.last_seen).getTime()) < 120000;
    };

    const formatLastSeen = (lastSeen: string | null) => {
        if (!lastSeen) return 'غير متوفر';
        const date = new Date(lastSeen);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);

        if (diffMins < 1) return 'الآن';
        if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
        if (diffHours < 24) return `منذ ${diffHours} ${diffHours === 1 ? 'ساعة' : diffHours < 11 ? 'ساعات' : 'ساعة'}`;
        
        return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
    };

    const moodsList = useMemo(() => [
        { id: 'happy', icon: Sun, label: 'بخير 😊', color: 'text-amber-500', bg: 'bg-amber-500/10', glow: 'shadow-amber-500/20' },
        { id: 'calm', icon: ShieldCheck, label: 'مرتاح 😌', color: 'text-emerald-500', bg: 'bg-emerald-500/10', glow: 'shadow-emerald-500/20' },
        { id: 'tired', icon: Moon, label: 'تعبان 😴', color: 'text-indigo-500', bg: 'bg-indigo-500/10', glow: 'shadow-indigo-500/20' },
        { id: 'sad', icon: Cloud, label: 'متضايق 🌧️', color: 'text-rose-500', bg: 'bg-rose-500/10', glow: 'shadow-rose-500/20' },
    ], []);
    const gardenInfo = useMemo(() => {
        const points = (statsCount.notes * 2) + (statsCount.memories * 3) + (statsCount.adventures * 5) + (statsCount.commitments * 5) + (statsCount.songs * 1);

        if (points >= 300) return { level: 5, icon: '🌳✨', label: 'بستان الخلود', color: 'text-emerald-500', next: null, pts: points };
        if (points >= 150) return { level: 4, icon: '🌸', label: 'زهر المحبة', color: 'text-pink-500', next: 300, pts: points };
        if (points >= 75) return { level: 3, icon: '🌳', label: 'شجرة الألفة', color: 'text-green-600', next: 150, pts: points };
        if (points >= 25) return { level: 2, icon: '🌿', label: 'غصن الوفاء', color: 'text-emerald-600', next: 75, pts: points };
        return { level: 1, icon: '🌱', label: 'بذرة مودة', color: 'text-amber-600', next: 25, pts: points };
    }, [statsCount]);

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
                                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border shadow-sm ${isPartnerOnline()
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
                <div className="flex items-center gap-4 px-1 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-500">
                        <Target size={18} />
                    </div>
                    <h3 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white uppercase">مهام اليوم</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-blue-500/30 dark:from-blue-500/40 to-transparent" />
                </div>
                <section>
                    <div className="bg-white/60 dark:bg-white/[0.05] rounded-[2.4rem] border border-blue-100/50 dark:border-blue-900/20 shadow-sm overflow-hidden transition-all hover:shadow-md">

                        {/* Tasks list or empty CTA */}
                        {myCommitments.length === 0 ? (
                            <div className="px-6 py-6">
                                <div className="bg-blue-50/60 dark:bg-blue-500/[0.07] rounded-2xl px-4 py-4 border border-blue-100/40 dark:border-blue-500/10 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                        <Target size={20} />
                                    </div>
                                    <p className="text-[13px] font-bold text-blue-500/60 dark:text-blue-400/50">أضف أول ميثاق مودة لك</p>
                                </div>
                            </div>
                        ) : (
                            <div className="px-5 py-5 space-y-3">
                                {myCommitments.map((c) => {
                                    const current = Number(c.current_count) || 0;
                                    const target = Number(c.target_count) || 1;
                                    const pct = Math.min(100, Math.round((current / target) * 100));
                                    const isDone = current >= target;
                                    const periodMap: Record<string, string> = { daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري' };

                                    const handleTap = async (e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        if (isDone) return;
                                        const newCount = current + 1;
                                        try {
                                            await supabase.from('commitments').update({ current_count: newCount }).eq('id', c.id);
                                            fetchMyCommitments();
                                        } catch {}
                                    };

                                    return (
                                        <div key={c.id} className="bg-white/70 dark:bg-white/[0.04] rounded-2xl px-4 py-3.5 border border-white/80 dark:border-white/[0.07]">
                                            <div className="flex items-center gap-3 mb-2.5">
                                                {/* Tap button */}
                                                <motion.button
                                                    whileTap={{ scale: 0.85 }}
                                                    onClick={handleTap}
                                                    className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${
                                                        isDone
                                                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                                            : 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-500 hover:bg-blue-500 hover:text-white'
                                                    }`}
                                                >
                                                    {isDone ? (
                                                        <motion.div
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            transition={{ type: 'spring', stiffness: 400 }}
                                                        >
                                                            ✓
                                                        </motion.div>
                                                    ) : (
                                                        <Target size={16} />
                                                    )}
                                                </motion.button>

                                                {/* Title */}
                                                <div className="flex-1 min-w-0">
                                                    <span className={`text-[13px] font-black truncate block ${isDone ? 'text-emerald-600 dark:text-emerald-400 line-through opacity-60' : 'text-zinc-800 dark:text-white/90'}`}>
                                                        {c.title}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                                                        {periodMap[c.period_type] || ''}
                                                    </span>
                                                </div>

                                                {/* Count badge */}
                                                <div className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black tabular-nums transition-all ${
                                                    isDone
                                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                                        : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                }`}>
                                                    {current}/{target}
                                                </div>
                                            </div>

                                            {/* Progress bar */}
                                            <div className="h-1.5 bg-zinc-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                                                <motion.div
                                                    className={`h-full rounded-full ${isDone ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${pct}%` }}
                                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* View all link */}
                                <button
                                    onClick={() => onNavigate('commitments')}
                                    className="w-full mt-1 py-2.5 text-[11px] font-black text-blue-500/60 hover:text-blue-500 uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <span>عرض كل المهام</span>
                                    <ArrowUpRight size={13} />
                                </button>
                            </div>
                        )}
                    </div>
                </section>



                {/* --- SHORTCUTS GRID --- */}
                <div className="flex items-center gap-4 px-1 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-violet-500/10 dark:bg-violet-500/20 flex items-center justify-center text-violet-500">
                        <LayoutGrid size={18} />
                    </div>
                    <h3 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white uppercase">الاختصارات</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-violet-500/30 dark:from-violet-500/40 to-transparent" />
                </div>
                <section className="grid grid-cols-4 gap-4 px-1 pb-6">
                    {[
                        { id: 'adventure_bucket', icon: Compass, title: 'خططنا', sub: 'القادمة', color: 'from-amber-400 to-orange-500', hoverBg: 'rgba(251,191,36,0.2)', glow: 'bg-amber-400' },
                        { id: 'wishlist', icon: Gift, title: 'الأمنيات', sub: 'للذكرى', color: 'from-indigo-500 to-purple-600', hoverBg: 'rgba(99,102,241,0.2)', glow: 'bg-indigo-500' },
                        { id: 'home_box', icon: Armchair, title: 'البيت', sub: 'تجهيزات', color: 'from-teal-500 to-emerald-600', hoverBg: 'rgba(20,184,166,0.2)', glow: 'bg-teal-500' },
                        { id: 'evening_journal', icon: Moon, title: 'المساء', sub: 'سؤالنا', color: 'from-indigo-600 to-violet-700', hoverBg: 'rgba(79,70,229,0.2)', glow: 'bg-violet-500', lock: new Date().getHours() < 21 },
                        { id: 'playlist', icon: Music, title: 'موسيقى', sub: 'أغانينا', color: 'from-rose-500 to-pink-600', hoverBg: 'rgba(244,63,94,0.2)', glow: 'bg-rose-500' },
                        { id: 'decision_maker', icon: UtensilsCrossed, title: 'القرعة', sub: 'وين ناكل؟', color: 'from-orange-400 to-red-500', hoverBg: 'rgba(251,146,60,0.2)', glow: 'bg-orange-500' },
                    ].map((item) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            whileHover={{ scale: 1.05, y: -4 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                if (item.id === 'evening_journal' && item.lock) {
                                    toast.info("🌙 لم يحن الوقت بعد\nدفتر المساء يفتح الساعة 9:00 مساءً.");
                                    return;
                                }
                                onNavigate(item.id);
                            }}
                            className="relative group cursor-pointer"
                        >
                            <div 
                                className={`aspect-square rounded-[2rem] border border-zinc-100 dark:border-white/5 shadow-sm overflow-hidden flex flex-col items-center justify-center gap-2.5 transition-all duration-300 ${item.lock ? 'opacity-60 grayscale' : ''}`}
                                style={{ background: isDarkMode ? `rgba(255,255,255,0.04)` : `rgba(255,255,255,0.95)` }}
                            >
                                {/* Gradient — visible only on hover */}
                                <div 
                                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                    style={{ background: item.hoverBg }}
                                />
                                {/* Glow burst */}
                                <div className={`absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-400 ${item.glow} blur-3xl`} />

                                <div className="relative z-10 flex flex-col items-center gap-3">
                                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300`}>
                                        <item.icon size={26} />
                                    </div>
                                    <div className="text-center px-1">
                                        <span className="text-[10px] font-black text-zinc-800 dark:text-white leading-tight block">
                                            {item.title}
                                        </span>
                                        <span className="text-[7.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-0.5 block opacity-60">
                                            {item.sub}
                                        </span>
                                    </div>
                                </div>

                                {item.lock && (
                                    <div className="absolute top-2.5 right-2.5 opacity-30">
                                        <Lock size={10} className="text-zinc-400" />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </section>


                <section className="grid grid-cols-2 gap-5 px-1 pb-4">


                    {/* Love Mail Section Header */}
                    <div className="col-span-2 flex items-center gap-4 px-2 mt-8 mb-4">
                        <div className="w-9 h-9 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center text-rose-500">
                            <Mail size={18} />
                        </div>
                        <h3 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white uppercase">بريد الحب</h3>
                        <div className="h-px flex-1 bg-gradient-to-r from-rose-500/30 dark:from-rose-500/40 to-transparent" />
                    </div>


                    <motion.div
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onNavigate('love_notes')}
                        className="col-span-2 relative group cursor-pointer"
                    >
                        <div className="absolute -inset-4 bg-rose-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-full" />
                        <div className="relative aspect-[272/409] w-full max-w-[280px] mx-auto select-none perspective-1000 mt-4 mb-8">
                            <motion.div whileHover={{ rotateY: 2, rotateX: 2 }} className="w-full h-full transition-transform duration-500 relative">
                                <img src="/assets/love_notes/card-base.png" className="absolute inset-x-0 bottom-0 w-full h-[85%] object-cover pointer-events-none z-0 drop-shadow-2xl" />

                                {latestNote ? (
                                    <>
                                        {(() => {
                                            const isAuthor = latestNote.author_id === userId;
                                            const [rawFont, flowersPart] = latestNote.font_style?.includes('|')
                                                ? latestNote.font_style.split('|')
                                                : [latestNote.font_style || 'font-ruqaa', ''];
                                            const fontClass = (rawFont === 'font-cedarville') ? 'font-cedarville' : 'font-ruqaa';
                                            const activeFlowers: string[] = flowersPart?.split(',').filter(Boolean) || [];
                                            const flowersData = [
                                                { id: 'flower-1', url: '/assets/love_notes/flower-1.png' },
                                                { id: 'flower-2', url: '/assets/love_notes/flower-2.png' },
                                                { id: 'flower-3', url: '/assets/love_notes/flower-3.png' },
                                                { id: 'flower-4', url: '/assets/love_notes/flower-4.png' },
                                                { id: 'flower-5', url: '/assets/love_notes/flower-5.png' },
                                                { id: 'flower-6', url: '/assets/love_notes/flower-6.png' },
                                                { id: 'flower-7', url: '/assets/love_notes/flower-7.png' },
                                            ];

                                            return (
                                                <>
                                                    <div className="absolute top-0 inset-x-0 h-[60%] z-0 pointer-events-none overflow-hidden">
                                                        {Array.isArray(activeFlowers) && activeFlowers.map((fid: string, idx: number) => {
                                                            const flower = flowersData.find(f => f.id === fid);
                                                            if (!flower) return null;
                                                            const slots = [
                                                                { x: '-5%', y: '30%', rotate: 0, scale: 1.25, z: 7 },
                                                                { x: '-18%', y: '32%', rotate: -12, scale: 1.1, z: 6 },
                                                                { x: '10%', y: '35%', rotate: 10, scale: 1.15, z: 5 },
                                                                { x: '25%', y: '42%', rotate: 22, scale: 1.0, z: 4 },
                                                                { x: '-28%', y: '40%', rotate: -22, scale: 1.0, z: 3 },
                                                                { x: '5%', y: '45%', rotate: 5, scale: 0.95, z: 2 },
                                                                { x: '-8%', y: '48%', rotate: -8, scale: 0.95, z: 1 }
                                                            ];
                                                            const slot = slots[idx % slots.length];
                                                            return (
                                                                <div
                                                                    key={`home-flower-${idx}`}
                                                                    className="w-[32%] absolute"
                                                                    style={{
                                                                        left: '50%', top: slot.y, marginLeft: slot.x,
                                                                        transform: `scale(${slot.scale}) rotate(${slot.rotate}deg)`,
                                                                        transformOrigin: 'bottom center', zIndex: slot.z
                                                                    }}
                                                                >
                                                                    <img src={flower.url} className="w-full drop-shadow-md object-contain" />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    <div className="absolute left-[12.5%] top-[34.2%] w-[75%] aspect-square shadow-xl overflow-hidden z-10 rotate-[-1.5deg]">
                                                        <img src="/assets/love_notes/card-paper.png" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                                                            <div className="w-full max-h-full overflow-hidden flex flex-col items-center">
                                                                <p className={`text-[1.2rem] font-bold text-black/85 leading-tight line-clamp-4 ${fontClass}`}>
                                                                    {latestNote.content}
                                                                </p>
                                                                <span className={`text-[0.65rem] text-black/40 italic mt-4 self-end shrink-0 ${fontClass}`}>
                                                                    — {isAuthor ? 'أنا' : (latestNote.author?.name || 'شريك حياتي')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <img src="/assets/love_notes/card-mask.png" className="absolute inset-x-0 bottom-0 w-full h-[85%] object-cover pointer-events-none z-30 opacity-80" />

                                                    <div className="absolute left-[17%] bottom-[16%] z-40 px-2">
                                                        <p className={`text-[0.65rem] text-black/40 font-black ${fontClass} opacity-80`}>
                                                            {fontClass === 'font-ruqaa' ? 'إلى: ' : 'To: '} أنا
                                                        </p>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </>
                                ) : (
                                    <>
                                        <div className="absolute left-[12.5%] top-[34.2%] w-[75%] aspect-square shadow-xl overflow-hidden z-10 flex items-center justify-center">
                                            <img src="/assets/love_notes/card-paper.png" className="absolute inset-0 w-full h-full object-cover" />
                                            <div className="relative z-20 px-4 py-2 border border-rose-500/10 rounded-full bg-rose-500/5 backdrop-blur-sm">
                                                <p className="text-[11px] font-black text-rose-500/50 uppercase tracking-[0.3em] text-center">أضف بسمتك الوجدانية</p>
                                            </div>
                                        </div>
                                        <img src="/assets/love_notes/card-mask.png" className="absolute inset-x-0 bottom-0 w-full h-[85%] object-cover pointer-events-none z-30 opacity-80" />
                                    </>
                                )}
                            </motion.div>
                        </div>
                    </motion.div>
                </section>

                {/* ── المزاج — MONTHLY MOOD TRACKER ── */}
                <div className="col-span-2 flex items-center gap-4 px-2 mt-8 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 flex items-center justify-center text-orange-500">
                        <Smile size={18} />
                    </div>
                    <h3 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white uppercase">المزاج</h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-orange-500/40 dark:from-orange-500/50 to-transparent" />
                </div>

                <section className="pb-8">
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="bg-white/65 dark:bg-white/[0.04] rounded-[2.8rem] p-6 relative overflow-visible border border-white/80 dark:border-white/[0.07] shadow-xl"
                    >
                        <div className="absolute top-[-20px] left-10 w-40 h-40 bg-orange-500/5 blur-[50px] rounded-full pointer-events-none" />
                        <div className="relative z-10 space-y-6">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-lg font-black text-zinc-900 dark:text-white">
                                    {['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'][new Date().getMonth()]}
                                </span>
                                <div className="flex items-center gap-1.5 opacity-40">
                                    <Clock size={10} className="text-zinc-400" />
                                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">تتبع شهري</span>
                                </div>
                            </div>
                            
                            {/* Monthly Calendar Grid */}
                            <div className="grid grid-cols-7 gap-2.5">
                                {(() => {
                                    const now = new Date();
                                    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                                    const todayDate = now.getDate();
                                    const cells = [];
                                    
                                    for (let d = 1; d <= daysInMonth; d++) {
                                        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                        const dayMood = monthlyMoods[dateStr];
                                        const moodObj = moodsList.find(m => m.id === dayMood);
                                        const isToday = d === todayDate;

                                        cells.push(
                                            <motion.div
                                                key={d}
                                                whileHover={{ scale: 1.1 }}
                                                className={`aspect-square rounded-xl flex items-center justify-center relative cursor-pointer group/cell ${
                                                    isToday ? 'ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-[#080010]' : ''
                                                } ${dayMood ? '' : 'bg-zinc-100/50 dark:bg-white/5 border border-dashed border-zinc-200 dark:border-white/10'}`}
                                                onClick={() => isToday && setShowMoodPrompt(true)}
                                            >
                                                {moodObj ? (
                                                    <div className={`w-full h-full rounded-xl flex items-center justify-center ${moodObj.bg} text-[14px] shadow-sm`}>
                                                        <moodObj.icon size={14} className={moodObj.color} />
                                                        <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white dark:bg-zinc-800 shadow-xs" />
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-black text-zinc-400 opacity-40">{d}</span>
                                                )}
                                                
                                                {isToday && !dayMood && (
                                                    <motion.div 
                                                        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                                                        transition={{ repeat: Infinity, duration: 2 }}
                                                        className="absolute inset-0 bg-orange-400/20 rounded-xl" 
                                                    />
                                                )}
                                            </motion.div>
                                        );
                                    }
                                    return cells;
                                })()}
                            </div>

                            {/* Today's Status / Selection Prompt */}
                            <AnimatePresence mode="wait">
                                {showMoodPrompt ? (
                                    <motion.div 
                                        key="mood-grid" 
                                        initial={{ opacity: 0, y: 10 }} 
                                        animate={{ opacity: 1, y: 0 }} 
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="bg-zinc-50 dark:bg-black/20 rounded-3xl p-5 border border-zinc-200/50 dark:border-white/5"
                                    >
                                        <div className="flex justify-between items-center mb-4">
                                            <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest px-1">كيف حالك اليوم؟</p>
                                            <button onClick={() => setShowMoodPrompt(false)} className="text-[10px] font-black text-zinc-400">إغلاق</button>
                                        </div>
                                        <div className="flex justify-between gap-3">
                                            {moodsList.map((m) => (
                                                <motion.button
                                                    key={m.id}
                                                    onClick={() => handleMoodSelect(m.id)}
                                                    whileHover={{ y: -4 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    className="flex-1 flex flex-col items-center gap-2"
                                                >
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${m.color} ${m.bg} shadow-sm border border-white dark:border-white/5`}>
                                                        <m.icon size={20} />
                                                    </div>
                                                    <span className="text-[8px] font-black text-zinc-400 uppercase">{m.label.split(' ')[0]}</span>
                                                </motion.button>
                                            ))}
                                        </div>
                                    </motion.div>
                                ) : (
                                    <div className="flex items-center justify-between px-2 pt-2 border-t border-zinc-100 dark:border-white/5">
                                        <div className="flex flex-col">
                                            <h4 className="text-[14px] font-black text-zinc-800 dark:text-white">تتبع مشاعرك</h4>
                                            <div className="flex items-center gap-3 mt-1">
                                                {partnerMood ? (
                                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/10 text-[9px] font-black text-rose-500">
                                                        <span>{partnerName} اليوم:</span>
                                                        <span className="opacity-80 flex items-center gap-1.5">
                                                            {(() => { 
                                                                const pMoodObj = moodsList.find(m => m.id === partnerMood); 
                                                                if (!pMoodObj) return 'غير معروف';
                                                                const PIcon = pMoodObj.icon;
                                                                return (
                                                                    <>
                                                                        <PIcon size={10} />
                                                                        <span>{pMoodObj.label.split(' ')[0]}</span>
                                                                    </>
                                                                );
                                                            })()}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">سجل مشاعرك يومياً لبناء بستانك</p>
                                                )}
                                            </div>
                                        </div>
                                        {!selectedMoodId && (
                                            <motion.button 
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => setShowMoodPrompt(true)}
                                                className="bg-orange-500 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black shadow-lg shadow-orange-500/20"
                                            >
                                                سجل الآن
                                            </motion.button>
                                        )}
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </section>

                <section className="space-y-6">
                    <div className="flex items-center gap-4 px-1">
                        <div className="w-9 h-9 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center text-rose-500">
                            <Calendar size={18} />
                        </div>
                        <h3 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white uppercase">أحداث قادمة</h3>
                        <div className="h-px flex-1 bg-gradient-to-r from-rose-500/30 dark:from-rose-500/40 to-transparent" />
                        <button onClick={() => onNavigate('calendar')} className="flex items-center gap-2 shrink-0 group">
                            <span className="text-[11px] font-black text-rose-500 opacity-60 group-hover:opacity-100 transition-opacity uppercase tracking-widest">السجل</span>
                            <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shadow-sm group-hover:bg-rose-500 group-hover:text-white transition-all">
                                <ArrowUpRight size={16} />
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
                                    <div className={`px-5 py-2.5 rounded-2xl font-black text-[10px] shadow-sm transition-all ${daysLeft <= 1
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
                {/* AI Floating Chatbot */}
                <FloatingChatbot 
                    gardenInfo={gardenInfo} 
                    userId={userId} 
                    partnershipId={partnershipId}
                    contextData={{
                        userName: partnership ? (partnership.user1_id === userId ? partnership.user1?.name : partnership.user2?.name) : 'صديقي',
                        partnerName: partnership ? (partnership.user1_id === userId ? partnership.user2?.name : partnership.user1?.name) : 'الشريك',
                        stats: statsCount,
                        commitments: myCommitments.map(c => ({ title: c.title, weight: c.weight, is_done: c.is_done })),
                        events: upcomingEvents.map(e => ({ title: e.title, date: e.event_date })),
                        latestNote: latestNote,
                        partnerLocation: { 
                            ...partnerTracking, 
                            distance, 
                            isOnline: isPartnerOnline(),
                            lastSeenFormatted: partnerTracking.last_seen ? formatLastSeen(partnerTracking.last_seen) : 'غير معروف'
                        }
                    }}
                />
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
