import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { Smile, Send, RefreshCw, Sparkles, Trophy } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface EmojiMoodGameProps {
    onBack: () => void;
    userId: string;
    userName: string;
    partnershipId: string | null;
    initialCode?: string;
}

type Phase = 'picking_emojis' | 'interpreting' | 'guessing' | 'round_done' | 'game_over';

interface GamePayload {
    total_rounds: number;
    current_round: number;
    mode: 'story' | 'song';
    sender_id: string;
    phase: Phase;
    emoji_text: string;
    target_answer: string;
    guess_answer: string;
    interpretation: string;
    scores: Record<string, number>;
}

interface RoomData {
    id: string;
    room_code: string;
    host_user_id: string;
    guest_user_id: string | null;
    status: string;
    game_state: GamePayload;
}

function parseGs(raw: unknown): GamePayload {
    const o = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<GamePayload>;
    return {
        total_rounds: typeof o.total_rounds === 'number' ? o.total_rounds : 3,
        current_round: typeof o.current_round === 'number' ? o.current_round : 1,
        mode: o.mode === 'song' ? 'song' : 'story',
        sender_id: o.sender_id ?? '',
        phase: (o.phase as Phase) ?? 'picking_emojis',
        emoji_text: o.emoji_text ?? '',
        target_answer: o.target_answer ?? '',
        guess_answer: o.guess_answer ?? '',
        interpretation: o.interpretation ?? '',
        scores: o.scores ?? {},
    };
}

/** على الأقل إيموجي واحد (يونيكود) */
function hasAnyEmoji(s: string): boolean {
    return /\p{Extended_Pictographic}/u.test(s);
}

