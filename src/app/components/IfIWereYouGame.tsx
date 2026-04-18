import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { UserCircle, Send, Heart, CheckCircle2, Sparkles, RefreshCw, MessageCircle, X } from 'lucide-react';
import { SCENARIO_POOL, getRandomScenarios } from '../../utils/scenarioPool';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface IfIWereYouGameProps {
    onBack: () => void;
    userId: string;
    userName: string;
    partnershipId: string | null;
    initialCode?: string;
}

interface RoomData {
    id: string;
    room_code: string;
    host_user_id: string;
    guest_user_id: string | null;
    status: string;
    game_state: {
        scenario_text: string;
        answer_text: string | null;
    };
}

function parseState(raw: unknown): RoomData['game_state'] {
    if (typeof raw === 'string') return JSON.parse(raw);
    return raw as RoomData['game_state'];
}

export function IfIWereYouGame({ onBack, userId, userName, partnershipId, initialCode }: IfIWereYouGameProps) {
    const [joinCode, setJoinCode] = useState('');
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(false);
    const [scenarioDraft, setScenarioDraft] = useState('');
    const [answerDraft, setAnswerDraft] = useState('');
    const [partnerInfo, setPartnerInfo] = useState<{ id: string; name: string } | null>(null);
    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
    const [showAiSheet, setShowAiSheet] = useState(false);
    const [presence, setPresence] = useState<Record<string, any>>({});

    useEffect(() => {
        if (!roomData?.id) return;
        const channel = supabase.channel(`game_iwy_${roomData.id}`, { config: { presence: { key: userId } } })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomData.id}` }, (payload) => {
                const newData = payload.new as Record<string, unknown>;
                setRoomData({
                    ...newData,
                    game_state: parseState(newData.game_state),
                } as RoomData);
            })
            .on('presence', { event: 'sync' }, () => setPresence(channel.presenceState()))
            .subscribe(async (status) => { if (status === 'SUBSCRIBED') await channel.track({ user_id: userId, name: userName }); });
        return () => { supabase.removeChannel(channel); };
    }, [roomData?.id, userId, userName]);

    useEffect(() => {
        if (!partnershipId) return;
        supabase.from('partnerships').select('user1_id, user2_id, user1:user1_id(name), user2:user2_id(name)')
            .eq('id', partnershipId).single().then(({ data }) => {
                if (data) {
                    const isUser1 = data.user1_id === userId;
                    setPartnerInfo({ id: isUser1 ? data.user2_id : data.user1_id, name: (isUser1 ? (data.user2 as { name?: string })?.name : (data.user1 as { name?: string })?.name) || 'الشريك' });
                }
            });
    }, [partnershipId, userId]);

    const createRoom = async () => {
        setLoading(true);
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const state = { scenario_text: '', answer_text: null as string | null };
        const { data, error } = await supabase.from('game_rooms').insert({
            room_code: code,
            game_type: 'if-i-were-you',
            host_user_id: userId,
            status: 'waiting',
            game_state: state
        }).select().single();
        if (error) { toast.error('تعذّر إنشاء الغرفة'); setLoading(false); return; }
        setRoomData({ ...data, game_state: state } as RoomData);
        setLoading(false);
        if (partnerInfo) {
            await supabase.from('notifications').insert({
                user_id: partnerInfo.id,
                title: 'لو كنت مكاني 💬',
                body: `${userName} عنده موقف ويبغى رأيك: شو بتسوي لو كنت مكانه؟`,
                type: 'game_invite',
                metadata: { room_code: code, game_type: 'if-i-were-you' }
            });
        }
    };

    useEffect(() => {
        if (initialCode && !roomData) {
            setJoinCode(initialCode);
            // Small delay to ensure state update before execution if needed, 
            // though joinRoom doesn't depend on joinCode state directly if we pass it.
        }
    }, [initialCode]);

    useEffect(() => {
        if (joinCode && initialCode && !roomData) {
            joinRoom();
        }
    }, [joinCode, initialCode]);

    const joinRoom = async () => {
        const codeToUse = joinCode || initialCode;
        if (!codeToUse) return;
        setLoading(true);
        const { data: room, error } = await supabase.from('game_rooms')
            .select('*')
            .eq('room_code', codeToUse.toUpperCase())
            .eq('game_type', 'if-i-were-you')
            .eq('status', 'waiting')
            .single();
        if (error || !room) { toast.error('الغرفة غير موجودة'); setLoading(false); return; }
        const { data: updated, error: upErr } = await supabase.from('game_rooms').update({ guest_user_id: userId, status: 'setup' }).eq('id', room.id).select().single();
        if (upErr || !updated) { toast.error('تعذّر الانضمام'); setLoading(false); return; }
        setRoomData({ ...updated, game_state: parseState(updated.game_state) });
        setLoading(false);
    };

    const submitScenario = async (text?: string) => {
        const finalContent = text || scenarioDraft;
        if (!roomData || !finalContent.trim()) return;
        setLoading(true);
        const newState = { ...roomData.game_state, scenario_text: finalContent.trim() };
        await supabase.from('game_rooms').update({ game_state: newState, status: 'playing' }).eq('id', roomData.id);
        setLoading(false);
        setScenarioDraft('');
        setShowAiSheet(false);
        toast.success('تم إرسال الموقف للشريك');
    };

    const generateSuggestions = () => {
        setAiSuggestions(getRandomScenarios(5));
        setShowAiSheet(true);
    };

    const submitAnswer = async () => {
        if (!roomData || !answerDraft.trim()) return;
        setLoading(true);
        const newState = { ...roomData.game_state, answer_text: answerDraft.trim() };
        await supabase.from('game_rooms').update({ game_state: newState, status: 'finished' }).eq('id', roomData.id);
        setLoading(false);
        toast.success('تم إرسال ردك 💌');
    };

    const isHost = roomData ? userId === roomData.host_user_id : false;
    const gs = roomData?.game_state;
    const isPartnerInLobby = !!(partnerInfo && presence[partnerInfo.id]);

    if (!roomData) {
        return (
            <div dir="rtl" className="flex flex-col h-full bg-gradient-to-b from-sky-50 to-white dark:from-sky-950/40 dark:to-[#0c0a12] p-6">
                <div className="flex-1 flex flex-col justify-center gap-6 pb-20">
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white dark:bg-white/5 rounded-[2.5rem] p-10 text-center shadow-xl border border-sky-100 dark:border-white/10">
                        <div className="w-20 h-20 bg-sky-500 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg">
                            <UserCircle className="w-11 h-11" />
                        </div>
                        <h2 className="text-2xl font-black mb-3 text-sky-950 dark:text-white">لو كنت مكاني…</h2>
                        <p className="text-sky-800/70 dark:text-sky-200/80 font-bold text-sm mb-10 leading-relaxed">
                            اكتب موقفاً واحداً لشريكك، واسأله: <span className="text-sky-600 dark:text-sky-400">وش رح تسوي لو كنت مكاني؟</span> وهو يرد بصراحة.
                        </p>
                        <Button onClick={createRoom} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black bg-sky-600 hover:bg-sky-700 text-white shadow-xl">
                            {loading ? 'ثوانِ..' : '🚀 إنشاء جلسة'}
                        </Button>
                    </motion.div>
                    <div className="space-y-4">
                        <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="كود الجلسة.." className="w-full h-16 rounded-2xl bg-white/80 dark:bg-white/5 border-2 border-sky-100 dark:border-white/10 px-6 text-center text-xl font-black outline-none focus:border-sky-400" />
                        <Button onClick={joinRoom} disabled={!joinCode || loading} variant="secondary" className="w-full h-16 rounded-2xl text-lg font-black">دخول كشريك</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (roomData.status === 'waiting') {
        return (
            <div dir="rtl" className="flex flex-col h-full bg-gradient-to-b from-sky-50 to-white dark:from-sky-950/40 dark:to-[#0c0a12] p-6 pt-12 items-center text-center">
                <h2 className="text-2xl font-black mb-8 text-sky-950 dark:text-white">بانتظار الشريك…</h2>
                <div className="bg-white dark:bg-white/5 w-full max-w-xs rounded-[2.5rem] p-8 shadow-xl border-2 border-dashed border-sky-200 dark:border-sky-500/30 mb-8">
                    <p className="text-[10px] font-black text-sky-400 uppercase mb-2">الكود</p>
                    <p className="text-4xl font-black text-sky-600 dark:text-sky-400 tracking-widest">{roomData.room_code}</p>
                </div>
                <div className={`p-5 rounded-2xl border w-full max-w-xs ${isPartnerInLobby ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200' : 'bg-white/50 dark:bg-white/5 opacity-70'}`}>
                    <p className="font-black text-sky-950 dark:text-white">{partnerInfo?.name || 'الشريك'}</p>
                    <span className={`text-[10px] font-black ${isPartnerInLobby ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {isPartnerInLobby ? 'متصل ✅' : 'بانتظار الدخول…'}
                    </span>
                </div>
            </div>
        );
    }

    if (roomData.status === 'setup') {
        if (!isHost) {
            return (
                <div dir="rtl" className="flex flex-col h-full items-center justify-center p-8 text-center bg-sky-50/50 dark:bg-[#0c0a12]">
                    <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="text-5xl mb-6">✍️</motion.div>
                    <p className="text-lg font-black text-sky-950 dark:text-white mb-2">شريكك يكتب الموقف…</p>
                    <p className="text-sm text-muted-foreground font-bold">خلّيه يخلص ويوصلك السؤال</p>
                </div>
            );
        }
        return (
            <div dir="rtl" className="flex flex-col h-full bg-sky-50/30 dark:bg-[#0c0a12] p-6 pt-8 relative">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-black text-sky-950 dark:text-white">صف الموقف</h2>
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={generateSuggestions}
                        className="flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-4 py-2 rounded-2xl text-[10px] font-black border border-amber-200 dark:border-amber-700/50"
                    >
                        <Sparkles size={14} />
                        اقتراحات ذكية
                    </motion.button>
                </div>
                <p className="text-sm text-muted-foreground font-bold mb-6">اكتب موقفاً واحداً، ثم اسأل بالصمت: لو كنت مكاني، وش بتسوي؟</p>
                
                <textarea
                    value={scenarioDraft}
                    onChange={(e) => setScenarioDraft(e.target.value)}
                    placeholder="مثال: موقف في الشغل أو العائلة يزعجك…"
                    rows={8}
                    dir="rtl"
                    className="w-full rounded-[2.5rem] border-2 border-sky-100 dark:border-white/10 bg-white dark:bg-white/5 p-8 text-base font-bold resize-none focus:ring-2 focus:ring-sky-400 mb-6 shadow-inner outline-none transition-all placeholder:text-sky-200/50"
                />
                
                <Button 
                    onClick={() => submitScenario()} 
                    disabled={loading || !scenarioDraft.trim()} 
                    className="w-full h-16 rounded-2xl font-black bg-sky-600 hover:bg-sky-700 text-white shadow-xl shadow-sky-600/20 text-lg transition-all"
                >
                    إرسال للشريك <Send className="w-5 h-5 ms-3" />
                </Button>

                {/* AI Suggestions Overlay */}
                <AnimatePresence>
                    {showAiSheet && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-white/80 dark:bg-zinc-950/90 backdrop-blur-xl z-50 p-6 flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg"><Sparkles size={20} /></div>
                                    <div>
                                        <h3 className="text-lg font-black text-zinc-900 dark:text-white">مواقف مقترحة</h3>
                                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">مستشار مودة الذكي</p>
                                    </div>
                                </div>
                                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowAiSheet(false)} className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center text-zinc-500"><X className="w-5 h-5" /></motion.button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-4 pb-6 scrollbar-none">
                                {aiSuggestions.map((s, idx) => (
                                    <motion.button
                                        key={idx}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        onClick={() => {
                                            setScenarioDraft(s);
                                            setShowAiSheet(false);
                                        }}
                                        className="w-full text-right p-6 rounded-[2rem] bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 shadow-sm hover:shadow-md hover:border-amber-200 transition-all group"
                                    >
                                        <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 leading-relaxed transition-colors group-hover:text-zinc-950 dark:group-hover:text-white">{s}</p>
                                    </motion.button>
                                ))}
                            </div>

                            <Button 
                                onClick={generateSuggestions}
                                variant="outline"
                                className="w-full h-14 rounded-2xl border-2 border-amber-200 text-amber-600 font-black mb-4 gap-2"
                            >
                                <RefreshCw size={18} /> تحديث القائمة
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    if (roomData.status === 'playing' && gs?.scenario_text?.trim()) {
        if (!gs.answer_text) {
            if (isHost) {
                return (
                    <div dir="rtl" className="flex flex-col h-full p-6 pt-10 bg-sky-50/30 dark:bg-[#0c0a12]">
                        <p className="text-[10px] font-black text-sky-500 uppercase mb-4">الموقف اللي كتبته</p>
                        <div className="bg-white dark:bg-white/5 rounded-3xl p-6 border mb-8 text-start">
                            <p className="text-base font-bold leading-relaxed text-foreground">{gs.scenario_text}</p>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-90">
                            <Heart className="w-12 h-12 text-sky-400 animate-pulse" />
                            <p className="font-black text-sky-900 dark:text-white">بانتظار رد {partnerInfo?.name}…</p>
                        </div>
                    </div>
                );
            }
            return (
                <div dir="rtl" className="flex flex-col h-full bg-sky-50/30 dark:bg-[#0c0a12] p-6 pt-8">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-lg"><MessageCircle size={20} /></div>
                        <div>
                            <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest leading-none mb-1">موقف من شريكك</p>
                            <h3 className="text-sm font-black text-sky-900 dark:text-white">وش رح تسوي لو كنت مكانه؟</h3>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-white/5 rounded-[2.5rem] p-8 border border-sky-100 dark:border-white/10 mb-8 shadow-sm">
                        <p className="text-lg font-black leading-relaxed text-start text-zinc-800 dark:text-zinc-200">{gs.scenario_text}</p>
                    </div>

                    <div className="flex-1 flex flex-col">
                        <textarea
                            value={answerDraft}
                            onChange={(e) => setAnswerDraft(e.target.value)}
                            placeholder="اكتب ردك هنا بكل صراحة 💙..."
                            rows={6}
                            dir="rtl"
                            className="w-full rounded-[2.5rem] border-2 border-sky-100 dark:border-white/10 bg-white dark:bg-white/5 p-8 font-bold resize-none mb-6 min-h-[180px] shadow-inner outline-none focus:ring-2 focus:ring-sky-400 transition-all placeholder:text-sky-200/50"
                        />
                        <Button 
                            onClick={submitAnswer} 
                            disabled={loading || !answerDraft.trim()} 
                            className="w-full h-16 rounded-2xl font-black bg-sky-600 hover:bg-sky-700 text-white shadow-xl shadow-sky-600/20 text-lg transition-all"
                        >
                            إرسال الرد 💌
                        </Button>
                    </div>
                </div>
            );
        }
    }

    if (roomData.status === 'finished' && gs?.scenario_text && gs?.answer_text) {
        return (
            <div dir="rtl" className="flex flex-col h-full items-center justify-center p-6 bg-gradient-to-b from-sky-50 to-white dark:from-sky-950/30 dark:to-[#0c0a12] overflow-y-auto">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-6 shrink-0" />
                <h2 className="text-2xl font-black text-sky-950 dark:text-white mb-6">جلسة مكتملة</h2>
                <div className="w-full max-w-md space-y-4 mb-10">
                    <div className="bg-white dark:bg-white/5 rounded-3xl p-6 border text-start">
                        <p className="text-[10px] font-black text-sky-400 uppercase mb-2">الموقف</p>
                        <p className="font-bold leading-relaxed">{gs.scenario_text}</p>
                    </div>
                    <div className="bg-sky-500/10 rounded-3xl p-6 border border-sky-200/50 text-start">
                        <p className="text-[10px] font-black text-sky-600 uppercase mb-2">الرد</p>
                        <p className="font-bold leading-relaxed">{gs.answer_text}</p>
                    </div>
                </div>
                <div className="w-full max-w-xs flex flex-col gap-4">
                    <Button onClick={() => {
                        supabase.from('game_rooms').update({ status: 'setup', game_state: { scenario_text: '', answer_text: null } }).eq('id', roomData.id);
                    }} className="h-16 rounded-2xl font-black bg-sky-600 text-white shadow-xl shadow-sky-600/20">موقف جديد ✍️</Button>
                    <Button onClick={onBack} variant="secondary" className="h-14 rounded-2xl font-black bg-white dark:bg-white/5 border-2 border-sky-100 dark:border-white/10 text-sky-800 dark:text-sky-200">العودة للألعاب</Button>
                </div>
            </div>
        );
    }

    return (
        <div dir="rtl" className="flex h-full items-center justify-center p-6">
            <p className="text-muted-foreground font-bold">جاري التحميل…</p>
        </div>
    );
}
