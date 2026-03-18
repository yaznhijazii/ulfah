import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Gift, Heart, Sparkles, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import confetti from 'canvas-confetti';

interface OccasionScreenProps {
    onBack: () => void;
    isDarkMode: boolean;
    occasionTitle?: string;
    targetDate?: string;
    greetingMessage?: string;
    userId: string;
    partnershipId: string | null;
}

export function OccasionScreen({ 
    onBack, 
    isDarkMode,
    occasionTitle = "عيد الفطر السعيد",
    targetDate = new Date(Date.now() + 15000).toISOString(), // 15 seconds from now for demo
    greetingMessage = "كل عام وأنتِ النبض الذي يحيي أيامي، أُلفة الروح وسَكن القلب. عيدي لا يكتمل إلا بابتسامتك المتوهجة. 💖",
    userId,
    partnershipId
}: OccasionScreenProps) {
    // Real data state
    const [realOccasionTitle, setRealOccasionTitle] = useState(occasionTitle);
    const [realGreetingMessage, setRealGreetingMessage] = useState(greetingMessage);
    const [realTargetDate, setRealTargetDate] = useState(targetDate);
    const [greetingId, setGreetingId] = useState<string | null>(null);

    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    const [isTimeUp, setIsTimeUp] = useState(false);
    const [isEnvelopeOpen, setIsEnvelopeOpen] = useState(false);
    const [showCard, setShowCard] = useState(false);
    const [hideEnvelope, setHideEnvelope] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date().getTime();
            const target = new Date(realTargetDate).getTime();
            const difference = target - now;

            if (difference <= 0) {
                clearInterval(interval);
                setIsTimeUp(true);
            } else {
                setTimeLeft({
                    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                    minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
                    seconds: Math.floor((difference % (1000 * 60)) / 1000)
                });
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [realTargetDate]);
    // Fetch the real greeting from Supabase on mount
    useEffect(() => {
        const fetchGreeting = async () => {
            if (!userId || !partnershipId) return;

            const { data, error } = await supabase.from('occasion_greetings')
                .select('*')
                .neq('sender_id', userId)
                .eq('is_opened', false)
                .lte('target_date', new Date(Date.now() + 86400000 * 3).toISOString()) // Within 3 days
                .order('target_date', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (data && !error) {
                setRealOccasionTitle(data.title);
                setRealGreetingMessage(data.message);
                setRealTargetDate(data.target_date);
                setGreetingId(data.id);
            }
        };

        fetchGreeting();
    }, [userId, partnershipId]);

    const handleOpenGreeting = async () => {
        setIsEnvelopeOpen(true);
        
        // Mark as opened in the database if it exists
        if (greetingId) {
            supabase.from('occasion_greetings').update({ is_opened: true }).eq('id', greetingId).then();
        }
        // Fire confetti for celebration
        const duration = 3000;
        const end = Date.now() + duration;

        const frame = () => {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#f43f5e', '#fb7185', '#amber-500', '#fbbf24']
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#f43f5e', '#fb7185', '#amber-500', '#fbbf24']
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        };
        frame();

        setTimeout(() => {
            setShowCard(true);
            setTimeout(() => {
                setHideEnvelope(true);
            }, 1200); // fade out envelope after letter comes out
        }, 1000);
    };

    return (
        <div className="flex-1 bg-[#0a0505] overflow-x-hidden scrollbar-hide relative min-h-screen text-white">
            {/* Stars & Ambient Background for the occasion */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-[#0a0505] to-black">
                {/* Glowing Crescent Simulation */}
                <div className="absolute top-[10%] left-[50%] -translate-x-1/2 w-64 h-64 rounded-full bg-amber-200/5 blur-[80px]" />
                
                {/* Flowing particles */}
                {[...Array(20)].map((_, i) => (
                    <motion.div
                        key={i}
                        animate={{
                            y: ['-10%', '110%'],
                            opacity: [0, 0.5, 0],
                            scale: [0.5, 1.5, 0.5]
                        }}
                        transition={{
                            duration: 10 + Math.random() * 20,
                            repeat: Infinity,
                            delay: Math.random() * 5,
                            ease: "linear"
                        }}
                        className="absolute text-amber-200/20"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * -20}%`
                        }}
                    >
                        <Star size={10 + Math.random() * 14} fill="currentColor" />
                    </motion.div>
                ))}
            </div>

            <header className="px-8 pt-10 pb-6 relative z-40">
                <div className="flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white backdrop-blur-md shadow-2xl active:scale-95"
                    >
                        <ChevronLeft className="w-6 h-6 rotate-180" />
                    </button>
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-400 opacity-60 mb-1">لحظات مميزة</span>
                        <h1 className="text-xl font-black text-white tracking-tighter">معايدة الألفة</h1>
                    </div>
                </div>
            </header>

            <main className="px-8 pt-4 pb-32 flex flex-col items-center justify-center min-h-[70vh] relative z-10">
                
                <AnimatePresence mode="wait">
                    {!isEnvelopeOpen ? (
                        <motion.div 
                            key="timer-view"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8, y: -50 }}
                            className="w-full flex flex-col items-center"
                        >
                            {/* The Timer */}
                            <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem] backdrop-blur-xl w-full max-w-sm shadow-2xl shadow-indigo-900/20 text-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/20 blur-[50px] -mr-16 -mt-16 pointer-events-none" />
                                
                                <Heart className="w-10 h-10 text-rose-500 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(244,63,94,0.6)] animate-pulse" fill="currentColor"/>
                                
                                <h2 className="text-2xl font-black mb-8 tracking-tight">{realOccasionTitle}</h2>
                                
                                <div className="flex items-center justify-center gap-4 dir-ltr">
                                    {[
                                        { label: 'يوم', value: timeLeft.days },
                                        { label: 'ساعة', value: timeLeft.hours },
                                        { label: 'دقيقة', value: timeLeft.minutes },
                                        { label: 'ثانية', value: timeLeft.seconds }
                                    ].map((unit, idx) => (
                                        <div key={idx} className="flex flex-col items-center gap-2">
                                            <div className="w-16 h-16 bg-white/10 rounded-2xl border border-white/20 flex items-center justify-center shadow-inner relative overflow-hidden">
                                                <span className="text-2xl font-black text-white relative z-10 font-mono">
                                                    {unit.value.toString().padStart(2, '0')}
                                                </span>
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-white/50">{unit.label}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Call to action button */}
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleOpenGreeting}
                                    className={`mt-10 w-full rounded-2xl py-4 flex items-center justify-center gap-3 font-black tracking-wide text-sm shadow-xl transition-all duration-500 relative overflow-hidden group ${
                                        isTimeUp || true // (Allow opening anytime if requested: "عجبني انه بنفس الموقت يكون فيه شوف معايدة")
                                        ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-rose-500/30' 
                                        : 'bg-white/5 text-white/40 cursor-not-allowed'
                                    }`}
                                >
                                    <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                                    <Gift className="w-5 h-5 relative z-10" />
                                    <span className="relative z-10">إظهار معايدة شريكك</span>
                                </motion.button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="envelope-view"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="w-full flex-1 flex items-center justify-center"
                        >
                            {/* Envelope Container */}
                            <div className="relative w-80 h-56 perspective-1000 flex justify-center mt-20">
                                
                                {/* Envelope Wrapper (Fades out later) */}
                                <motion.div 
                                    animate={{ opacity: hideEnvelope ? 0 : 1, y: hideEnvelope ? 50 : 0 }} 
                                    transition={{ duration: 1 }}
                                    className="absolute inset-0 z-[5] pointer-events-none"
                                >
                                    {/* Background Envelope Back */}
                                    <div className="absolute inset-x-0 bottom-0 top-10 bg-rose-950 rounded-b-xl rounded-t-sm shadow-2xl z-[0]" />

                                    {/* Envelope Flap (Top) */}
                                    <motion.div
                                        initial={{ rotateX: 0, zIndex: 30 }}
                                        animate={{ rotateX: -180, zIndex: 5 }}
                                        transition={{ duration: 0.8 }}
                                        style={{ transformOrigin: 'top', transformStyle: 'preserve-3d' }}
                                        className="absolute inset-x-0 top-10 h-32 origin-top drop-shadow-lg"
                                    >
                                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full fill-rose-700">
                                            <polygon points="0,0 100,0 50,60" />
                                        </svg>
                                        <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shadow-lg border-2 border-amber-200">
                                            <Heart fill="white" className="w-4 h-4 text-white" />
                                        </div>
                                    </motion.div>

                                    {/* Envelope Front (Left & Right Flaps) */}
                                    <div className="absolute inset-x-0 bottom-0 top-10 z-[20] drop-shadow-2xl">
                                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full drop-shadow-md">
                                            <polygon points="0,0 0,100 50,55" fill="#9f1239" />
                                            <polygon points="100,0 100,100 50,55" fill="#e11d48" />
                                            <polygon points="0,100 100,100 50,55" fill="#be123c" />
                                        </svg>
                                    </div>
                                </motion.div>

                                {/* The Letter / Card coming out */}
                                <motion.div 
                                    initial={{ y: 20, opacity: 0, scale: 0.9 }}
                                    animate={
                                        hideEnvelope 
                                          ? { y: -30, opacity: 1, scale: 1.15, zIndex: 50 } 
                                          : showCard 
                                            ? { y: -120, opacity: 1, scale: 0.95, zIndex: 10 } 
                                            : { y: 20, opacity: 0, scale: 0.9, zIndex: 10 }
                                    }
                                    transition={{ duration: 1.2, type: 'spring', bounce: 0.4 }}
                                    className="absolute top-10 w-[90%] bg-white rounded-lg p-6 shadow-2xl flex flex-col items-center text-center border-2 border-amber-200"
                                >
                                    <Sparkles className="text-amber-500 w-8 h-8 mb-4" />
                                    <h3 className="text-rose-600 font-black text-lg mb-4">{realOccasionTitle}</h3>
                                    <p className="text-rose-950/80 font-medium leading-relaxed text-sm whitespace-pre-wrap">
                                        {realGreetingMessage}
                                    </p>
                                    <div className="mt-6 w-12 h-[1px] bg-rose-200" />
                                    <p className="mt-4 text-[10px] text-rose-400 font-black uppercase tracking-widest">مع كل الحب</p>
                                </motion.div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
