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
import { motion, AnimatePresence } from 'motion/react';

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

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'صباح الخير والمودة';
        if (hour < 18) return 'طاب يومك بكل حب';
        return 'مساء السكينة والمودة';
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

    const loadHomeData = async () => {
        const today = new Date().toISOString().split('T')[0];
        const [partnershipRes, upcomingEventsRes, pastEventsRes, moodRes] = await Promise.allSettled([
            supabase.from('partnerships').select('*, user1:user1_id(avatar_url, last_seen, latitude, longitude), user2:user2_id(avatar_url, last_seen, latitude, longitude)').eq('id', partnershipId).single(),
            supabase.from('calendar_events').select('*').eq('partnership_id', partnershipId).gte('event_date', today).order('event_date', { ascending: true }).limit(1),
            supabase.from('calendar_events').select('*').eq('partnership_id', partnershipId).lt('event_date', today).not('image_url', 'is', null).order('event_date', { ascending: false }).limit(1),
            supabase.from('mood_logs').select('id').eq('user_id', userId).eq('mood_date', today).maybeSingle()
        ]);

        let combinedEvents: any[] = [];
        if (upcomingEventsRes.status === 'fulfilled' && upcomingEventsRes.value.data) combinedEvents = [...upcomingEventsRes.value.data];
        if (pastEventsRes.status === 'fulfilled' && pastEventsRes.value.data) combinedEvents = [...combinedEvents, ...pastEventsRes.value.data];
        setUpcomingEvents(combinedEvents);

        if (partnershipRes.status === 'fulfilled' && partnershipRes.value.data) {
            const p = partnershipRes.value.data;
            setPartnership(p);
            const start = new Date(p.relationship_start_date || p.created_at);
            const now = new Date();
            const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            setDaysTogether(diff + 1);

            const isUser1 = p.user1_id === userId;
            const partner = isUser1 ? p.user2 : p.user1;
            setAvatars({ me: (isUser1 ? p.user1 : p.user2 as any)?.avatar_url, partner: (partner as any)?.avatar_url });

            const partnerData = partner as any;
            setPartnerTracking({ last_seen: partnerData?.last_seen, lat: partnerData?.latitude, lng: partnerData?.longitude });

            if (partnerData?.latitude && partnerData?.longitude && myLocation.lat && myLocation.lng) {
                const d = calculateDistance(myLocation.lat, myLocation.lng, partnerData.latitude, partnerData.longitude);
                setDistance(d);
                const R = 6371;
                const dLat = (partnerData.latitude - myLocation.lat) * Math.PI / 180;
                const dLon = (partnerData.longitude - myLocation.lng) * Math.PI / 180;
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(myLocation.lat * Math.PI / 180) * Math.cos(partnerData.latitude * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                setDistKm(R * c);
            }
        }
        if (moodRes.status === 'fulfilled' && moodRes.value.data) setShowMoodPrompt(false);

        // Fetch Adventure Jar Balance
        const { data: jar } = await supabase.from('finance_jars').select('current_amount').eq('partnership_id', partnershipId).eq('title', 'حصالة المغامرات').maybeSingle();
        if (jar) setAdventureBalance(jar.current_amount);
    };

    useEffect(() => {
        if (partnershipId && userId) {
            loadHomeData();
            updateMyStatus();
            const interval = setInterval(() => { updateMyStatus(); loadHomeData(); }, 60000);
            return () => clearInterval(interval);
        }
    }, [partnershipId, userId, myLocation.lat]);

    const moods = [
        { id: 'happy', icon: Sun, label: 'مشرقة', color: 'text-amber-500', bg: 'bg-amber-500/10' },
        { id: 'calm', icon: ShieldCheck, label: 'مطمئنة', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { id: 'tired', icon: Moon, label: 'هادئة', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
        { id: 'sad', icon: Cloud, label: 'غائمة', color: 'text-rose-500', bg: 'bg-rose-500/10' },
    ];

    const handleMoodSelect = async (mood: string) => {
        if (!userId) return;
        setShowMoodPrompt(false);
        const today = new Date().toISOString().split('T')[0];
        await supabase.from('mood_logs').upsert({ user_id: userId, mood_date: today, mood: mood }, { onConflict: 'user_id,mood_date' });
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
            {/* Ambient Background Aura */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[100%] h-[60%] bg-[#ec4899]/10 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[80%] h-[60%] bg-amber-500/5 blur-[150px] rounded-full" />
            </div>

            <header className="px-8 pt-10 pb-6 sticky top-0 bg-background/40 backdrop-blur-3xl z-40">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col text-right">
                        <p className="text-[9px] font-black uppercase tracking-[0.5em] text-[#f43f5e] opacity-40 mb-1">{getGreeting()}</p>
                        <div className="flex items-center gap-3">
                            <Logo size="sm" />
                            <h1 className="text-2xl font-black text-foreground tracking-tighter">أُلْفَة</h1>
                        </div>
                    </div>
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        whileHover={{ rotate: 15 }}
                        onClick={() => onNavigate('settings')}
                        className="w-12 h-12 flex items-center justify-center glass rounded-2xl border-white/40 shadow-xl"
                    >
                        <Settings className="w-5 h-5 text-foreground/40" />
                    </motion.button>
                </div>
            </header>

            <div className="px-8 mt-8 space-y-12">
                {/* Connection Widget - Updated */}
                <section className="relative perspective-[2000px]">
                    <AnimatePresence mode="wait">
                        {!showMap ? (
                            <motion.div
                                key="stats"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="relative glass rounded-[3rem] p-8 border-white/60 dark:border-white/10 overflow-hidden shadow-2xl bg-white/40 dark:bg-[#0a0505]/60 transition-all duration-700"
                            >
                                {/* Romantic Mesh & Floating Hearts Background - Fills Entire Card */}
                                <div className="absolute inset-0 bg-gradient-to-br from-[#f43f5e]/5 via-transparent to-amber-500/5 pointer-events-none overflow-hidden">
                                    <motion.div
                                        animate={{
                                            scale: [1, 1.3, 1],
                                            rotate: [0, 45, 0],
                                            opacity: [0.3, 0.4, 0.3]
                                        }}
                                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                                        className="absolute top-0 right-0 w-64 h-64 bg-rose-400/5 blur-[100px] rounded-full"
                                    />
                                    {[...Array(6)].map((_, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ y: 140, x: Math.random() * 320, opacity: 0 }}
                                            animate={{
                                                y: -40,
                                                opacity: [0, 0.3, 0],
                                                scale: [0.5, 1, 0.8]
                                            }}
                                            transition={{
                                                duration: 10 + Math.random() * 8,
                                                repeat: Infinity,
                                                delay: i * 2,
                                                ease: "easeInOut"
                                            }}
                                            className="absolute text-rose-500/10"
                                        >
                                            <Heart size={12 + i * 4} fill="currentColor" />
                                        </motion.div>
                                    ))}
                                </div>

                                <div className="relative z-10 flex flex-col gap-4">

                                    {/* Header: Centered Infinity Avatars with Vibrant Flow */}
                                    <div className="flex flex-col items-center py-2 relative">
                                        <div className="relative w-full max-w-[260px] h-28 flex items-center justify-center">
                                            {/* Advanced Infinity Path SVG Animation */}
                                            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox="0 0 260 110">
                                                <defs>
                                                    <filter id="glow">
                                                        <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                                                        <feMerge>
                                                            <feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" />
                                                        </feMerge>
                                                    </filter>
                                                    <linearGradient id="infinity-magical" x1="0%" y1="0%" x2="100%" y2="0%">
                                                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0" />
                                                        <stop offset="25%" stopColor="#f43f5e" stopOpacity="0.8" />
                                                        <stop offset="50%" stopColor="#fb7185" stopOpacity="1" />
                                                        <stop offset="75%" stopColor="#f43f5e" stopOpacity="0.8" />
                                                        <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                                                    </linearGradient>
                                                </defs>

                                                {/* Ambient Path Trace */}
                                                <path
                                                    d="M 65 55 C 65 15, 15 15, 15 55 C 15 95, 65 95, 130 55 C 195 15, 245 15, 245 55 C 245 95, 195 95, 130 55 L 65 55"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="0.5"
                                                    className="text-rose-500/5"
                                                />

                                                {/* Glowing Magical Flow - Slower & More Subtle */}
                                                <motion.path
                                                    d="M 65 55 C 65 15, 15 15, 15 55 C 15 95, 65 95, 130 55 C 195 15, 245 15, 245 55 C 245 95, 195 95, 130 55 L 65 55"
                                                    fill="none"
                                                    stroke="url(#infinity-magical)"
                                                    strokeWidth="1.5"
                                                    strokeLinecap="round"
                                                    strokeDasharray="90 310"
                                                    filter="url(#glow)"
                                                    animate={{ strokeDashoffset: [-400, 0] }}
                                                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                                                    className="opacity-40"
                                                />
                                                {/* Flowing Particle Orbs - Slower & Faded */}
                                                {[0, 1].map((i) => (
                                                    <motion.circle
                                                        key={i}
                                                        r="2"
                                                        fill="#f43f5e"
                                                        fillOpacity="0.5"
                                                        filter="url(#glow)"
                                                        initial={{ offsetDistance: "0%" }}
                                                        animate={{ offsetDistance: "100%" }}
                                                        transition={{
                                                            duration: 12,
                                                            repeat: Infinity,
                                                            ease: "linear",
                                                            delay: i * 6
                                                        }}
                                                        style={{ offsetPath: "path('M 65 55 C 65 15, 15 15, 15 55 C 15 95, 65 95, 130 55 C 195 15, 245 15, 245 55 C 245 95, 195 95, 130 55 L 65 55')" }}
                                                    />
                                                ))}
                                            </svg>

                                            <div className="flex items-center justify-center -space-x-8 relative z-10 w-full pt-1">
                                                <motion.div
                                                    animate={{
                                                        y: [0, -5, 0],
                                                        rotate: [-1, 2, -1]
                                                    }}
                                                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                                    className="w-20 h-20 rounded-[2.2rem] border-[4px] border-white dark:border-white/20 shadow-2xl overflow-hidden bg-white/5 relative group"
                                                >
                                                    {avatars.me ? <img src={avatars.me} className="w-full h-full object-cover transition-transform group-hover:scale-110" /> : <User className="w-full h-full p-4 text-[#f43f5e] opacity-20" />}
                                                    <div className="absolute top-2.5 right-2.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-lg" />
                                                </motion.div>

                                                <div className="relative z-30 mx-[-6px]">
                                                    <motion.div
                                                        animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.1, 0.4] }}
                                                        transition={{ duration: 2, repeat: Infinity }}
                                                        className="absolute inset-0 bg-rose-400 blur-2xl rounded-full"
                                                    />
                                                    <div className="w-14 h-14 rounded-full glass border-white dark:border-white/20 shadow-2xl flex items-center justify-center bg-white/95 dark:bg-black/60 backdrop-blur-2xl">
                                                        <motion.div
                                                            animate={{
                                                                scale: nudgeActive ? [1, 1.6, 1] : [1, 1.15, 1],
                                                                rotate: nudgeActive ? [0, 20, -20, 0] : 0
                                                            }}
                                                            transition={{ repeat: nudgeActive ? 0 : Infinity, duration: nudgeActive ? 0.3 : 2 }}
                                                        >
                                                            <Heart className="w-7 h-7 text-[#f43f5e] fill-current drop-shadow-[0_0_12px_rgba(244,63,94,0.7)]" />
                                                        </motion.div>
                                                    </div>
                                                </div>

                                                <motion.div
                                                    animate={{
                                                        y: [0, 5, 0],
                                                        rotate: [2, -1, 2]
                                                    }}
                                                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                                                    className="w-20 h-20 rounded-[2.2rem] border-[4px] border-white dark:border-white/20 shadow-2xl overflow-hidden bg-white/5 relative group"
                                                >
                                                    {avatars.partner ? <img src={avatars.partner} className="w-full h-full object-cover transition-transform group-hover:scale-110" /> : <Heart className="w-full h-full p-4 text-[#f43f5e] opacity-10" />}
                                                    <div className={`absolute top-2.5 left-2.5 w-3.5 h-3.5 ${isPartnerOnline() ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'} border-2 border-white rounded-full shadow-lg`} />
                                                </motion.div>
                                            </div>
                                        </div>

                                        <div className="text-center mt-3">
                                            <h2 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2 justify-center">
                                                <span>{distKm && distKm < 1 ? 'قرب الروح' : 'اتصال المودة'}</span>
                                            </h2>
                                            <div className="flex items-center justify-center gap-2 mt-1">
                                                <p className="text-[9px] font-black text-[#f43f5e] uppercase tracking-[0.4em] opacity-40">أُلْفَة لا تنتهي</p>
                                                <div className="flex items-center gap-1.5 px-3 py-1 bg-white/40 dark:bg-white/10 rounded-full border border-rose-100 dark:border-white/10 shadow-sm">
                                                    <span className="text-[9px] font-bold text-foreground/70">
                                                        {formatLastSeen(partnerTracking.last_seen)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Main Display: Days & Distance Duo - More Compact */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-white/30 dark:bg-white/5 border border-white/50 dark:border-white/10 p-4 rounded-[2rem] flex flex-col items-center shadow-sm backdrop-blur-md">
                                            <span className="text-[7px] font-black text-[#f43f5e] uppercase tracking-widest mb-0.5 opacity-60">رحلة العهد</span>
                                            <div className="flex items-baseline gap-0.5">
                                                <span className="text-2xl font-black text-foreground tracking-tighter">{daysTogether}</span>
                                                <span className="text-[8px] font-black text-foreground/40">يوم</span>
                                            </div>
                                        </div>
                                        <div className="bg-white/30 dark:bg-white/5 border border-white/50 dark:border-white/10 p-4 rounded-[2rem] flex flex-col items-center shadow-sm backdrop-blur-md">
                                            <span className="text-[7px] font-black text-[#f43f5e] uppercase tracking-widest mb-0.5 opacity-60">المسافة الآن</span>
                                            <div className="flex items-baseline gap-0.5">
                                                <span className="text-2xl font-black text-[#f43f5e] tracking-tighter">{distance?.split(' ')[0] || '--'}</span>
                                                <span className="text-[8px] font-black text-[#f43f5e] opacity-60">{distance?.split(' ')[1] || 'كم'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Hub - Compact & Innovative Buttons */}
                                    <div className="flex items-center justify-between gap-3 pt-2">
                                        <motion.button
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => updateMyStatus().then(loadHomeData)}
                                            disabled={isSyncing}
                                            className="h-12 w-12 bg-white dark:bg-white/10 rounded-2xl flex items-center justify-center text-[#f43f5e] shadow-lg border border-white/60 active:bg-rose-50"
                                        >
                                            <Zap className={`w-5 h-5 ${isSyncing ? 'animate-spin text-amber-500' : ''}`} />
                                        </motion.button>

                                        <motion.button
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => setShowMap(true)}
                                            className="h-12 w-12 bg-white dark:bg-white/10 rounded-2xl flex items-center justify-center text-[#f43f5e] shadow-lg border border-white/60 active:bg-rose-50"
                                        >
                                            <MapPin className="w-5 h-5" />
                                        </motion.button>

                                        <motion.button
                                            whileTap={{ scale: 0.96 }}
                                            onClick={handleNudge}
                                            className="flex-1 h-12 bg-gradient-to-r from-[#f43f5e] to-[#fb7185] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-rose-200 dark:shadow-rose-900/40 flex items-center justify-center gap-2 group/nudge"
                                        >
                                            <Heart className={`w-5 h-5 ${nudgeActive ? 'fill-white animate-bounce' : 'fill-white/40'}`} />
                                            <span>تنبيه المودة</span>
                                        </motion.button>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="map"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ type: "spring", damping: 20, stiffness: 100 }}
                                className="relative glass rounded-[3rem] h-[520px] border-white/60 overflow-hidden shadow-2xl bg-white/40 dark:bg-white/5"
                            >
                                {/* Interactive Map Placeholder / Embed */}
                                <div className="absolute inset-0 bg-mood/5">
                                    {partnerTracking.lat && partnerTracking.lng ? (
                                        <iframe
                                            width="100%"
                                            height="100%"
                                            frameBorder="0"
                                            style={{ border: 0, filter: isDarkMode ? 'invert(90%) hue-rotate(180deg)' : 'none' }}
                                            src={`https://maps.google.com/maps?q=${partnerTracking.lat},${partnerTracking.lng}&z=15&output=embed`}
                                            allowFullScreen
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-4">
                                            <Compass className="w-20 h-20 animate-spin-slow" />
                                            <p className="text-[10px] font-black uppercase tracking-widest">جاري تحديد الموقع...</p>
                                        </div>
                                    )}
                                </div>

                                {/* Map Overlay UI */}
                                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8">
                                    <div className="flex items-center justify-between pointer-events-auto">
                                        <button
                                            onClick={() => setShowMap(false)}
                                            className="w-12 h-12 bg-white/10 dark:bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center text-white dark:text-mood shadow-2xl backdrop-blur-md"
                                        >
                                            <ChevronLeft className="w-6 h-6 rotate-180" />
                                        </button>
                                        <div className="bg-white/10 dark:bg-white/10 px-6 py-3 rounded-2xl border border-white/20 backdrop-blur-md flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                            <span className="text-[10px] font-black text-white dark:text-mood uppercase tracking-widest">مباشر الآن</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pointer-events-auto">
                                        <div className="bg-[#500018]/90 dark:bg-black/80 p-6 rounded-[2.5rem] border border-white/10 backdrop-blur-2xl flex items-center justify-between shadow-2xl active:scale-[0.98] transition-all duration-300">
                                            <div className="flex items-center gap-5">
                                                <div className="relative">
                                                    <div className="w-16 h-16 rounded-[1.5rem] border-2 border-white/20 overflow-hidden bg-white/10 shadow-lg">
                                                        {avatars.partner ? <img src={avatars.partner} className="w-full h-full object-cover" /> : <Heart className="w-full h-full p-4 text-white" />}
                                                    </div>
                                                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-white border border-rose-200 flex items-center justify-center text-base shadow-lg text-mood">
                                                        📍
                                                    </div>
                                                </div>
                                                <div className="flex flex-col text-right">
                                                    <h3 className="text-white font-black text-lg tracking-tight">موقع الروح</h3>
                                                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest leading-relaxed">تبعد {distance} عنك الآن</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (partnerTracking.lat && partnerTracking.lng) {
                                                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${partnerTracking.lat},${partnerTracking.lng}`, '_blank');
                                                    }
                                                }}
                                                className="w-14 h-14 bg-mood text-white rounded-2xl flex items-center justify-center shadow-xl shadow-mood/40 hover:scale-105 active:scale-95 transition-all"
                                            >
                                                <Navigation className="w-6 h-6 fill-current" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>

                {/* Experience Navigation */}
                <section className="grid grid-cols-1 gap-6">
                    <motion.button
                        whileHover={{ y: -6, scale: 1.01 }}
                        onClick={() => onNavigate('love_notes')}
                        className="w-full group glass rounded-[3rem] p-8 border-white/50 flex items-center justify-between overflow-hidden shadow-2xl relative"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-mood/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-mood/10 transition-colors" />
                        <div className="flex items-center gap-6 relative z-10 text-right">
                            <div className="w-16 h-16 rounded-[2rem] bg-mood/5 border border-white/20 flex items-center justify-center text-mood group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 shadow-xl shadow-mood/5">
                                <Feather className="w-8 h-8" />
                            </div>
                            <div className="text-right space-y-1">
                                <h3 className="text-xl font-black text-foreground tracking-tight">بريد الألفة</h3>
                                <p className="text-[9px] font-black text-mood opacity-40 uppercase tracking-[0.4em]">كلمات تخلد في الذاكرة</p>
                            </div>
                        </div>
                        <ChevronLeft className="w-5 h-5 text-foreground/20 group-hover:translate-x-[-6px] transition-transform" />
                    </motion.button>

                    <motion.button
                        whileHover={{ y: -6, scale: 1.01 }}
                        onClick={() => onNavigate('adventure_bucket')}
                        className="w-full group relative overflow-hidden glass rounded-[3rem] p-8 border-white/50 flex flex-col gap-8 shadow-2xl"
                    >
                        <div className="absolute top-0 left-0 w-40 h-40 bg-amber-500/5 rounded-full blur-[80px] -ml-20 -mt-20 group-hover:bg-amber-500/10 transition-colors" />
                        <div className="flex items-center justify-between relative z-10 w-full">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-[2rem] bg-amber-500/5 border border-white/20 flex items-center justify-center text-amber-500 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 shadow-xl shadow-amber-500/5">
                                    <Map className="w-8 h-8" />
                                </div>
                                <div className="text-right space-y-1">
                                    <h3 className="text-xl font-black text-foreground tracking-tight">مغامراتنا الموعودة</h3>
                                    <p className="text-[9px] font-black text-amber-600/40 uppercase tracking-[0.5em]">طلعات، سفرات، وأحلام مشتركة</p>
                                </div>
                            </div>
                            <ChevronLeft className="w-5 h-5 text-foreground/20 group-hover:translate-x-[-6px] transition-transform" />
                        </div>

                        <div className="flex items-center justify-between bg-white/20 dark:bg-black/40 backdrop-blur-xl rounded-[2rem] p-6 border border-white/60 dark:border-white/10 shadow-inner">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/5 border border-white/20 flex items-center justify-center text-amber-500">
                                    <Compass className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-amber-600/40 uppercase tracking-widest mb-0.5">رصيد المغامرات</span>
                                    <span className="text-lg font-black text-foreground tracking-tighter">{adventureBalance.toLocaleString()} د.أ</span>
                                </div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:translate-x-[-4px] transition-transform">
                                <Zap className="w-4 h-4 fill-amber-500/20" />
                            </div>
                        </div>
                    </motion.button>


                </section>

                {/* Mood Sanctuary */}
                <section className="glass rounded-[3rem] p-10 border-white/60 dark:border-white/10 shadow-2xl relative overflow-hidden bg-white/20 dark:bg-[#0a0505]/60">
                    <div className="absolute top-0 left-0 w-40 h-40 bg-mood/5 rounded-full blur-[100px] -ml-20 -mt-20" />
                    <div className="text-center mb-10 relative z-10">
                        <h3 className="text-2xl font-black text-foreground mb-2 tracking-tighter">نزعة الروح</h3>
                        <p className="text-[9px] font-black text-mood/40 uppercase tracking-[0.4em] leading-relaxed">بصمتك الوجدانية لهذا اليوم</p>
                    </div>

                    <AnimatePresence mode="wait">
                        {showMoodPrompt ? (
                            <motion.div key="prompt" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="grid grid-cols-4 gap-6 relative z-10">
                                {moods.map((m, idx) => {
                                    const Icon = m.icon;
                                    return (
                                        <motion.button
                                            key={m.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.1 }}
                                            onClick={() => handleMoodSelect(m.id)}
                                            className="flex flex-col items-center gap-4 group/mood"
                                        >
                                            <div className={`w-16 h-16 rounded-[1.8rem] glass border-white shadow-2xl flex items-center justify-center ${m.color} transition-all duration-500 group-hover/mood:scale-110 group-hover/mood:-translate-y-2 group-hover/mood:shadow-mood/10`}>
                                                <Icon className="w-7 h-7" />
                                            </div>
                                            <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">{m.label}</span>
                                        </motion.button>
                                    );
                                })}
                            </motion.div>
                        ) : (
                            <motion.div key="saved" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-12 gap-8 relative z-10">
                                <div className="w-24 h-24 glass border-emerald-500/30 rounded-[2.5rem] flex items-center justify-center text-emerald-500 shadow-2xl shadow-emerald-500/10">
                                    <ShieldCheck className="w-12 h-12" />
                                </div>
                                <div className="text-center space-y-3">
                                    <p className="text-2xl font-black text-foreground tracking-tight">سكنت مشاعرك</p>
                                    <p className="text-[10px] font-black text-emerald-600/40 uppercase tracking-[0.3em]">تمت الموعودة بنجاح ✅</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>

                {/* Upcoming Events Journey */}
                <section className="space-y-6 group/journey relative">
                    {/* Background Journey Path decor - Thinner & more subtle */}
                    <div className="absolute top-20 bottom-10 left-[2.2rem] w-[0.5px] bg-gradient-to-b from-mood/30 via-mood/5 to-transparent -translate-x-1/2 z-0" />

                    <div className="flex items-center justify-between px-4 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-mood/10 flex items-center justify-center text-mood shadow-inner border border-mood/5">
                                <Compass className="w-5 h-5 animate-spin-slow" />
                            </div>
                            <div className="text-right">
                                <h3 className="text-xl font-black text-foreground tracking-tight">محطات المسير</h3>
                                <p className="text-[7px] font-black text-muted-foreground/30 uppercase tracking-[0.3em]">رحلة تقارب القلوب</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => onNavigate('calendar')}
                                className="text-[10px] font-black text-[#f43f5e] px-6 py-3 bg-[#f43f5e]/5 border-2 border-[#f43f5e]/20 rounded-2xl uppercase tracking-[0.1em] transition-all hover:bg-[#f43f5e] hover:text-white shadow-sm"
                            >
                                جدول الأيام
                            </button>
                            <button
                                onClick={() => onNavigate('calendar')}
                                className="w-12 h-12 rounded-2xl bg-[#f43f5e] text-white flex items-center justify-center shadow-xl shadow-[#f43f5e]/20 hover:scale-110 active:scale-90 transition-all outline-none border-none"
                            >
                                <PlusCircle className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {upcomingEvents.length > 0 ? (
                            upcomingEvents.map((event, i) => {
                                const days = calculateDaysUntil(event.event_date);
                                const isPast = days < 0;
                                return (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.1, duration: 0.6 }}
                                        key={event.id}
                                        className="relative group block"
                                    >
                                        <div className="glass rounded-[1.8rem] p-4 border-white/60 dark:border-white/10 flex items-center justify-between shadow-xl hover:shadow-mood/10 transition-all duration-700 bg-white/5 dark:bg-black/20 relative overflow-hidden group-hover:translate-x-[-4px]">
                                            {/* Subtle Sweep Effect */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-mood/0 via-mood/5 to-mood/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out pointer-events-none" />

                                            <div className="flex items-center gap-4 relative z-10">
                                                {/* Station Marker */}
                                                <div className="relative shrink-0">
                                                    <div className="w-12 h-12 rounded-[1.2rem] bg-mood/5 border border-white/20 overflow-hidden flex items-center justify-center text-mood shadow-md group-hover:scale-110 transition-transform duration-500">
                                                        {event.image_url ? (
                                                            <img src={event.image_url} className="w-full h-full object-cover" alt="" />
                                                        ) : (
                                                            event.title.includes('ذكرى') ? <Gift className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />
                                                        )}
                                                    </div>
                                                    {!isPast && (
                                                        <motion.div
                                                            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
                                                            transition={{ duration: 2, repeat: Infinity }}
                                                            className="absolute -top-1 -right-1 w-3 h-3 bg-mood rounded-full border-2 border-white z-20"
                                                        />
                                                    )}
                                                </div>

                                                <div className="text-right space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="text-base font-black text-foreground tracking-tight group-hover:text-mood transition-colors">{event.title}</h4>
                                                        {isPast && (
                                                            <span className="text-[6px] font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-md uppercase tracking-widest">مضت</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[8px] font-black text-muted-foreground/30 uppercase tracking-[0.1em]">
                                                        <CalendarIcon className="w-2.5 h-2.5" />
                                                        <span>{new Date(event.event_date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Compact Countdown Badge */}
                                            <div className="relative shrink-0">
                                                {!isPast && (
                                                    <motion.div
                                                        animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.25, 0.1] }}
                                                        transition={{ duration: 4, repeat: Infinity }}
                                                        className="absolute inset-0 bg-mood blur-xl rounded-full"
                                                    />
                                                )}
                                                <div className={`
                                                    relative z-10 h-14 min-w-[3.5rem] px-3 rounded-2xl flex flex-col items-center justify-center shadow-inner transition-all duration-500
                                                    ${isPast ? 'bg-zinc-50 dark:bg-white/5 border border-zinc-100/50' : 'bg-gradient-to-br from-[#f43f5e] to-[#fb7185] shadow-lg shadow-mood/20'}
                                                `}>
                                                    <span className={`text-[7px] font-black uppercase tracking-tight mb-0.5 ${isPast ? 'text-zinc-400' : 'text-white/70'}`}>
                                                        {isPast ? 'منذ' : 'المتبقي'}
                                                    </span>
                                                    <div className="flex items-baseline gap-0.5">
                                                        <span className={`text-xl font-black leading-none ${isPast ? 'text-zinc-500' : 'text-white'}`}>
                                                            {Math.abs(days)}
                                                        </span>
                                                        <span className={`text-[6px] font-black ${isPast ? 'text-zinc-300' : 'text-white/50'}`}>يوم</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })
                        ) : (
                            <div className="glass rounded-[4rem] p-20 border-white/40 dark:border-white/10 text-center space-y-10 border-dashed group hover:border-mood/20 transition-all duration-1000 bg-white/10 dark:bg-black/40">
                                <div className="w-24 h-24 rounded-[2.5rem] bg-white/10 border border-white/20 flex items-center justify-center mx-auto opacity-10 group-hover:opacity-30 group-hover:rotate-45 transition-all duration-700">
                                    <PlusCircle className="w-12 h-12" />
                                </div>
                                <div className="space-y-4">
                                    <p className="text-[11px] font-black text-muted-foreground/20 uppercase tracking-[0.4em]">أفقنا خالٍ من الوعود</p>
                                    <button onClick={() => onNavigate('calendar')} className="text-[11px] font-black text-white bg-mood px-12 py-5 rounded-[2.5rem] shadow-2xl shadow-mood/20 hover:scale-105 active:scale-95 transition-all">بناء وعد جديد</button>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div >
        </div >
    );
}
