import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { Smile, Send, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface EmojiMoodGameProps {
    onBack: () => void;
    userId: string;
    userName: string;
    partnershipId: string | null;
}

type Phase = 'picking_emojis' | 'interpreting' | 'round_done';

interface GamePayload {
    round: number;
    sender_id: string;
    phase: Phase;
    emoji_text: string;
    interpretation: string;
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
        round: typeof o.round === 'number' ? o.round : 1,
        sender_id: o.sender_id ?? '',
        phase: o.phase === 'interpreting' || o.phase === 'round_done' ? o.phase : 'picking_emojis',
        emoji_text: o.emoji_text ?? '',
        interpretation: o.interpretation ?? '',
    };
}

/** على الأقل إيموجي واحد (يونيكود) */
function hasAnyEmoji(s: string): boolean {
    return /\p{Extended_Pictographic}/u.test(s);
}

export function EmojiMoodGame({ onBack: _onBack, userId, userName, partnershipId }: EmojiMoodGameProps) {
    const [joinCode, setJoinCode] = useState('');
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(false);
    const [emojiDraft, setEmojiDraft] = useState('');
    const [interpretDraft, setInterpretDraft] = useState('');
    const [partnerInfo, setPartnerInfo] = useState<{ id: string; name: string } | null>(null);

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
                        name: isUser1 ? (data.user2 as { name?: string })?.name : (data.user1 as { name?: string })?.name || 'الشريك',
                    });
                }
            });
    }, [partnershipId, userId]);

    const createRoom = async () => {
        setLoading(true);
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const state: GamePayload = {
            round: 1,
            sender_id: userId,
            phase: 'picking_emojis',
            emoji_text: '',
            interpretation: '',
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
            await supabase.from('notifications').insert({
                user_id: partnerInfo.id,
                title: 'إيموجي مزاج 😊',
                body: `${userName} يدعوك: فسّر إيموجي يومه! الكود: ${code}`,
                type: 'game_invite',
                metadata: { room_code: code, game_type: 'emoji-mood' },
            });
            toast.success(`تم إرسال الدعوة لـ ${partnerInfo.name}`);
        }
    };

    const joinRoom = async () => {
        if (!joinCode.trim()) return;
        setLoading(true);
        const { data: room, error } = await supabase
            .from('game_rooms')
            .select('*')
            .eq('room_code', joinCode.toUpperCase())
            .eq('game_type', 'emoji-mood')
            .eq('status', 'waiting')
            .single();
        if (error || !room) {
            toast.error('الجلسة غير موجودة');
            setLoading(false);
            return;
        }
        const { data: updated, error: upErr } = await supabase
            .from('game_rooms')
            .update({ guest_user_id: userId, status: 'playing' })
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
        setLoading(true);
        const gs = roomData.game_state;
        await pushState({
            ...gs,
            emoji_text: t,
            phase: 'interpreting',
        });
        setEmojiDraft('');
        setLoading(false);
        toast.success('تم الإرسال — دور الشريك يفسّر');
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

    const nextRound = async () => {
        if (!roomData || !roomData.guest_user_id) return;
        setLoading(true);
        const gs = roomData.game_state;
        const host = roomData.host_user_id;
        const guest = roomData.guest_user_id;
        const newSender = gs.sender_id === host ? guest : host;
        await pushState({
            round: gs.round + 1,
            sender_id: newSender,
            phase: 'picking_emojis',
            emoji_text: '',
            interpretation: '',
        });
        setLoading(false);
        toast.message(`جولة ${gs.round + 1} — دور ${newSender === userId ? 'ك' : 'الشريك'} يرسل الإيموجي`);
    };

    const gs = roomData?.game_state;
    const isSender = gs ? gs.sender_id === userId : false;
    const partnerName = partnerInfo?.name ?? 'الشريك';

    const turnHint = useMemo(() => {
        if (!gs || !roomData) return '';
        if (gs.phase === 'picking_emojis') {
            return isSender
                ? 'دورك: أرسل إيموجي يومك (بدون حدّ — قصة، أغنية، مشكلة، مزاج…)'
                : `دور ${partnerName}: يرسل الإيموجي…`;
        }
        if (gs.phase === 'interpreting') {
            return isSender
                ? `دور ${partnerName}: يفسّر إيموجيك…`
                : 'دورك: فسّر الإيموجي — قصة، أغنية، مشكلة، يوم… اللي يخطر ببالك';
        }
        return 'الجولة انتهت — شوفوا التفسير تحت';
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
                            بالدور: واحد يرسل <span className="text-amber-700 dark:text-amber-300">إيموجي بلا حدّ</span> يصف يومه، والثاني{' '}
                            <span className="text-amber-700 dark:text-amber-300">يفسّر</span> — قصة، أغنية، مشكلة، أي شكل يعجبكم.
                        </p>
                        <Button onClick={createRoom} disabled={loading} className="w-full h-14 rounded-2xl text-base font-black bg-gradient-to-l from-amber-500 to-orange-500 hover:opacity-95">
                            {loading ? 'لحظة…' : 'ابدأ جلسة'}
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
            <div className="shrink-0 px-4 pt-3 pb-2 border-b border-border/50 bg-amber-500/5">
                <p className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-widest text-center mb-1">
                    جولة {gs.round} — بالدور
                </p>
                <p className="text-[13px] font-bold text-center text-foreground leading-snug px-2">{turnHint}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-28 space-y-6">
                {gs.phase === 'picking_emojis' && isSender && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        <label className="text-sm font-black text-amber-900 dark:text-amber-100">إيموجي يومك</label>
                        <textarea
                            value={emojiDraft}
                            onChange={(e) => setEmojiDraft(e.target.value)}
                            placeholder="الصق أو اكتب إيموجي بدون حدّ… 🌧️☕🎧💭"
                            rows={6}
                            dir="rtl"
                            className="w-full rounded-3xl border-2 border-amber-200/60 dark:border-white/10 bg-white dark:bg-white/5 p-5 text-2xl leading-relaxed resize-none focus:ring-2 focus:ring-amber-400 min-h-[160px]"
                        />
                        <p className="text-[11px] font-bold text-muted-foreground text-center">ممكن قصة، أغنية، مشكلة، يوم عادي — عبّر كما تحب</p>
                        <Button onClick={submitEmojis} disabled={loading || !emojiDraft.trim()} className="w-full h-14 rounded-2xl font-black bg-amber-500 hover:bg-amber-600 text-lg">
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

                {gs.phase === 'interpreting' && isSender && (
                    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                        <p className="text-5xl leading-relaxed break-all opacity-90" dir="ltr">
                            {gs.emoji_text}
                        </p>
                        <p className="font-black text-muted-foreground">بانتظار تفسير {partnerName}…</p>
                    </div>
                )}

                {gs.phase === 'round_done' && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                        <div className="rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/40 p-6">
                            <p className="text-[10px] font-black text-amber-600 uppercase mb-2">الإيموجي</p>
                            <p className="text-3xl break-all text-start" dir="ltr">
                                {gs.emoji_text}
                            </p>
                        </div>
                        <div className="rounded-3xl bg-orange-50/80 dark:bg-orange-950/20 border border-orange-200/40 p-6">
                            <p className="text-[10px] font-black text-orange-600 uppercase mb-2">التفسير</p>
                            <p className="text-base font-bold leading-relaxed whitespace-pre-wrap text-start">{gs.interpretation}</p>
                        </div>
                        <Button
                            onClick={nextRound}
                            disabled={loading || !roomData.guest_user_id}
                            className="w-full h-14 rounded-2xl font-black gap-2 bg-gradient-to-l from-amber-500 to-orange-500"
                        >
                            <RefreshCw className="w-5 h-5" />
                            جولة جديدة (يتبدّل الدور)
                        </Button>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
