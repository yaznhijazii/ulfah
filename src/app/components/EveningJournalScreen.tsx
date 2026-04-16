import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Moon, Send, Lock, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface EveningJournalScreenProps {
    onNavigate: (screen: string) => void;
    userId: string;
    partnershipId: string | null;
    isDarkMode: boolean;
}

const DAILY_QUESTIONS = [
    'ما أجمل لحظة عشتها اليوم؟',
    'شيء جعلك تبتسم اليوم؟',
    'ما الذي تمنيت لو شاركه معك شريكك اليوم؟',
    'ما الذي تتمنى أن يعرفه شريكك عنك هذا المساء؟',
    'ما أكثر شيء جعلك تفكر في شريكك اليوم؟',
    'كيف تصف يومك بكلمة واحدة؟',
    'ما الشيء الذي تعلمته أو اكتشفته اليوم؟',
    'ما الذي تشكر عليه اليوم؟',
    'ما الذي تتطلع إليه غداً؟',
    'ما أصعب شيء مررت به اليوم؟',
    'لو كان بإمكانك إعادة شيء من اليوم، ماذا سيكون؟',
    'ما الشيء الذي أضحكك اليوم؟',
    'كيف حال قلبك الآن؟',
    'ما الذي تودّ أن تقوله لشريكك الآن؟',
    'ما المشاعر التي تغلبت عليك اليوم؟',
];

function getDayQuestion(): string {
    const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    return DAILY_QUESTIONS[dayOfYear % DAILY_QUESTIONS.length];
}

