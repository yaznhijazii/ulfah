import { useState, useEffect, useCallback } from 'react';
import {
    Settings,
    Ruler,
    Image as ImageIcon,
    CheckCircle,
    Smile,
    Heart,
    Sparkles,
    ChevronLeft,
    MapPin,
    Feather,
    MessageCircle,
    PlusCircle,
    Calendar as CalendarIcon,
    Clock,
    Compass,
    Gift,
    Moon,
    Sun,
    Camera,
    ShieldCheck,
    Map,
    Cloud,
    LayoutGrid,
    Target,
    Zap,
    Navigation,
    Award,
    User
} from 'lucide-react';
import { Logo } from './Logo';
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
    const [daysTogether, setDaysTogether] = useState<number>(0);
    const [showMoodPrompt, setShowMoodPrompt] = useState(true);
    const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
    const [avatars, setAvatars] = useState<{ me: string | null, partner: string | null }>({ me: null, partner: null });
    const [partnerTracking, setPartnerTracking] = useState<{ last_seen: string | null, lat: number | null, lng: number | null }>({ last_seen: null, lat: null, lng: null });
    const [myLocation, setMyLocation] = useState<{ lat: number | null, lng: number | null }>({ lat: null, lng: null });
    const [distance, setDistance] = useState<string | null>(null);
    const [distKm, setDistKm] = useState<number | null>(null);
    const [adventureBalance, setAdventureBalance] = useState<number>(0);
    const [showMap, setShowMap] = useState(false);
    const [nudgeActive, setNudgeActive] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [partnership, setPartnership] = useState<any>(null);
    const [moodLoading, setMoodLoading] = useState(false);
    const [selectedMoodId, setSelectedMoodId] = useState<string | null>(null);
    const [partnerMood, setPartnerMood] = useState<any>(null);
    const [aiRecommendation, setAiRecommendation] = useState<{ title: string; advice: string } | null>(null);
    const [upcomingGreeting, setUpcomingGreeting] = useState<{ title: string } | null>(null);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'صباح المودة والسكينة';
        if (hour < 18) return 'طاب يومكم بكل مودة';
        return 'مساء السكينة والمحبة';
    };

    const formatLastSeen = (lastSeen: string | null) => {
        if (!lastSeen) return 'غير متوفر';
        const date = new Date(lastSeen);
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

        if (diffInMinutes < 2) return 'متصل الآن';
        if (diffInMinutes < 60) return `نشط منذ ${diffInMinutes} دقيقة`;
        if (diffInMinutes < 1440) return `نشط منذ ${Math.floor(diffInMinutes / 60)} ساعة`;
        return `آخر ظهور: ${date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}`;
    };

    const handleNudge = async () => {
        console.log("Nudge button clicked", { userId, partnershipId, hasPartnership: !!partnership });
        if (!userId || !partnershipId || !partnership) return;
        setNudgeActive(true);
        setTimeout(() => setNudgeActive(false), 2000);

        try {
            const partnerId = partnership.user1_id === userId ? partnership.user2_id : partnership.user1_id;

            // Calculate distance immediately to ensure accuracy
            let currentDistance = distance;
            if (myLocation.lat && myLocation.lng && partnership.user1 && partnership.user2) {
                const partner = partnership.user1_id === userId ? partnership.user2 : partnership.user1;
                if (partner?.latitude && partner?.longitude) {
                    currentDistance = calculateDistance(myLocation.lat, myLocation.lng, partner.latitude, partner.longitude);
                }
            }

            console.log(`Sending nudge to ${partnerId} with distance: ${currentDistance}`);

            await supabase.from('notifications').insert({
                user_id: partnerId,
                title: 'تنبيه مودة 💖',
                body: `شريكك يفكر بك! المسافة بينكما: ${currentDistance || 'غير معروفة'}`,
                type: 'nudge',
                metadata: { distance: currentDistance }
            });

        } catch (e) {
            console.error('Error sending nudge:', e);
        }
    };

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c;
        if (d < 1) return `${Math.round(d * 1000)} م`;
        return `${d.toFixed(1)} كم`;
    };

    const updateMyStatus = useCallback(async () => {
        if (!userId) return;
        setIsSyncing(true);
        let lat = null, lng = null;

        // Try to get from cache first for instant UI response
        const cachedLat = localStorage.getItem('ulfah_last_lat');
        const cachedLng = localStorage.getItem('ulfah_last_lng');
        if (cachedLat && cachedLng) {
            setMyLocation({ lat: parseFloat(cachedLat), lng: parseFloat(cachedLng) });
        }

        if ("geolocation" in navigator) {
            try {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 5000,
                        maximumAge: 60000
                    });
                });
                lat = position.coords.latitude;
                lng = position.coords.longitude;
                setMyLocation({ lat, lng });
                localStorage.setItem('ulfah_last_lat', lat.toString());
                localStorage.setItem('ulfah_last_lng', lng.toString());
            } catch (e) { }
        }
        await supabase.from('users').update({
            last_seen: new Date().toISOString(),
            ...(lat && lng ? { latitude: lat, longitude: lng } : {})
        }).eq('id', userId);
        setTimeout(() => setIsSyncing(false), 1000);
    }, [userId]);

    // Load stable data (Images, Events, Jars) - Run once or manually
    const loadStableData = async () => {
        if (!partnershipId) return;
        const today = new Date().toISOString().split('T')[0];

        const [upcomingEventsRes, pastEventsRes, jarRes, greetingRes] = await Promise.all([
            supabase.from('calendar_events')
                .select('id, title, event_date, event_type')
                .eq('partnership_id', partnershipId)
                .gte('event_date', today)
                .order('event_date', { ascending: true })
                .limit(1),
            supabase.from('calendar_events')
                .select('id, title, event_date, image_url')
                .eq('partnership_id', partnershipId)
                .lt('event_date', today)
                .not('image_url', 'is', null)
                .order('event_date', { ascending: false })
                .limit(1),
            supabase.from('finance_jars')
                .select('current_amount')
                .eq('partnership_id', partnershipId)
                .eq('title', 'حصالة المغامرات')
                .maybeSingle(),
            supabase.from('occasion_greetings')
                .select('title')
                .eq('partnership_id', partnershipId)
                .neq('sender_id', userId)
                .eq('is_opened', false)
                .lte('target_date', new Date(Date.now() + 86400000 * 3).toISOString()) // Within 3 days
                .gte('target_date', new Date(Date.now() - 86400000 * 3).toISOString()) // Don't show if passed by more than 3 days
                .order('target_date', { ascending: true })
                .limit(1)
                .maybeSingle()
        ]);

        if (upcomingEventsRes.data || pastEventsRes.data) {
            const combined = [...(upcomingEventsRes.data || []), ...(pastEventsRes.data || [])];
            setUpcomingEvents(combined);
        }
        if (jarRes.data) setAdventureBalance(jarRes.data.current_amount);
        if (greetingRes.data) setUpcomingGreeting(greetingRes.data);
    };

    // Load volatile data (Status, Mood) - Run frequently
    const loadVolatileData = async () => {
        if (!partnershipId || !userId) return;
        const today = new Date().toISOString().split('T')[0];

        // 1. Get partnership and partner user status (minimal columns)
        const { data: p } = await supabase.from('partnerships')
            .select('*, user1:user1_id(avatar_url, last_seen, latitude, longitude), user2:user2_id(avatar_url, last_seen, latitude, longitude)')
            .eq('id', partnershipId)
            .single();

        if (p) {
            setPartnership(p);
            const isUser1 = p.user1_id === userId;
            const partner = isUser1 ? p.user2 : p.user1;
            const partnerId = isUser1 ? p.user2_id : p.user1_id;

            setAvatars({
                me: (isUser1 ? p.user1 : p.user2 as any)?.avatar_url,
                partner: (partner as any)?.avatar_url
            });

            setPartnerTracking({
                last_seen: partner?.last_seen,
                lat: partner?.latitude,
                lng: partner?.longitude
            });

            const start = new Date(p.relationship_start_date || p.created_at);
            setDaysTogether(Math.floor((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

            // 2. Fetch partner and my mood
            const [{ data: myMood }, { data: pMood }] = await Promise.all([
                supabase.from('mood_logs').select('mood').eq('user_id', userId).eq('mood_date', today).maybeSingle(),
                supabase.from('mood_logs').select('mood').eq('user_id', partnerId).eq('mood_date', today).maybeSingle()
            ]);

            if (myMood) {
                setSelectedMoodId(myMood.mood);
                setShowMoodPrompt(false);
            }
            if (pMood) setPartnerMood(pMood.mood);

            // 3. Fetch partner's latest note for AI context
            const { data: latestNote } = await supabase
                .from('love_notes')
                .select('content')
                .eq('author_id', partnerId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            const recommendation = getAIRecommendation({
                mood: pMood?.mood || null,
                lastNote: latestNote?.content || null
            });
            setAiRecommendation(recommendation);
        }
    };

    useEffect(() => {
        if (partnershipId && userId) {
            loadStableData();
            loadVolatileData();
            updateMyStatus();

            const interval = setInterval(() => {
                updateMyStatus();
                loadVolatileData();
            }, 60000);

            // Listen for nudges
            const channel = supabase
                .channel(`nudge_${userId}`)
                .on('postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${userId}`
                    },
                    (payload) => {
                        const newNotif = payload.new as any;
                        if (newNotif.type === 'nudge') {
                            setNudgeActive(true);
                            setTimeout(() => setNudgeActive(false), 3000);

                            // In-App Toast
                            toast.success(newNotif.title, {
                                description: newNotif.body,
                                icon: '💖',
                                duration: 5000,
                            });

                            // System Notification (Web Push / OS)
                            if (Notification.permission === 'granted') {
                                try {
                                    new Notification(newNotif.title, {
                                        body: newNotif.body,
                                        icon: '/icon.png', // Fallback or use a valid asset path
                                        badge: '/icon.png'
                                    });
                                } catch (e) {
                                    console.error('System notification failed:', e);
                                }
                            }
                        }
                    }
                )
                .subscribe();

            return () => {
                clearInterval(interval);
                supabase.removeChannel(channel);
            };
        }
    }, [partnershipId, userId]);

    useEffect(() => {
        if (partnerTracking.lat && partnerTracking.lng && myLocation.lat && myLocation.lng) {
            const d = calculateDistance(myLocation.lat, myLocation.lng, partnerTracking.lat, partnerTracking.lng);
            setDistance(d);
            const R = 6371;
            const dLat = (partnerTracking.lat - myLocation.lat) * Math.PI / 180;
            const dLon = (partnerTracking.lng - myLocation.lng) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(myLocation.lat * Math.PI / 180) * Math.cos(partnerTracking.lat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            setDistKm(R * c);
        }
    }, [myLocation, partnerTracking]);

    const moods = [
        { id: 'happy', icon: Sun, label: 'مشرقة', color: 'text-amber-500', bg: 'bg-amber-500/10' },
        { id: 'calm', icon: ShieldCheck, label: 'مطمئنة', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { id: 'tired', icon: Moon, label: 'هادئة', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
        { id: 'sad', icon: Cloud, label: 'غائمة', color: 'text-rose-500', bg: 'bg-rose-500/10' },
    ];

    const handleMoodSelect = async (mood: string) => {
        if (!userId || moodLoading) return;

        setMoodLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const { error } = await supabase.from('mood_logs').upsert(
                { user_id: userId, mood_date: today, mood: mood },
                { onConflict: 'user_id,mood_date' }
            );

            if (error) throw error;

            setSelectedMoodId(mood);
            setShowMoodPrompt(false);

            // Refresh mood data to get partner updates immediately
            loadVolatileData();
        } catch (err: any) {
            console.error('Mood Save Error:', err);
            alert(`خطأ في الحفظ: ${err.message}\n\nتأكد من تشغيل V8 SQL Fix.`);
        } finally {
            setMoodLoading(false);
        }
    };

    const calculateDaysUntil = (date: string) => {
        const target = new Date(date);
        target.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diff = target.getTime() - today.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    };

    const isPartnerOnline = () => {
        if (!partnerTracking.last_seen) return false;
        const lastSeen = new Date(partnerTracking.last_seen);
        const now = new Date();
        return (now.getTime() - lastSeen.getTime()) < 120000;
    };

    return (
        <div className="flex-1 bg-background overflow-x-hidden scrollbar-hide pb-32 relative mood-home">
            {/* Ambient Background Aura - More Subtle & Magical */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute top-[-10%] right-[-15%] w-[100%] h-[70%] bg-rose-500/[0.07] blur-[160px] rounded-full" />
                <div className="absolute bottom-[-15%] left-[-10%] w-[90%] h-[60%] bg-amber-500/[0.04] blur-[140px] rounded-full" />
                <div className="absolute top-[30%] left-[20%] w-[40%] h-[30%] bg-indigo-500/[0.03] blur-[120px] rounded-full" />
            </div>

            <header className="px-8 pt-16 pb-12 sticky top-0 bg-background/5 backdrop-blur-2xl z-40 transition-all duration-700">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col text-right">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-4 group cursor-pointer"
                        >
                            <div className="relative">
                                <Logo size="sm" />
                                <motion.div 
                                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                    className="absolute inset-0 bg-rose-500/20 blur-xl rounded-full -z-10"
                                />
                            </div>
                            <h1 className="text-4xl font-black text-foreground tracking-tighter drop-shadow-2xl">أُلْفَة</h1>
                        </motion.div>
                        <motion.p 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-[10px] font-black uppercase tracking-[0.6em] text-rose-500/40 mt-3 pr-1 leading-none"
                        >
                            {getGreeting()}
                        </motion.p>
                    </div>
                    <motion.button
                        whileTap={{ scale: 0.85 }}
                        whileHover={{ rotate: -8, scale: 1.1 }}
                        onClick={() => onNavigate('settings')}
                        className="w-16 h-16 flex items-center justify-center glass rounded-3xl border-white/40 dark:border-white/5 shadow-[0_20px_40px_rgba(0,0,0,0.1)] active:shadow-inner transition-all text-foreground/30 hover:text-rose-500 hover:bg-white/80"
                    >
                        <Settings className="w-7 h-7" />
                    </motion.button>
                </div>
            </header>

            <div className="px-8 mt-4 space-y-6">
                {/* 1. THE HERO CONNECTION - THE SOUL OF THE APP */}
                <section className="relative group">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass rounded-[3.5rem] p-1 border-white/60 dark:border-white/5 shadow-[0_32px_64px_-16px_rgba(244,63,94,0.15)] overflow-hidden bg-white/40 dark:bg-zinc-950/60"
                    >
                        <div className="relative p-8 overflow-hidden rounded-[3.2rem]">
                            {/* Animated Background Orbs */}
                            <div className="absolute inset-0 pointer-events-none">
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="absolute -top-1/2 -right-1/2 w-full h-full bg-rose-500/5 blur-[120px] rounded-full" />
                                <motion.div animate={{ rotate: -360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-amber-500/5 blur-[120px] rounded-full" />
                            </div>

                            <div className="relative z-10 flex flex-col items-center">
                                {/* Infinity Avatars */}
                                <div className="relative w-full h-32 flex items-center justify-center mb-6">
                                    <svg className="absolute w-[280px] h-[140px] pointer-events-none overflow-visible opacity-10" viewBox="0 0 260 110">
                                        <path d="M 65 55 C 65 15, 15 15, 15 55 C 15 95, 65 95, 130 55 C 195 15, 245 15, 245 55 C 245 95, 195 95, 130 55 L 65 55" fill="none" stroke="currentColor" strokeWidth="1" />
                                    </svg>

                                    <div className="flex items-center justify-center -space-x-10 relative">
                                        <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} className="w-24 h-24 rounded-[2.5rem] border-4 border-white dark:border-zinc-900 shadow-2xl overflow-hidden relative group/avatar">
                                            {avatars.me ? <img src={avatars.me} className="w-full h-full object-cover group-hover/avatar:scale-110 transition-transform" /> : <div className="w-full h-full bg-rose-50 text-rose-200 flex items-center justify-center"><User size={40} /></div>}
                                            <div className="absolute top-3 right-3 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
                                        </motion.div>

                                        <div className="relative z-20">
                                            <motion.button 
                                                whileHover={{ scale: 1.2 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={handleNudge}
                                                className="w-16 h-16 rounded-full glass border-white shadow-2xl flex items-center justify-center bg-white/95 dark:bg-zinc-900 relative group/heart"
                                            >
                                                <motion.div animate={{ scale: nudgeActive ? [1, 1.5, 1] : [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                                                    <Heart className={`w-8 h-8 text-rose-500 ${nudgeActive ? 'fill-rose-500' : 'fill-rose-500/20'} group-hover/heart:fill-rose-500 transition-colors`} />
                                                </motion.div>
                                            </motion.button>
                                        </div>

                                        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }} className="w-24 h-24 rounded-[2.5rem] border-4 border-white dark:border-zinc-900 shadow-2xl overflow-hidden relative group/avatar">
                                            {avatars.partner ? <img src={avatars.partner} className="w-full h-full object-cover group-hover/avatar:scale-110 transition-transform" /> : <div className="w-full h-full bg-rose-50 text-rose-100 flex items-center justify-center"><Heart size={40} fill="currentColor" /></div>}
                                            <div className={`absolute top-3 left-3 w-4 h-4 ${isPartnerOnline() ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-300'} border-2 border-white rounded-full`} />
                                        </motion.div>
                                    </div>
                                </div>

                                {/* Connection Metrics Pod */}
                                <div className="grid grid-cols-2 gap-4 w-full">
                                    <div className="flex flex-col items-center">
                                        <span className="text-[10px] font-black text-rose-500/50 uppercase tracking-[0.4em] mb-1">المسافة</span>
                                        <h2 className="text-3xl font-black tracking-tighter text-foreground">{distance?.split(' ')[0] || '--'} <span className="text-xs text-muted-foreground opacity-40">{distance?.split(' ')[1] || 'كم'}</span></h2>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-[10px] font-black text-rose-500/50 uppercase tracking-[0.4em] mb-1">الإتحاد</span>
                                        <h2 className="text-3xl font-black tracking-tighter text-foreground">{daysTogether} <span className="text-xs text-muted-foreground opacity-40">يوم</span></h2>
                                    </div>
                                </div>

                                {/* Quick Connect Buttons */}
                                <div className="flex items-center gap-4 mt-8 w-full">
                                    <motion.button 
                                        whileTap={{ scale: 0.9 }} 
                                        onClick={() => setShowMap(true)}
                                        className="h-14 flex-1 bg-white dark:bg-zinc-900 rounded-[1.8rem] border border-white/60 dark:border-white/5 shadow-xl flex items-center justify-center gap-3 text-rose-500 font-bold group"
                                    >
                                        <MapPin className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        <span className="text-xs tracking-tight">رؤية الموضع</span>
                                    </motion.button>
                                    <motion.button 
                                        whileTap={{ scale: 0.9 }} 
                                        onClick={updateMyStatus}
                                        className="h-14 w-14 bg-rose-50 dark:bg-rose-950/20 rounded-[1.8rem] border border-rose-100 dark:border-rose-500/10 shadow-xl flex items-center justify-center text-rose-500"
                                    >
                                        <Zap className={`w-5 h-5 ${isSyncing ? 'animate-spin'                {/* 2. THE BENTO GRID */}
                <div className="grid grid-cols-12 gap-5 auto-rows-[160px]">
                    
                    {/* BENTO: AI SEED ADVICE (Large Horizontal - 12x1) */}
                    <AnimatePresence>
                        {aiRecommendation && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="col-span-12 row-span-1 glass rounded-[3rem] p-8 border-rose-500/20 flex flex-col justify-center relative overflow-hidden group bg-gradient-to-l from-rose-500/5 to-transparent"
                            >
                                <Sparkles className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 text-rose-500/10 group-hover:scale-125 group-hover:rotate-12 transition-all duration-1000" />
                                <div className="relative z-10 text-right">
                                    <div className="flex items-center justify-end gap-2 mb-2">
                                        <h3 className="text-sm font-black text-rose-500 tracking-tight">{aiRecommendation.title}</h3>
                                        <div className="w-6 h-[2px] bg-rose-500/20 rounded-full" />
                                    </div>
                                    <p className="text-[11px] leading-[1.6] text-foreground/70 font-medium italic overflow-hidden text-ellipsis line-clamp-2 pr-2">
                                        {aiRecommendation.advice}
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* BENTO: ADVENTURE BUCKET (7x2) */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onNavigate('adventure_bucket')}
                        className="col-span-7 row-span-2 glass rounded-[3.2rem] p-7 border-amber-500/20 bg-amber-500/[0.03] flex flex-col justify-between items-end text-right overflow-hidden relative group"
                    >
                        <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/10 rounded-full blur-[60px] -ml-16 -mt-16 pointer-events-none" />
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-inner group-hover:rotate-[-15deg] transition-transform">
                            <Compass className="w-7 h-7" />
                        </div>
                        <div className="space-y-1 mt-auto">
                            <h3 className="text-xl font-black text-foreground tracking-tight">أفق أحلامنا</h3>
                            <p className="text-[9px] font-black text-amber-600/40 uppercase tracking-[0.4em]">مستقبلنا معاً</p>
                        </div>
                    </motion.div>

                    {/* BENTO: WISHLIST (5x1) */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onNavigate('wishlist')}
                        className="col-span-5 row-span-1 glass rounded-[2.5rem] p-6 border-rose-500/20 bg-rose-500/[0.03] flex flex-col justify-center items-center text-center overflow-hidden relative group"
                    >
                        <div className="absolute bottom-0 right-0 w-20 h-20 bg-rose-500/5 rounded-full blur-[40px] -mr-10 -mb-10 pointer-events-none" />
                        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 shadow-inner group-hover:scale-110 transition-transform">
                            <Gift className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-black text-foreground tracking-tight mt-3">أمنياتي</h3>
                    </motion.div>

                    {/* BENTO: COMMITMENTS (5x1) */}
                    <motion.button
                        whileHover={{ y: -5 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onNavigate('commitments')}
                        className="col-span-5 row-span-1 glass rounded-[2.5rem] border-zinc-200 dark:border-white/5 flex flex-col items-center justify-center gap-2 group"
                    >
                        <Target className="w-6 h-6 text-zinc-400 group-hover:text-rose-500 transition-colors" />
                        <span className="text-[8px] font-black text-zinc-400 group-hover:text-zinc-600 uppercase tracking-widest">تعهداتنا</span>
                    </motion.button>

                    {/* 3. MOOD SANCTUARY - ORGANIC INTEGRATION */}
                    <div className="col-span-12 mt-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            className="glass rounded-[3.5rem] p-10 border-white/60 dark:border-white/5 shadow-2xl relative overflow-hidden bg-gradient-to-br from-white/20 to-transparent dark:from-zinc-900/40"
                        >
                            <div className="absolute top-0 left-0 w-64 h-64 bg-rose-500/[0.02] rounded-full blur-[100px] -ml-32 -mt-32" />
                            <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-500/[0.02] rounded-full blur-[100px] -mr-32 -mb-32" />
                            
                            <div className="relative z-10 flex flex-col items-center gap-8">
                                <div className="text-center">
                                    <h3 className="text-2xl font-black text-foreground tracking-tight mb-2">سكنات الروح</h3>
                                    <p className="text-[10px] font-black text-rose-500/30 uppercase tracking-[0.5em]">بوح الوجدان لليوم</p>
                                </div>

                                <AnimatePresence mode="wait">
                                    {showMoodPrompt ? (
                                        <motion.div key="prompt" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex justify-center gap-6">
                                            {moods.map((m, idx) => {
                                                const Icon = m.icon;
                                                const isSelected = selectedMoodId === m.id;
                                                return (
                                                    <motion.button
                                                        key={m.id}
                                                        onClick={() => handleMoodSelect(m.id)}
                                                        whileHover={{ y: -10, scale: 1.1 }}
                                                        className="flex flex-col items-center gap-4 group/mood"
                                                    >
                                                        <div className={`w-16 h-16 rounded-3xl glass shadow-xl flex items-center justify-center ${m.color} ${isSelected ? 'ring-2 ring-primary bg-primary/10' : 'bg-white/40'} group-hover/mood:shadow-inner transition-all duration-500`}>
                                                            <Icon className="w-7 h-7" />
                                                        </div>
                                                        <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest group-hover/mood:text-foreground/40 transition-colors">{m.label}</span>
                                                    </motion.button>
                                                );
                                            })}
                                        </motion.div>
                                    ) : (
                                        <motion.div key="saved" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-8 w-full max-w-[320px]">
                                            <div className="flex items-center justify-between w-full relative">
                                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-[1px] bg-gradient-to-r from-transparent via-rose-500/20 to-transparent" />
                                                
                                                <div className="flex flex-col items-center gap-3 relative z-10">
                                                    <div className="w-20 h-20 glass border-rose-500/20 rounded-3xl flex items-center justify-center text-rose-500 shadow-2xl relative bg-white/60">
                                                        {selectedMoodId && moods.find(m => m.id === selectedMoodId) && (() => {
                                                            const Icon = moods.find(m => m.id === selectedMoodId)!.icon;
                                                            return <Icon className="w-10 h-10" />;
                                                        })()}
                                                        <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-[10px] text-white px-2 py-0.5 rounded-lg shadow-lg font-black tracking-widest">أنا</div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-center gap-3 relative z-10">
                                                    {partnerMood ? (
                                                        <div className="w-20 h-20 glass border-rose-500/20 rounded-3xl flex items-center justify-center text-rose-500 shadow-2xl relative bg-white/60">
                                                            {moods.find(m => m.id === partnerMood) && (() => {
                                                                const Icon = moods.find(m => m.id === partnerMood)!.icon;
                                                                return <Icon className="w-10 h-10" />;
                                                            })()}
                                                            <div className="absolute -bottom-2 -left-2 bg-rose-500 text-[10px] text-white px-2 py-0.5 rounded-lg shadow-lg font-black tracking-widest">الشريك</div>
                                                        </div>
                                                    ) : (
                                                        <div className="w-20 h-20 glass border-zinc-100 rounded-3xl flex items-center justify-center text-zinc-100 border-dashed animate-pulse">
                                                            <User size={30} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="text-center">
                                                <p className="text-lg font-black text-foreground tracking-tight mb-2">{partnerMood ? 'تحالف القلوب ✨' : 'بصمة وجدانية'}</p>
                                                <button onClick={() => setShowMoodPrompt(true)} className="text-[10px] font-black text-rose-500/40 uppercase tracking-[0.4em] hover:text-rose-500 transition-colors">تحديث الحالة</button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    </div>

                    {/* BENTO: TIMELINE PREVIEW (12x2) */}
                    <div className="col-span-12 mt-4 space-y-6">
                        <div className="flex items-center justify-between px-4">
                            <h3 className="text-xl font-black text-foreground tracking-tighter">قادم الأيام</h3>
                            <div className="w-8 h-8 rounded-full glass flex items-center justify-center text-rose-500/40">
                                <Sparkles size={16} />
                            </div>
                        </div>

                        <div className="space-y-4">
                            {upcomingEvents.length > 0 ? (
                                upcomingEvents.map((event, i) => {
                                    const days = calculateDaysUntil(event.event_date);
                                    return (
                                        <motion.div
                                            key={event.id}
                                            onClick={() => onNavigate('calendar')}
                                            className="glass rounded-[2rem] p-5 border-white/60 flex items-center justify-between group cursor-pointer hover:bg-white/80 transition-all shadow-sm"
                                        >
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover:text-rose-500 transition-colors overflow-hidden">
                                                    {event.image_url ? <img src={event.image_url} className="w-full h-full object-cover" /> : <Heart size={20} fill="currentColor" />}
                                                </div>
                                                <div className="text-right">
                                                    <h4 className="text-base font-black text-foreground tracking-tight">{event.title}</h4>
                                                    <p className="text-[10px] font-bold text-muted-foreground/40">{new Date(event.event_date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}</p>
                                                </div>
                                            </div>
                                            <div className="bg-rose-50 text-rose-500 text-[10px] font-black px-4 py-2 rounded-xl shadow-inner">
                                                {days === 0 ? 'اليوم' : `باقي ${days} يوم`}
                                            </div>
                                        </motion.div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-10 opacity-20"><Heart className="mx-auto mb-2" /></div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {/* MAP OVERLAY - FULL SCREEN EXPERIENCE */}
            <AnimatePresence>
                {showMap && (
                    <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 100 }}
                        className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-2xl p-6 flex flex-col"
                    >
                        <header className="flex items-center justify-between mb-8">
                            <button onClick={() => setShowMap(false)} className="w-14 h-14 glass rounded-2xl flex items-center justify-center text-rose-500 shadow-xl">
                                <ChevronLeft className="rotate-180" />
                            </button>
                            <div className="text-right">
                                <h2 className="text-xl font-black tracking-tighter">موقع الروح</h2>
                                <p className="text-[10px] font-black text-rose-500/40 tracking-[0.4em] uppercase">اتصال حي الآن</p>
                            </div>
                        </header>

                        <div className="flex-1 rounded-[3rem] overflow-hidden border border-white shadow-2xl relative mb-8">
                            {partnerTracking.lat && partnerTracking.lng ? (
                                <iframe
                                    width="100%" height="100%" frameBorder="0"
                                    style={{ border: 0, filter: isDarkMode ? 'invert(90%) hue-rotate(180deg)' : 'none' }}
                                    src={`https://maps.google.com/maps?q=${partnerTracking.lat},${partnerTracking.lng}&z=15&output=embed`}
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-4 opacity-20"><Compass size={60} className="animate-spin-slow" /><p>تحديد الموقع...</p></div>
                            )}
                        </div>

                        <div className="glass rounded-[3rem] p-8 flex items-center justify-between border-white shadow-2xl bg-white/40">
                             <div className="flex items-center gap-5">
                                <div className="w-20 h-20 rounded-[1.8rem] border-4 border-white shadow-lg overflow-hidden">
                                     {avatars.partner ? <img src={avatars.partner} className="w-full h-full object-cover" /> : <User size={40} className="m-auto opacity-10" />}
                                </div>
                                <div className="text-right">
                                    <h3 className="text-lg font-black tracking-tight">{isPartnerOnline() ? 'متصل الآن' : formatLastSeen(partnerTracking.last_seen)}</h3>
                                    <p className="text-[11px] font-bold text-rose-500 opacity-60">تبعد المسافة {distance} عنك</p>
                                </div>
                             </div>
                             <button
                                onClick={() => { if (partnerTracking.lat && partnerTracking.lng) window.open(`https://www.google.com/maps/dir/?api=1&destination=${partnerTracking.lat},${partnerTracking.lng}`, '_blank'); }}
                                className="w-16 h-16 bg-rose-500 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-rose-500/30"
                             >
                                <Navigation fill="currentColor" />
                             </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="h-40" />
        </div>
    );
}

const calculateDaysUntil = (date: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(date);
    eventDate.setHours(0, 0, 0, 0);
    const diffTime = eventDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};
