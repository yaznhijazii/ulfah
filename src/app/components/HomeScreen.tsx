import { useState, useEffect, useCallback } from 'react';
import { Settings, Ruler, Image as ImageIcon, CheckCircle, Laugh, Smile, Meh, Frown, Sparkles, ChevronLeft, MapPin, Feather, Heart, MessageCircle, PlusCircle, Calendar as CalendarIcon } from 'lucide-react';
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

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'صباح الخير';
        if (hour < 18) return 'طاب يومُك';
        return 'مساء الحب';
    };

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // Radius of the earth in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // Distance in km
        if (d < 1) return `${Math.round(d * 1000)} م`;
        return `${d.toFixed(1)} كم`;
    };

    const updateMyStatus = useCallback(async () => {
        if (!userId) return;

        let lat = null;
        let lng = null;

        if ("geolocation" in navigator) {
            try {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject);
                });
                lat = position.coords.latitude;
                lng = position.coords.longitude;
                setMyLocation({ lat, lng });
            } catch (e) {
                console.log("Geolocation permission denied or error.");
            }
        }

        await supabase.from('users').update({
            last_seen: new Date().toISOString(),
            ...(lat && lng ? { latitude: lat, longitude: lng } : {})
        }).eq('id', userId);
    }, [userId]);

    const loadHomeData = async () => {
        const today = new Date().toISOString().split('T')[0];

        const [partnershipRes, eventsRes, moodRes] = await Promise.allSettled([
            supabase.from('partnerships').select('*, user1:user1_id(avatar_url, last_seen, latitude, longitude), user2:user2_id(avatar_url, last_seen, latitude, longitude)').eq('id', partnershipId).single(),
            supabase.from('calendar_events').select('*').eq('partnership_id', partnershipId).gte('event_date', today).order('event_date', { ascending: true }).limit(2),
            supabase.from('mood_logs').select('id').eq('user_id', userId).eq('mood_date', today).maybeSingle()
        ]);

        if (partnershipRes.status === 'fulfilled' && partnershipRes.value.data) {
            const p = partnershipRes.value.data;
            const start = new Date(p.relationship_start_date || p.created_at);
            const now = new Date();
            const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            setDaysTogether(diff + 1);

            const isUser1 = p.user1_id === userId;
            const me = isUser1 ? p.user1 : p.user2;
            const partner = isUser1 ? p.user2 : p.user1;

            setAvatars({ me: (me as any)?.avatar_url, partner: (partner as any)?.avatar_url });

            const partnerData = partner as any;
            setPartnerTracking({
                last_seen: partnerData?.last_seen,
                lat: partnerData?.latitude,
                lng: partnerData?.longitude
            });

            if (partnerData?.latitude && partnerData?.longitude && myLocation.lat && myLocation.lng) {
                setDistance(calculateDistance(myLocation.lat, myLocation.lng, partnerData.latitude, partnerData.longitude));
            }
        }

        if (eventsRes.status === 'fulfilled' && eventsRes.value.data) {
            setUpcomingEvents(eventsRes.value.data);
        }

        if (moodRes.status === 'fulfilled' && moodRes.value.data) {
            setShowMoodPrompt(false);
        }
    };

    useEffect(() => {
        if (partnershipId && userId) {
            loadHomeData();
            updateMyStatus();

            const interval = setInterval(() => {
                updateMyStatus();
                loadHomeData();
            }, 30000); // 30 seconds

            return () => clearInterval(interval);
        }
    }, [partnershipId, userId, myLocation.lat]);

    const getPartnerStatus = () => {
        if (!partnerTracking.last_seen) return null;
        const lastSeen = new Date(partnerTracking.last_seen);
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));

        if (diffInMinutes < 1.5) return { text: 'متصل الآن', color: 'text-emerald-500' };
        if (diffInMinutes < 60) return { text: `نشط منذ ${diffInMinutes} د`, color: 'text-muted-foreground' };
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return { text: `نشط منذ ${diffInHours} س`, color: 'text-muted-foreground' };
        return { text: 'بعيد منذ فترة', color: 'text-muted-foreground' };
    };

    const moods = [
        { id: 'happy', icon: Laugh, label: 'سعيد', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { id: 'calm', icon: Smile, label: 'مرتاح', color: 'text-sky-500', bg: 'bg-sky-500/10' },
        { id: 'tired', icon: Meh, label: 'متعب', color: 'text-amber-500', bg: 'bg-amber-500/10' },
        { id: 'sad', icon: Frown, label: 'حزين', color: 'text-rose-500', bg: 'bg-rose-500/10' },
    ];

    const handleMoodSelect = async (mood: string) => {
        if (!userId) return;
        setShowMoodPrompt(false);
        const today = new Date().toISOString().split('T')[0];
        try {
            await supabase.from('mood_logs').upsert({
                user_id: userId,
                mood_date: today,
                mood: mood,
            }, { onConflict: 'user_id,mood_date' });
        } catch (err) {
            console.error('Error saving mood:', err);
            setShowMoodPrompt(true); // Re-show prompts on error
            alert('حدث خطأ أثناء حفظ المشاعر');
        }
    };

    const calculateDaysUntil = (date: string) => {
        const diff = new Date(date).getTime() - new Date().getTime();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    };

    const status = getPartnerStatus();

    return (
        <div className="flex-1 bg-background overflow-x-hidden scrollbar-hide">
            <header className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-2xl z-30 border-b border-border/40">
                <div className="flex flex-col">
                    <motion.p
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/60 mb-1"
                    >
                        {getGreeting()}
                    </motion.p>
                    <div className="flex items-center gap-2.5">
                        <Logo size="sm" />
                        <h1 className="text-2xl font-black tracking-tight text-foreground drop-shadow-sm">أُلْفَة</h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <motion.button
                        whileHover={{ scale: 1.05, rotate: 5 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onNavigate('settings')}
                        className="w-12 h-12 flex items-center justify-center bg-card/50 backdrop-blur-xl rounded-[1.2rem] shadow-sm border border-border/50 transition-all hover:border-primary/30"
                    >
                        <Settings className="w-5.5 h-5.5 text-foreground drop-shadow-sm" />
                    </motion.button>
                </div>
            </header>

            <div className="px-6 py-8 space-y-12 pb-36">
                {/* Premium Hero Widget */}
                <section className="relative group">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", damping: 20 }}
                        className={`relative h-[210px] rounded-[3.5rem] overflow-hidden transition-all duration-700 ${isDarkMode
                            ? "bg-slate-950 shadow-2xl shadow-rose-900/10 border border-white/5"
                            : "bg-gradient-to-br from-rose-50 via-white to-rose-50/30 shadow-xl shadow-rose-200/40 border border-rose-100/50"
                            }`}
                    >
                        {/* Background Ambiance */}
                        <div className="absolute inset-0">
                            {isDarkMode ? (
                                <>
                                    <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-rose-950/30 via-transparent to-rose-900/10" />
                                    <div className="absolute bottom-0 left-0 w-full h-full bg-gradient-to-t from-black via-black/20 to-transparent" />
                                    <motion.div
                                        animate={{ opacity: [0.1, 0.3, 0.1], scale: [1, 1.1, 1] }}
                                        transition={{ duration: 8, repeat: Infinity }}
                                        className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-rose-500/10 rounded-full blur-[100px]"
                                    />
                                </>
                            ) : (
                                <>
                                    <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-rose-200/20 via-transparent to-rose-100/30" />
                                    <div className="absolute bottom-0 left-0 w-full h-full bg-gradient-to-t from-white via-white/40 to-transparent" />
                                    <motion.div
                                        animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.2, 1] }}
                                        transition={{ duration: 10, repeat: Infinity }}
                                        className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[100px]"
                                    />
                                </>
                            )}
                        </div>

                        {/* Infinity Light Trail */}
                        <div className="absolute inset-0 opacity-30 select-none">
                            <svg className="w-full h-full" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
                                <motion.path
                                    d="M 100 200 C 100 100, 300 300, 300 200 C 300 100, 100 300, 100 200"
                                    fill="none"
                                    stroke={isDarkMode ? "#f43f5e" : "#fb7185"}
                                    strokeWidth="0.8"
                                    strokeDasharray="1 10"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                                />
                            </svg>
                        </div>

                        {/* Content Container - Horizontal Style */}
                        <div className="absolute inset-0 flex items-center justify-between px-10">
                            <div className="flex items-center gap-6">
                                <motion.div className="relative">
                                    {/* Status Indicator Glow */}
                                    {status?.text === 'متصل الآن' && (
                                        <div className="absolute -inset-8 bg-emerald-500/10 rounded-full blur-2xl animate-pulse" />
                                    )}

                                    {/* Dynamic Status Rings */}
                                    <div className={`absolute -inset-7 border ${isDarkMode ? "border-white/5" : "border-rose-500/10"} rounded-full animate-[spin_25s_linear_infinite]`} />
                                    <div className={`absolute -inset-5 border border-dashed ${isDarkMode ? "border-rose-500/15" : "border-rose-400/20"} rounded-full animate-[spin_12s_linear_infinite_reverse]`} />

                                    <div className="flex items-center -space-x-5 relative z-10">
                                        <motion.div
                                            whileHover={{ scale: 1.08, zIndex: 20 }}
                                            className={`w-17 h-17 rounded-[2rem] border-2 ${isDarkMode ? "border-slate-900 bg-slate-800" : "border-white bg-rose-50"} shadow-xl overflow-hidden relative group/avatar`}
                                        >
                                            {avatars.me ? (
                                                <img src={avatars.me} className="w-full h-full object-cover transition-transform duration-500 group-hover/avatar:scale-110" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-400 to-rose-600 text-white font-black text-2xl">M</div>
                                            )}
                                            <div className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full shadow-lg" />
                                        </motion.div>

                                        <div className="w-6 h-6 rounded-full bg-rose-400/20 backdrop-blur-md flex items-center justify-center text-rose-500/50 z-20 border border-white/20 shadow-lg scale-110">
                                            <Heart className="w-3.5 h-3.5 fill-current" />
                                        </div>

                                        <motion.div
                                            whileHover={{ scale: 1.08, zIndex: 20 }}
                                            className={`w-17 h-17 rounded-[2rem] border-2 ${isDarkMode ? "border-slate-900 bg-slate-800" : "border-white bg-rose-50"} shadow-xl overflow-hidden relative group/avatar`}
                                        >
                                            {avatars.partner ? (
                                                <img src={avatars.partner} className="w-full h-full object-cover transition-transform duration-500 group-hover/avatar:scale-110" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-200 to-rose-400 text-rose-600 font-black text-2xl">Y</div>
                                            )}
                                            {status?.text === 'متصل الآن' && (
                                                <motion.div
                                                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0.8, 1] }}
                                                    transition={{ duration: 2, repeat: Infinity }}
                                                    className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full shadow-lg shadow-emerald-500/50"
                                                />
                                            )}
                                        </motion.div>
                                    </div>

                                    {/* Distance Indicator - Refined */}
                                    <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center z-20">
                                        {distance && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-full border shadow-sm backdrop-blur-xl transition-all ${isDarkMode ? "bg-black/60 border-white/10 text-rose-200/60" : "bg-white/80 border-rose-100 text-rose-950/50"
                                                    }`}
                                            >
                                                <MapPin className="w-2.5 h-2.5 opacity-60" />
                                                <span className="text-[9px] font-black tracking-tight leading-none overflow-hidden">{distance}</span>
                                            </motion.div>
                                        )}
                                    </div>
                                </motion.div>
                            </div>

                            <motion.div
                                initial={{ x: 30, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.3, type: "spring" }}
                                className="text-right flex flex-col items-end"
                            >
                                <div className="flex flex-col items-end gap-0.5">
                                    <h2 className={`text-[10px] font-black uppercase tracking-[0.4em] mb-1 ${isDarkMode ? "text-rose-400/80" : "text-rose-500/80"}`}>
                                        رحلة المودة
                                    </h2>
                                    <div className="flex items-baseline gap-1.5">
                                        <motion.span
                                            key={daysTogether}
                                            initial={{ scale: 0.5, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className={`text-7xl font-black tracking-tighter drop-shadow-xl ${isDarkMode ? "text-white" : "text-rose-950"}`}
                                        >
                                            {daysTogether}
                                        </motion.span>
                                        <span className={`text-base font-black ${isDarkMode ? "text-rose-200/60" : "text-rose-900/40"}`}>يوم</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 mt-2 bg-rose-500/5 px-3 py-1 rounded-full border border-rose-500/10">
                                    <Sparkles className="w-2.5 h-2.5 text-rose-400" />
                                    <p className={`text-[9px] font-black uppercase tracking-[0.1em] ${isDarkMode ? "text-rose-100/40" : "text-rose-900/40"}`}>
                                        عمر حكايتنا الجميلة
                                    </p>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </section>

                {/* Improved Interaction Grid */}
                <section className="grid grid-cols-2 gap-6">
                    <motion.button
                        whileHover={{ y: -5 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onNavigate('love_notes')}
                        className="group col-span-2 p-8 rounded-[3.5rem] bg-gradient-to-br from-indigo-500/[0.03] to-indigo-600/[0.08] border border-indigo-500/15 relative overflow-hidden transition-all hover:border-indigo-500/30"
                    >
                        <div className="flex items-center gap-7 relative z-10">
                            <div className="w-18 h-18 bg-card rounded-[2rem] flex items-center justify-center shadow-[0_10px_30px_rgba(79,70,229,0.12)] text-indigo-500 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                                <Feather className="w-9 h-9" />
                            </div>
                            <div className="text-right">
                                <h4 className="text-2xl font-black text-foreground mb-1.5 leading-tight tracking-tight">خواطر المودة</h4>
                                <p className="text-[12px] font-bold text-muted-foreground/80 uppercase tracking-[0.15em] leading-none">دوّن مشاعرك بكلمات تلمس الروح</p>
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Sparkles className="w-24 h-24 text-indigo-500" />
                        </div>
                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-[80px]" />
                    </motion.button>

                    <motion.button
                        whileHover={{ y: -5 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onNavigate('dialogues')}
                        className="group flex flex-col justify-between p-8 aspect-square rounded-[3.5rem] bg-gradient-to-br from-primary/[0.03] to-primary/[0.08] border border-primary/15 relative overflow-hidden transition-all hover:border-primary/30"
                    >
                        <div className="w-16 h-16 bg-card rounded-[1.8rem] flex items-center justify-center shadow-[0_10px_30px_rgba(var(--primary),0.12)] text-primary group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500">
                            <MessageCircle className="w-8 h-8" />
                        </div>
                        <div className="text-right relative z-10">
                            <h4 className="text-xl font-black text-foreground mb-1 leading-tight tracking-tight">حوارنا</h4>
                            <p className="text-[11px] font-bold text-muted-foreground/80 leading-relaxed">تواصل أعمق يقرّب المسافات</p>
                        </div>
                        <div className="absolute -top-5 -right-5 w-24 h-24 bg-primary/10 rounded-full blur-[40px]" />
                    </motion.button>

                    <motion.button
                        whileHover={{ y: -5 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onNavigate('dialogues')}
                        className="group flex flex-col justify-between p-8 aspect-square rounded-[3.5rem] bg-gradient-to-br from-rose-500/[0.03] to-rose-600/[0.08] border border-rose-500/15 relative overflow-hidden transition-all hover:border-rose-500/30"
                    >
                        <div className="w-16 h-16 bg-card rounded-[1.8rem] flex items-center justify-center shadow-[0_10px_30px_rgba(244,63,94,0.12)] text-rose-500 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                            <Ruler className="w-8 h-8" />
                        </div>
                        <div className="text-right relative z-10">
                            <h4 className="text-xl font-black text-foreground mb-1 leading-tight tracking-tight">عهدنا</h4>
                            <p className="text-[11px] font-bold text-muted-foreground/80 leading-relaxed">وعود ننبض بها سوياً</p>
                        </div>
                        <div className="absolute -top-5 -right-5 w-24 h-24 bg-rose-500/10 rounded-full blur-[40px]" />
                    </motion.button>

                    <motion.button
                        whileHover={{ y: -5 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onNavigate('calendar')}
                        className="group col-span-2 flex items-center justify-between p-8 rounded-[3.5rem] bg-gradient-to-br from-amber-500/[0.03] to-amber-600/[0.08] border border-amber-500/15 relative overflow-hidden transition-all hover:border-amber-500/30"
                    >
                        <div className="flex items-center gap-7 relative z-10">
                            <div className="w-16 h-16 bg-card rounded-[1.8rem] flex items-center justify-center shadow-[0_10px_30px_rgba(245,158,11,0.12)] text-amber-500 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                                <ImageIcon className="w-8 h-8" />
                            </div>
                            <div className="text-right">
                                <h4 className="text-xl font-black text-foreground mb-1.5 leading-tight tracking-tight">ذكرياتنا (أثرنا)</h4>
                                <p className="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-[0.15em] leading-none">خزانة لحظاتنا الثمينة</p>
                            </div>
                        </div>
                        <motion.div
                            animate={{ x: [0, -5, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-10 h-10 flex items-center justify-center bg-card rounded-2xl shadow-sm border border-border/50 text-amber-500/60"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </motion.div>
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-amber-500/10 rounded-full blur-[80px]" />
                    </motion.button>
                </section>

                {/* Refined Mood Section */}
                <section className="bg-card/40 backdrop-blur-md rounded-[3.5rem] p-10 shadow-2xl shadow-black/[0.03] border border-border/50 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-10">
                        <div className="text-right">
                            <h3 className="text-2xl font-black text-foreground tracking-tight mb-0.5">في عيون قلبي..</h3>
                            <p className="text-[12px] font-bold text-muted-foreground/80 tracking-wide uppercase">لطفاً، شاركيني لمشاعرك الآن</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-primary/20" />
                            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shadow-[0_0_15px_rgba(var(--primary),0.6)]" />
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {showMoodPrompt ? (
                            <motion.div
                                key="mood-selection"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.05 }}
                                className="grid grid-cols-4 gap-5"
                            >
                                {moods.map((mood) => {
                                    const Icon = mood.icon;
                                    return (
                                        <motion.button
                                            key={mood.id}
                                            whileHover={{ y: -8, scale: 1.05 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => handleMoodSelect(mood.id)}
                                            className="flex flex-col items-center gap-4 group"
                                        >
                                            <div className={`w-full aspect-square rounded-[2.5rem] ${mood.bg} flex items-center justify-center border-2 border-transparent transition-all group-hover:shadow-[0_15px_30px_rgba(0,0,0,0.08)] group-hover:border-white/50 dark:group-hover:border-white/5`}>
                                                <Icon className={`w-10 h-10 ${mood.color} transition-transform group-hover:scale-110 duration-500`} />
                                            </div>
                                            <span className="text-[12px] font-black text-muted-foreground/80 group-hover:text-foreground transition-colors tracking-wide">{mood.label}</span>
                                        </motion.button>
                                    );
                                })}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="mood-saved"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="py-10 px-8 bg-emerald-500/[0.03] rounded-[3rem] border border-emerald-500/10 flex items-center gap-7"
                            >
                                <div className="w-18 h-18 rounded-[2rem] bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30 shrink-0">
                                    <CheckCircle className="w-10 h-10" />
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-black text-foreground mb-1 tracking-tight">وصلتني مشاعرك يا روح القلب</p>
                                    <p className="text-[12px] font-bold text-emerald-500/80 leading-tight tracking-wide uppercase font-sans">شكراً لصدقك، سأهتم بقلبك دائماً</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>

                {/* Polished Upcoming Events */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between px-3">
                        <h3 className="text-[12px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">محطاتنا القريبة</h3>
                        <motion.button
                            whileHover={{ x: -2 }}
                            onClick={() => onNavigate('calendar')}
                            className="flex items-center gap-1.5 text-[11px] font-black text-primary hover:opacity-70 transition-all uppercase tracking-wider"
                        >
                            عرض التقويم <ChevronLeft className="w-4 h-4" />
                        </motion.button>
                    </div>

                    <div className="bg-card/60 backdrop-blur-md rounded-[3.5rem] p-9 shadow-lg border border-border/40 space-y-8">
                        {upcomingEvents.length > 0 ? (
                            upcomingEvents.map((event, i) => (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    key={event.id}
                                    className={`flex items-center justify-between ${i !== upcomingEvents.length - 1 ? 'border-b border-border/40 pb-8' : ''}`}
                                >
                                    <div className="flex items-center gap-5">
                                        <div className={`w-16 h-16 rounded-[1.8rem] ${i === 0 ? 'bg-primary/10 text-primary' : 'bg-muted/10 text-muted-foreground/80'} flex items-center justify-center text-3xl shadow-inner border border-white/20`}>
                                            {event.title.includes('سفر') || event.title.includes('طائرة') ? '✈️' : i === 0 ? '❤️' : '✨'}
                                        </div>
                                        <div className="text-right">
                                            <h4 className="text-lg font-black leading-tight mb-1.5 text-foreground tracking-tight">{event.title}</h4>
                                            <div className="flex items-center gap-2.5">
                                                <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground/60" />
                                                <p className="text-[12px] font-bold text-muted-foreground/60 font-sans tracking-tight">{event.event_date}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                        <div className="px-5 py-2.5 bg-primary/10 rounded-2xl text-[11px] font-black text-primary border border-primary/10 shadow-sm">
                                            بعد {calculateDaysUntil(event.event_date)} يوم
                                        </div>
                                        <div className="w-full h-1 bg-muted/20 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.max(10, 100 - calculateDaysUntil(event.event_date) * 2)}%` }}
                                                className="h-full bg-primary/40"
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-6 gap-6">
                                <div className="w-24 h-24 rounded-[2.5rem] bg-muted/10 flex items-center justify-center text-5xl grayscale opacity-30 select-none">🕊️</div>
                                <div className="text-center">
                                    <h4 className="text-xl font-black text-muted-foreground/80 mb-1">لا مواعيد مجدولة حالياً</h4>
                                    <p className="text-[12px] font-bold text-muted-foreground/40 leading-relaxed max-w-[200px] mx-auto uppercase tracking-wide">ما رأيك بأن نخطط لذكرى جديدة سوياً؟</p>
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => onNavigate('calendar')}
                                    className="px-8 py-4 rounded-[2.5rem] bg-primary text-white font-black text-[13px] shadow-xl shadow-primary/30 flex items-center gap-2.5 group"
                                >
                                    <PlusCircle className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
                                    أضف موعداً جديداً
                                </motion.button>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