export function EveningJournalScreen({ onNavigate, userId, partnershipId, isDarkMode }: EveningJournalScreenProps) {
    const [myEntry, setMyEntry] = useState('');
    const [partnerEntry, setPartnerEntry] = useState<string | null>(null);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [partnerName, setPartnerName] = useState('شريكك');
    const [partnerId, setPartnerId] = useState<string | null>(null);
    const [pastEntries, setPastEntries] = useState<any[]>([]);

    const today = new Date().toISOString().split('T')[0];
    const question = getDayQuestion();

    useEffect(() => {
        if (partnershipId) {
            fetchData();
        }
    }, [partnershipId]);

    const fetchData = async () => {
        if (!partnershipId) return;
        setLoading(true);
        try {
            // Get partner info
            const { data: pData } = await supabase
                .from('partnerships')
                .select('user1:user1_id(name), user2:user2_id(name), user1_id, user2_id')
                .eq('id', partnershipId)
                .single();

            if (pData) {
                const isUser1 = pData.user1_id === userId;
                const pName = isUser1 ? (pData as any).user2?.name : (pData as any).user1?.name;
                const pId = isUser1 ? pData.user2_id : pData.user1_id;
                setPartnerName(pName || 'شريكك');
                setPartnerId(pId);

                // Fetch today's entries
                const { data: entries } = await supabase
                    .from('evening_journal')
                    .select('*')
                    .eq('partnership_id', partnershipId)
                    .eq('journal_date', today);

                if (entries) {
                    const mine = entries.find(e => e.user_id === userId);
                    const theirs = entries.find(e => e.user_id === pId);
                    if (mine) {
                        setHasSubmitted(true);
                        setMyEntry(mine.content);
                    }
                    // Show partner's answer only if I've submitted mine
                    if (mine && theirs) {
                        setPartnerEntry(theirs.content);
                    }
                }

                // Fetch past entries (last 7 days, both submitted)
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const { data: past } = await supabase
                    .from('evening_journal')
                    .select('*')
                    .eq('partnership_id', partnershipId)
                    .lt('journal_date', today)
                    .gte('journal_date', sevenDaysAgo.toISOString().split('T')[0])
                    .order('journal_date', { ascending: false });

                if (past) {
                    // Group by date
                    const grouped: Record<string, any[]> = {};
                    past.forEach(e => {
                        if (!grouped[e.journal_date]) grouped[e.journal_date] = [];
                        grouped[e.journal_date].push(e);
                    });
                    setPastEntries(
                        Object.entries(grouped)
                            .filter(([, entries]) => entries.length === 2)
                            .map(([date, entries]) => ({
                                date,
                                mine: entries.find(e => e.user_id === userId),
                                partner: entries.find(e => e.user_id !== userId),
                            }))
                    );
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!myEntry.trim() || !partnershipId || saving) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('evening_journal').upsert({
                partnership_id: partnershipId,
                user_id: userId,
                journal_date: today,
                content: myEntry.trim(),
                question,
            }, { onConflict: 'partnership_id,user_id,journal_date' });

            if (!error) {
                setHasSubmitted(true);
                fetchData();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const dateLabel = new Date().toLocaleDateString('ar-JO', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <div className={`flex flex-col min-h-full ${isDarkMode ? 'dark' : ''} bg-background overflow-x-hidden`}>
            {/* Starry background */}
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/0 dark:from-indigo-950/60 to-transparent" />
                <div className="absolute top-[-10%] left-[10%] w-[70%] h-[60%] bg-indigo-500/8 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-5%] right-[-10%] w-[60%] h-[50%] bg-violet-500/6 blur-[120px] rounded-full" />
            </div>

            {/* Header */}
            <header className="px-8 pt-12 pb-6 sticky top-0 z-40 bg-background/60 backdrop-blur-3xl">
                <div className="flex items-center justify-between" dir="rtl">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onNavigate('home')}
                        className="w-11 h-11 flex items-center justify-center glass rounded-2xl border-white/60 shadow-xl text-foreground/40"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </motion.button>
                    <div className="text-center">
                        <h1 className="text-xl font-black text-foreground tracking-tighter">دفتر المساء 🌙</h1>
                        <p className="text-[8px] font-black text-indigo-500/40 uppercase tracking-[0.5em]">{dateLabel}</p>
                    </div>
                    <div className="w-11 h-11 flex items-center justify-center">
                        <Moon className="w-5 h-5 text-indigo-400/40" />
                    </div>
                </div>
            </header>

            <div className="flex-1 px-8 pb-32 space-y-8" dir="rtl">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-40">
                        <div className="w-10 h-10 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Today's question card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="relative overflow-hidden rounded-[2.5rem] p-8 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 shadow-2xl shadow-indigo-500/20"
                        >
                            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_70%)]" />
                            <div className="relative z-10">
                                <p className="text-[9px] font-black text-white/50 uppercase tracking-[0.5em] mb-4">سؤال اليوم</p>
                                <p className="text-2xl font-black text-white leading-snug tracking-tight">{question}</p>
                            </div>
                            {/* Decorative stars */}
                            {['top-4 left-6', 'bottom-6 left-12', 'top-8 left-24'].map((pos, i) => (
                                <motion.div
                                    key={i}
                                    className={`absolute ${pos} w-1 h-1 bg-white rounded-full opacity-40`}
                                    animate={{ opacity: [0.2, 0.8, 0.2], scale: [1, 1.5, 1] }}
                                    transition={{ repeat: Infinity, duration: 2 + i, delay: i * 0.7 }}
                                />
                            ))}
                        </motion.div>

                        {/* My answer */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="glass border-white/20 rounded-[2rem] p-6"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-black text-foreground/80 tracking-tight">إجابتي</h3>
                                {hasSubmitted && (
                                    <div className="flex items-center gap-1.5 text-emerald-500">
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">أُرسلت</span>
                                    </div>
                                )}
                            </div>

                            <AnimatePresence mode="wait">
                                {hasSubmitted ? (
                                    <motion.p
                                        key="submitted"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-base font-bold text-foreground/70 leading-relaxed"
                                    >
                                        {myEntry}
                                    </motion.p>
                                ) : (
                                    <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                        <textarea
                                            value={myEntry}
                                            onChange={e => setMyEntry(e.target.value)}
                                            placeholder="اكتب إجابتك هنا..."
                                            rows={4}
                                            className="w-full glass border-white/10 rounded-2xl px-5 py-4 text-base font-bold outline-none focus:border-indigo-400 transition-all resize-none leading-relaxed"
                                        />
                                        <motion.button
                                            whileTap={{ scale: 0.97 }}
                                            onClick={handleSubmit}
                                            disabled={!myEntry.trim() || saving}
                                            className="w-full h-14 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-2xl shadow-indigo-500/20 flex items-center justify-center gap-3 disabled:opacity-40 transition-all"
                                        >
                                            {saving ? (
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    <Send className="w-4 h-4" />
                                                    أرسل إجابتي
                                                </>
                                            )}
                                        </motion.button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>

                        {/* Partner's answer */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="glass border-white/20 rounded-[2rem] p-6"
                        >
                            <h3 className="text-sm font-black text-foreground/80 tracking-tight mb-4">إجابة {partnerName}</h3>

                            {!hasSubmitted ? (
                                <div className="flex flex-col items-center gap-3 py-6 opacity-40">
                                    <Lock className="w-8 h-8 text-indigo-400" />
                                    <p className="text-[11px] font-black text-center text-muted-foreground uppercase tracking-widest leading-relaxed">
                                        أرسل إجابتك أولاً<br />لتتمكن من رؤية إجابة {partnerName}
                                    </p>
                                </div>
                            ) : partnerEntry ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="relative"
                                >
                                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center">
                                        <span className="text-white text-[10px]">♥</span>
                                    </div>
                                    <div className="bg-rose-50/50 dark:bg-rose-900/10 border border-rose-200/30 dark:border-rose-500/20 rounded-2xl p-5">
                                        <p className="text-base font-bold text-foreground/70 leading-relaxed">{partnerEntry}</p>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="flex flex-col items-center gap-3 py-6 opacity-40">
                                    <motion.div
                                        animate={{ opacity: [0.4, 1, 0.4] }}
                                        transition={{ repeat: Infinity, duration: 2 }}
                                    >
                                        <Moon className="w-8 h-8 text-indigo-400" />
                                    </motion.div>
                                    <p className="text-[11px] font-black text-center text-muted-foreground uppercase tracking-widest leading-relaxed">
                                        في انتظار إجابة {partnerName}...
                                    </p>
                                </div>
                            )}
                        </motion.div>

                        {/* Past entries */}
                        {pastEntries.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-px bg-indigo-200/30" />
                                    <span className="text-[9px] font-black text-indigo-400/50 uppercase tracking-[0.3em]">الأيام الماضية</span>
                                    <div className="flex-1 h-px bg-indigo-200/30" />
                                </div>

                                {pastEntries.map((entry, idx) => {
                                    const dateStr = new Date(entry.date).toLocaleDateString('ar-JO', { weekday: 'short', day: 'numeric', month: 'short' });
                                    return (
                                        <motion.div
                                            key={entry.date}
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.08 }}
                                            className="glass border-white/20 rounded-[2rem] overflow-hidden"
                                        >
                                            <div className="px-5 pt-5 pb-3">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-[9px] font-black text-indigo-400/50 uppercase tracking-widest">{dateStr}</span>
                                                    <div className="w-2 h-2 bg-indigo-400/30 rounded-full" />
                                                </div>
                                                {entry.mine?.question && (
                                                    <p className="text-[10px] font-black text-indigo-400/40 italic mb-3">"{entry.mine.question}"</p>
                                                )}
                                            </div>

                                            <div className="px-5 pb-5 grid grid-cols-2 gap-3">
                                                <div className="bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl p-4 border border-indigo-200/20">
                                                    <p className="text-[8px] font-black text-indigo-500/50 uppercase mb-2">أنا</p>
                                                    <p className="text-[11px] font-bold text-foreground/60 leading-snug line-clamp-3">{entry.mine?.content}</p>
                                                </div>
                                                <div className="bg-rose-50/50 dark:bg-rose-900/10 rounded-2xl p-4 border border-rose-200/20">
                                                    <p className="text-[8px] font-black text-rose-500/50 uppercase mb-2">{partnerName}</p>
                                                    <p className="text-[11px] font-bold text-foreground/60 leading-snug line-clamp-3">{entry.partner?.content}</p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