export function EmojiMoodGame({ onBack: _onBack, userId, userName, partnershipId, initialCode }: EmojiMoodGameProps) {
    const [joinCode, setJoinCode] = useState('');
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(false);
    const [emojiDraft, setEmojiDraft] = useState('');
    const [targetAnswerDraft, setTargetAnswerDraft] = useState('');
    const [guessDraft, setGuessDraft] = useState('');
    const [interpretDraft, setInterpretDraft] = useState('');
    const [partnerInfo, setPartnerInfo] = useState<{ id: string; name: string } | null>(null);

    // Setup Options
    const [numRounds, setNumRounds] = useState(3);
    const [gameMode, setGameMode] = useState<'story' | 'song'>('story');

    useEffect(() => {
        if (!roomData?.id) return;
        const channel = supabase
            .channel(`game_emoji_${roomData.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomData.id}` },
                (payload) => {
                    const n = payload.new as Record<string, unknown>;
                    setRoomData({ ...n, game_state: parseGs(n.game_state) } as RoomData);
                }
            )
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomData?.id]);

    useEffect(() => {
        if (!partnershipId) return;
        supabase
            .from('partnerships')
            .select('user1_id, user2_id, user1:user1_id(name), user2:user2_id(name)')
            .eq('id', partnershipId)
            .single()
            .then(({ data }) => {
                if (data) {
                    const isUser1 = data.user1_id === userId;
                    setPartnerInfo({
                        id: isUser1 ? data.user2_id : data.user1_id,
                        name: (isUser1 ? (data.user2 as { name?: string })?.name : (data.user1 as { name?: string })?.name) || 'الشريك',
                    });
                }
            });
    }, [partnershipId, userId]);

    const createRoom = async () => {
        setLoading(true);
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const state: GamePayload = {
            total_rounds: numRounds,
            current_round: 1,
            mode: gameMode,
            sender_id: userId,
            phase: 'picking_emojis',
            emoji_text: '',
            target_answer: '',
            guess_answer: '',
            interpretation: '',
            scores: { [userId]: 0 },
        };
        const { data, error } = await supabase
            .from('game_rooms')
            .insert({
                room_code: code,
                game_type: 'emoji-mood',
                host_user_id: userId,
                status: 'waiting',
                game_state: state,
            })
            .select()
            .single();
        if (error) {
            toast.error('تعذّر إنشاء الجلسة');
            setLoading(false);
            return;
        }
        setRoomData({ ...data, game_state: state } as RoomData);
        setLoading(false);
        if (partnerInfo) {
            const modeName = gameMode === 'song' ? 'تحدي الأغاني 🎵' : 'تحدي القصص 📖';
            await supabase.from('notifications').insert({
                user_id: partnerInfo.id,
                title: 'إيموجي مزاج 😊',
                body: `${userName} يدعوك: ${modeName}! الكود: ${code}`,
                type: 'game_invite',
                metadata: { room_code: code, game_type: 'emoji-mood' },
            });
            toast.success(`تم إرسال الدعوة لـ ${partnerInfo.name}`);
        }
    };

    useEffect(() => {
        if (initialCode && !roomData) {
            setJoinCode(initialCode);
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
        const { data: room, error } = await supabase
            .from('game_rooms')
            .select('*')
            .eq('room_code', codeToUse.toUpperCase())
            .eq('game_type', 'emoji-mood')
            .eq('status', 'waiting')
            .single();
        if (error || !room) {
            toast.error('الجلسة غير موجودة');
            setLoading(false);
            return;
        }
        
        const gs = parseGs(room.game_state);
        const nextGs: GamePayload = {
            ...gs,
            scores: { ...gs.scores, [userId]: 0 }
        };

        const { data: updated, error: upErr } = await supabase
            .from('game_rooms')
            .update({ guest_user_id: userId, status: 'playing', game_state: nextGs })
            .eq('id', room.id)
            .select()
            .single();
        if (upErr || !updated) {
            toast.error('تعذّر الانضمام');
            setLoading(false);
            return;
        }
        setRoomData({ ...updated, game_state: parseGs(updated.game_state) } as RoomData);
        setLoading(false);
    };

    const pushState = async (next: GamePayload) => {
        if (!roomData) return;
        await supabase.from('game_rooms').update({ game_state: next }).eq('id', roomData.id);
    };

    const submitEmojis = async () => {
        if (!roomData) return;
        const t = emojiDraft.trim();
        if (!hasAnyEmoji(t)) {
            toast.error('أضف إيموجي واحد على الأقل');
            return;
        }
        
        if (roomData.game_state.mode === 'song' && !targetAnswerDraft.trim()) {
            toast.error('اكتب اسم الأغنية');
            return;
        }

        setLoading(true);
        const gs = roomData.game_state;
        await pushState({
            ...gs,
            emoji_text: t,
            target_answer: targetAnswerDraft.trim(),
            phase: gs.mode === 'song' ? 'guessing' : 'interpreting',
        });
        setEmojiDraft('');
        setTargetAnswerDraft('');
        setLoading(false);
        toast.success(gs.mode === 'song' ? 'تم الإرسال — دور الشريك يحزر' : 'تم الإرسال — دور الشريك يفسّر');
    };

    const submitInterpretation = async () => {
        if (!roomData) return;
        const t = interpretDraft.trim();
        if (!t) {
            toast.error('اكتب تفسيرك');
            return;
        }
        setLoading(true);
        const gs = roomData.game_state;
        await pushState({
            ...gs,
            interpretation: t,
            phase: 'round_done',
        });
        setInterpretDraft('');
        setLoading(false);
    };

    const submitGuess = async () => {
        if (!roomData) return;
        const t = guessDraft.trim();
        if (!t) {
            toast.error('اكتب تخمينك');
            return;
        }
        setLoading(true);
        const gs = roomData.game_state;
        
        const isCorrect = t.toLowerCase() === gs.target_answer.toLowerCase();
        const nextScores = { ...gs.scores };
        if (isCorrect) {
            nextScores[userId] = (nextScores[userId] || 0) + 1;
            toast.success('إجابة صحيحة! حصلت على نقطة');
        } else {
            toast.error(`للأسف خطأ! الأغنية كانت: ${gs.target_answer}`);
        }

        await pushState({
            ...gs,
            guess_answer: t,
            scores: nextScores,
            phase: 'round_done',
        });
        setGuessDraft('');
        setLoading(false);
    };

    const nextRound = async () => {
        if (!roomData || !roomData.guest_user_id) return;
        setLoading(true);
        const gs = roomData.game_state;
        
        if (gs.current_round >= gs.total_rounds) {
            await pushState({
                ...gs,
                phase: 'game_over'
            });
            setLoading(false);
            return;
        }

        const host = roomData.host_user_id;
        const guest = roomData.guest_user_id;
        const newSender = gs.sender_id === host ? guest : host;
        await pushState({
            ...gs,
            current_round: gs.current_round + 1,
            sender_id: newSender,
            phase: 'picking_emojis',
            emoji_text: '',
            target_answer: '',
            guess_answer: '',
            interpretation: '',
        });
        setLoading(false);
        toast.message(`جولة ${gs.current_round + 1} — دور ${newSender === userId ? 'ك' : 'الشريك'} يرسل الإيموجي`);
    };

    const gs = roomData?.game_state;
    const isSender = gs ? gs.sender_id === userId : false;
    const partnerName = partnerInfo?.name ?? 'الشريك';

    const turnHint = useMemo(() => {
        if (!gs || !roomData) return '';
        if (gs.phase === 'picking_emojis') {
            const prefix = gs.mode === 'song' ? 'أغنية من اختيارك' : 'إيموجي يومك/قصة';
            return isSender
                ? `دورك: صِف ${prefix} بالإيموجي`
                : `دور ${partnerName}: يرسل الإيموجي…`;
        }
        if (gs.phase === 'interpreting') {
            return isSender
                ? `دور ${partnerName}: يفسّر إيموجيك…`
                : 'دورك: فسّر الإيموجي — قصة، فكرة، أو يوم…';
        }
        if (gs.phase === 'guessing') {
            return isSender
                ? `دور ${partnerName}: يحزر الأغنية…`
                : 'دورك: احزر اسم الأغنية التي يرمز إليها الإيموجي';
        }
        if (gs.phase === 'game_over') return 'انتهت اللعبة! شوفوا النتائج';
        return 'الجولة انتهت — شوفوا التفاصيل تحت';
    }, [gs, isSender, partnerName, roomData]);

    if (!roomData) {
        return (
            <div dir="rtl" className="flex flex-col h-full bg-gradient-to-b from-amber-50/90 to-white dark:from-amber-950/30 dark:to-[#0c0a12] p-6 overflow-y-auto">
                <div className="flex-1 flex flex-col justify-center gap-6 pb-16 max-w-md mx-auto w-full">
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white dark:bg-white/5 rounded-[2.5rem] p-8 text-center shadow-xl border border-amber-100/80 dark:border-white/10"
                    >
                        <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-[1.8rem] flex items-center justify-center mx-auto mb-5 shadow-lg">
                            <Smile className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-black text-amber-950 dark:text-white mb-2">إيموجي مزاج</h2>
                        <p className="text-sm font-bold text-amber-900/65 dark:text-amber-100/70 leading-relaxed mb-6">
                            تواصل بالإيموجي! واحد يرسل <span className="text-amber-700 dark:text-amber-300">بلا حدّ</span> والثاني يخمّن أو يفسّر.
                        </p>

                        <div className="space-y-5 mb-8 text-start">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-amber-800/60 uppercase tracking-tighter mx-1">كم جولة؟</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[3, 5, 10].map(n => (
                                        <button
                                            key={n}
                                            onClick={() => setNumRounds(n)}
                                            className={`h-11 rounded-xl font-black transition-all ${numRounds === n ? 'bg-amber-500 text-white shadow-lg' : 'bg-amber-100/50 dark:bg-white/5 text-amber-900 dark:text-white/60'}`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-amber-800/60 uppercase tracking-tighter mx-1">شو نوع اللعبة؟</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setGameMode('story')}
                                        className={`h-12 rounded-xl font-black flex items-center justify-center gap-2 transition-all ${gameMode === 'story' ? 'bg-amber-500 text-white shadow-lg' : 'bg-amber-100/50 dark:bg-white/5 text-amber-900/60 dark:text-white/40'}`}
                                    >
                                        📖 قصص
                                    </button>
                                    <button
                                        onClick={() => setGameMode('song')}
                                        className={`h-12 rounded-xl font-black flex items-center justify-center gap-2 transition-all ${gameMode === 'song' ? 'bg-amber-500 text-white shadow-lg' : 'bg-amber-100/50 dark:bg-white/5 text-amber-900/60 dark:text-white/40'}`}
                                    >
                                        🎵 أغاني
                                    </button>
                                </div>
                            </div>
                        </div>

                        <Button onClick={createRoom} disabled={loading} className="w-full h-14 rounded-2xl text-base font-black bg-gradient-to-l from-amber-500 to-orange-500 hover:opacity-95 shadow-lg shadow-amber-500/20">
                            {loading ? 'لحظة…' : 'ابدأ الجلسة'}
                        </Button>
                    </motion.div>
                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border/60" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-background px-3 text-[11px] font-black text-muted-foreground uppercase">أو انضم بالكود</span>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <input
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="كود الجلسة"
                            className="w-full h-14 rounded-2xl bg-white/80 dark:bg-white/5 border-2 border-amber-100 dark:border-white/10 px-5 text-center text-lg font-black tracking-widest"
                        />
                        <Button onClick={joinRoom} disabled={!joinCode || loading} variant="secondary" className="w-full h-14 rounded-2xl font-black">
                            دخول
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (roomData.status === 'waiting') {
        return (
            <div dir="rtl" className="flex flex-col h-full items-center justify-center p-8 text-center bg-amber-50/40 dark:bg-[#0c0a12]">
                <Sparkles className="w-12 h-12 text-amber-500 mb-4" />
                <h2 className="text-xl font-black text-amber-950 dark:text-white mb-2">شارِك الكود مع شريكك</h2>
                <p className="text-4xl font-black tracking-[0.2em] text-amber-600 dark:text-amber-400 mb-6">{roomData.room_code}</p>
                <p className="text-sm font-bold text-muted-foreground">أول جولة: أنت ترسل الإيموجي أولاً</p>
            </div>
        );
    }

    if (!gs) return null;

    return (
        <div dir="rtl" className="flex flex-col h-full bg-background overflow-hidden">
            <div className="shrink-0 px-4 pt-3 pb-2 border-b border-border/50 bg-amber-500/5 flex items-center justify-between">
                <div className="flex-1">
                    <p className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-widest text-center mb-1">
                        جولة {gs.current_round} من {gs.total_rounds} — {gs.mode === 'song' ? 'أغاني' : 'قصص'}
                    </p>
                    <p className="text-[13px] font-bold text-center text-foreground leading-snug px-2">{turnHint}</p>
                </div>
                {gs.mode === 'song' && (
                    <div className="bg-amber-100 dark:bg-amber-900/40 px-3 py-1 rounded-full flex flex-col items-center min-w-[60px]">
                        <span className="text-[9px] font-black text-amber-800 dark:text-amber-400">النتيجة</span>
                        <span className="text-xs font-black">{gs.scores[userId] || 0} - {gs.scores[partnerInfo?.id ?? ''] || 0}</span>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-28 space-y-6">
                {gs.phase === 'picking_emojis' && isSender && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        <label className="text-sm font-black text-amber-900 dark:text-amber-100">
                            {gs.mode === 'song' ? 'وصِف الأغنية بالإيموجي' : 'إيموجي يومك / القصة'}
                        </label>
                        <textarea
                            value={emojiDraft}
                            onChange={(e) => setEmojiDraft(e.target.value)}
                            placeholder="الصق أو اكتب إيموجي بدون حدّ… 🌧️☕🎧💭"
                            rows={4}
                            dir="rtl"
                            className="w-full rounded-2xl border-2 border-amber-200/60 dark:border-white/10 bg-white dark:bg-white/5 p-5 text-2xl leading-relaxed resize-none focus:ring-2 focus:ring-amber-400 min-h-[120px]"
                        />

                        {gs.mode === 'song' && (
                            <div className="space-y-2">
                                <label className="text-sm font-black text-amber-900 dark:text-amber-100">اسم الأغنية (الحل الصحيح)</label>
                                <input
                                    value={targetAnswerDraft}
                                    onChange={(e) => setTargetAnswerDraft(e.target.value)}
                                    placeholder="اكتب اسم الأغنية هنا…"
                                    className="w-full h-14 rounded-2xl border-2 border-amber-200/60 dark:border-white/10 bg-white dark:bg-white/5 px-5 text-lg font-bold"
                                />
                            </div>
                        )}

                        <p className="text-[11px] font-bold text-muted-foreground text-center">
                            {gs.mode === 'song' ? 'اكتب الأغنية وصِفها بالإيموجي ليحزرها شريكك' : 'ممكن قصة، أغنية، مشكلة، يوم عادي — عبّر كما تحب'}
                        </p>
                        <Button onClick={submitEmojis} disabled={loading || !emojiDraft.trim()} className="w-full h-14 rounded-2xl font-black bg-amber-500 hover:bg-amber-600 text-lg shadow-lg shadow-amber-500/20">
                            <Send className="w-5 h-5 ms-2" /> إرسال للشريك
                        </Button>
                    </motion.div>
                )}

                {gs.phase === 'picking_emojis' && !isSender && (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                        <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.8, repeat: Infinity }} className="text-6xl">
                            ✨
                        </motion.div>
                        <p className="font-black text-lg">بانتظار إيموجي {partnerName}…</p>
                    </div>
                )}

                {gs.phase === 'interpreting' && !isSender && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        <div className="rounded-3xl bg-amber-100/50 dark:bg-amber-500/10 border border-amber-200/50 p-6 text-center">
                            <p className="text-[10px] font-black text-amber-600 uppercase mb-3">الإيموجي</p>
                            <p className="text-3xl sm:text-4xl leading-relaxed break-all" dir="ltr">
                                {gs.emoji_text}
                            </p>
                        </div>
                        <label className="text-sm font-black">تفسيرك</label>
                        <textarea
                            value={interpretDraft}
                            onChange={(e) => setInterpretDraft(e.target.value)}
                            placeholder="قصة، أغنية، مشكلة، تفسير يومه… اكتب بحرية"
                            rows={8}
                            dir="rtl"
                            className="w-full rounded-3xl border-2 border-border bg-card p-5 text-base font-bold resize-none min-h-[180px]"
                        />
                        <Button onClick={submitInterpretation} disabled={loading || !interpretDraft.trim()} className="w-full h-14 rounded-2xl font-black bg-orange-500 hover:bg-orange-600 text-lg">
                            إرسال التفسير
                        </Button>
                    </motion.div>
                )}

                {(gs.phase === 'interpreting' || gs.phase === 'guessing') && isSender && (
                    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                        <p className="text-5xl leading-relaxed break-all opacity-90" dir="ltr">
                            {gs.emoji_text}
                        </p>
                        <p className="font-black text-muted-foreground">بانتظار {gs.phase === 'guessing' ? 'تخمين' : 'تفسير'} {partnerName}…</p>
                    </div>
                )}

                {gs.phase === 'guessing' && !isSender && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        <div className="rounded-3xl bg-amber-100/50 dark:bg-amber-500/10 border border-amber-200/50 p-6 text-center">
                            <p className="text-[10px] font-black text-amber-600 uppercase mb-3">الإيموجي</p>
                            <p className="text-3xl sm:text-4xl leading-relaxed break-all" dir="ltr">
                                {gs.emoji_text}
                            </p>
                        </div>
                        <label className="text-sm font-black">ما هي هذه الأغنية؟</label>
                        <input
                            value={guessDraft}
                            onChange={(e) => setGuessDraft(e.target.value)}
                            placeholder="اكتب اسم الأغنية هنا…"
                            className="w-full h-16 rounded-2xl border-2 border-border bg-card px-5 text-lg font-bold"
                            onKeyDown={(e) => e.key === 'Enter' && submitGuess()}
                        />
                        <Button onClick={submitGuess} disabled={loading || !guessDraft.trim()} className="w-full h-14 rounded-2xl font-black bg-orange-500 hover:bg-orange-600 text-lg shadow-lg">
                            إرسال التخمين
                        </Button>
                    </motion.div>
                )}

                {gs.phase === 'round_done' && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                        <div className="rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/40 p-6">
                            <p className="text-[10px] font-black text-amber-600 uppercase mb-2">الإيموجي المرسل</p>
                            <p className="text-3xl break-all text-start" dir="ltr">
                                {gs.emoji_text}
                            </p>
                        </div>
                        
                        {gs.mode === 'song' ? (
                            <div className="space-y-4">
                                <div className="rounded-3xl bg-green-50/80 dark:bg-green-950/20 border border-green-200/40 p-6">
                                    <p className="text-[10px] font-black text-green-600 uppercase mb-2">الأغنية الصحيحة</p>
                                    <p className="text-xl font-black text-start">{gs.target_answer}</p>
                                </div>
                                <div className={`rounded-3xl border p-6 ${gs.guess_answer.toLowerCase() === gs.target_answer.toLowerCase() ? 'bg-blue-50/80 dark:bg-blue-950/20 border-blue-200/40' : 'bg-rose-50/80 dark:bg-rose-950/20 border-rose-200/40'}`}>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase mb-2">تخمين الشريك</p>
                                    <p className="text-lg font-bold text-start">{gs.guess_answer}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-3xl bg-orange-50/80 dark:bg-orange-950/20 border border-orange-200/40 p-6">
                                <p className="text-[10px] font-black text-orange-600 uppercase mb-2">التفسير</p>
                                <p className="text-base font-bold leading-relaxed whitespace-pre-wrap text-start">{gs.interpretation}</p>
                            </div>
                        )}

                        <Button
                            onClick={nextRound}
                            disabled={loading || !roomData.guest_user_id}
                            className="w-full h-14 rounded-2xl font-black gap-2 bg-gradient-to-l from-amber-500 to-orange-500 shadow-lg"
                        >
                            <RefreshCw className="w-5 h-5" />
                            {gs.current_round >= gs.total_rounds ? 'عرض النتائج النهائية' : 'الجولة التالية'}
                        </Button>
                    </motion.div>
                )}

                {gs.phase === 'game_over' && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-8 py-10">
                        <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl">
                            <Trophy className="w-12 h-12 text-white" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-3xl font-black text-amber-950 dark:text-white">انتهت اللعبة!</h2>
                            <p className="text-sm font-bold text-muted-foreground">النتيجة النهائية لمود الأغاني</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                            <div className="bg-white dark:bg-white/5 rounded-3xl p-6 border border-amber-100 dark:border-white/10 shadow-xl">
                                <p className="text-[10px] font-black text-amber-600 uppercase mb-1">أنت</p>
                                <p className="text-4xl font-black">{gs.scores[userId] || 0}</p>
                            </div>
                            <div className="bg-white dark:bg-white/5 rounded-3xl p-6 border border-amber-100 dark:border-white/10 shadow-xl">
                                <p className="text-[10px] font-black text-amber-600 uppercase mb-1">{partnerInfo?.name || 'الشريك'}</p>
                                <p className="text-4xl font-black">{gs.scores[partnerInfo?.id ?? ''] || 0}</p>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button onClick={() => setRoomData(null)} className="w-full h-14 rounded-2xl font-black bg-amber-950 dark:bg-amber-500 text-white">
                                العودة للقائمة
                            </Button>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
