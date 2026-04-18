import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { Split, CheckCircle2, Trophy, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface PartnerPredictGameProps {
    onBack: () => void;
    userId: string;
    userName: string;
    partnershipId: string | null;
}

type GameState = 'menu' | 'lobby' | 'playing' | 'finished';

interface RoomData {
    id: string;
    room_code: string;
    host_user_id: string;
    guest_user_id: string | null;
    status: string;
    game_state: {
        question_index: number;
        host_pick: string | null;
        guest_pick: string | null;
        matches: number;
        turn: string | null;
        phase: 'picking' | 'revealed';
    };
}

const DILEMMAS = [
    { a: "نسافر لغابة معزولة شهر 🌲", b: "نسكن في مدينة صاخبة سنة 🏙️" },
    { a: "هدية غالية ومفاجئة 🎁", b: "هدية بسيطة مخططين لها سوا ✨" },
    { a: "نسهر نحضر فيلم رعب 😱", b: "نصحى بدري نطلع نتمشى 🌅" },
    { a: "نعيش ببيت قديم ريفي 🏡", b: "نعيش بشقة مودرن بالمدينة 🏙️" },
    { a: "نطبخ غدا فخم سوا 👨‍🍳", b: "نطلب ديليفري ونرتاح 🍕" },
    { a: "قدرة الطيران 🦅", b: "قدرة الاختفاء 👻" },
    { a: "برودة دائمة ❄️", b: "حرارة دائمة 🔥" },
    { a: "نرجع للماضي نعدل موقف 🕰️", b: "نشوف المستقبل لدقيقة 🚀" }
];

export function PartnerPredictGame({ onBack, userId, userName, partnershipId }: PartnerPredictGameProps) {
    const [uiState, setUiState] = useState<GameState>('menu');
    const [joinCode, setJoinCode] = useState('');
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(false);
    const [presence, setPresence] = useState<Record<string, unknown>>({});
    const [partnerInfo, setPartnerInfo] = useState<{ id: string; name: string } | null>(null);

    useEffect(() => {
        if (!roomData?.id) return;
        const channel = supabase.channel(`game_pp_${roomData.id}`, { config: { presence: { key: userId } } })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomData.id}` }, (payload) => {
                const newData = payload.new as Record<string, unknown>;
                const state = typeof newData.game_state === 'string' ? JSON.parse(newData.game_state as string) : newData.game_state;
                setRoomData(prev => ({ ...prev!, ...newData, game_state: state } as RoomData));
            })
            .on('presence', { event: 'sync' }, () => setPresence(channel.presenceState()))
            .subscribe(async (status) => { if (status === 'SUBSCRIBED') await channel.track({ user_id: userId, name: userName }); });
        return () => { supabase.removeChannel(channel); };
    }, [roomData?.id, userId, userName]);

    useEffect(() => {
        if (!roomData?.id) return;
        let next: GameState = 'menu';
        if (roomData.status === 'waiting') next = 'lobby';
        else if (roomData.status === 'playing') next = 'playing';
        else if (roomData.status === 'finished') next = 'finished';
        setUiState(next);
    }, [roomData?.status, roomData?.id]);

    useEffect(() => {
        if (!partnershipId) return;
        supabase.from('partnerships').select('user1_id, user2_id, user1:user1_id(name), user2:user2_id(name)')
            .eq('id', partnershipId).single().then(({ data }) => {
                if (data) {
                    const isUser1 = data.user1_id === userId;
                    setPartnerInfo({ id: isUser1 ? data.user2_id : data.user1_id, name: isUser1 ? (data.user2 as { name?: string })?.name : (data.user1 as { name?: string })?.name || 'الشريك' });
                }
            });
    }, [partnershipId, userId]);

    const createRoom = async () => {
        setLoading(true);
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const state = { question_index: 0, host_pick: null, guest_pick: null, matches: 0, turn: userId, phase: 'picking' as const };
        const { data, error } = await supabase.from('game_rooms').insert({ room_code: code, game_type: 'partner-predict', host_user_id: userId, status: 'waiting', game_state: state }).select().single();
        if (error) { setLoading(false); return; }
        setRoomData({ ...data, game_state: state } as RoomData);
        setUiState('lobby');
        setLoading(false);
        if (partnerInfo) await supabase.from('notifications').insert({ user_id: partnerInfo.id, title: 'ماذا يختار شريكك؟ 🤔', body: `${userName} يتحداك: خمّن اختياره في المواقف الصعبة!`, type: 'game_invite', metadata: { room_code: code, game_type: 'partner-predict' } });
    };

    const joinRoom = async () => {
        if (!joinCode) return;
        setLoading(true);
        const { data: room, error } = await supabase.from('game_rooms').select('*').eq('room_code', joinCode.toUpperCase()).eq('game_type', 'partner-predict').eq('status', 'waiting').single();
        if (error || !room) { toast.error('الغرفة غير موجودة'); setLoading(false); return; }
        const { data: updated } = await supabase.from('game_rooms').update({ guest_user_id: userId, status: 'playing' }).eq('id', room.id).select().single();
        if (updated) setRoomData({ ...updated, game_state: typeof updated.game_state === 'string' ? JSON.parse(updated.game_state) : updated.game_state } as RoomData);
        setUiState('playing');
        setLoading(false);
    };

    const handlePick = async (option: string) => {
        if (!roomData) return;
        const isHost = userId === roomData.host_user_id;
        const gs = roomData.game_state;
        const newState = { ...gs, [isHost ? 'host_pick' : 'guest_pick']: option };

        if (newState.host_pick && newState.guest_pick) {
            const isMatch = newState.host_pick === newState.guest_pick;
            if (isMatch) newState.matches += 1;
            newState.phase = 'revealed';
            await supabase.from('game_rooms').update({ game_state: newState }).eq('id', roomData.id);
            if (isMatch) toast.success('تطابق رائع! 😍');
            else toast.error('لسه ما بتعرف شريكك منيح! 😂');
        } else {
            await supabase.from('game_rooms').update({ game_state: newState }).eq('id', roomData.id);
        }
    };

    const nextQuestion = async () => {
        if (!roomData) return;
        const nextIdx = roomData.game_state.question_index + 1;
        if (nextIdx >= DILEMMAS.length) {
            await supabase.from('game_rooms').update({ status: 'finished' }).eq('id', roomData.id);
            setUiState('finished');
            return;
        }
        const gid = roomData.guest_user_id;
        const nextTurn =
            roomData.game_state.turn === roomData.host_user_id
                ? gid ?? roomData.host_user_id
                : roomData.host_user_id;
        const newState = {
            ...roomData.game_state,
            question_index: nextIdx,
            host_pick: null,
            guest_pick: null,
            phase: 'picking' as const,
            turn: nextTurn,
        };
        await supabase.from('game_rooms').update({ game_state: newState, status: 'playing' }).eq('id', roomData.id);
    };

    if (uiState === 'menu') {
        return (
            <div dir="rtl" className="flex flex-col h-full bg-[#fdf2f2] dark:bg-[#0c0a12] p-6">
                <div className="flex-1 flex flex-col justify-center gap-6 pb-20">
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white dark:bg-white/5 rounded-[2.5rem] p-10 text-center shadow-xl border-b-8 border-violet-500/20">
                        <div className="w-20 h-20 bg-violet-600 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3">
                            <Split className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-black mb-3 text-violet-950 dark:text-white">ماذا تتوقع أن يختار شريكك؟</h2>
                        <p className="text-violet-700/70 dark:text-violet-200/70 font-bold text-sm mb-10 leading-relaxed">كم تعرف شريكك؟ خمّن الخيار الذي سيفضّله في مواقف صعبة!</p>
                        <Button onClick={createRoom} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black bg-violet-600 hover:bg-violet-700 text-white shadow-xl">
                            {loading ? 'ثوانِ..' : '🚀 بدء التحدي'}
                        </Button>
                    </motion.div>
                    <div className="space-y-4">
                        <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="كود التحدي.." className="w-full h-16 rounded-2xl bg-white/50 dark:bg-white/5 border-2 border-violet-100 dark:border-white/10 px-6 text-center text-xl font-black outline-none focus:border-violet-400" />
                        <Button onClick={joinRoom} disabled={!joinCode || loading} variant="secondary" className="w-full h-16 rounded-2xl text-lg font-black text-violet-700 dark:text-violet-300">دخول</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (uiState === 'lobby') {
        const isPartnerInRoom = partnerInfo && presence[partnerInfo.id];
        return (
            <div dir="rtl" className="flex flex-col h-full bg-[#fdf2f2] dark:bg-[#0c0a12] p-6 pt-12 items-center text-center">
                <h2 className="text-3xl font-black mb-10 text-violet-950 dark:text-white">بانتظار المنافس..</h2>
                <div className="bg-white dark:bg-white/5 w-full max-w-xs rounded-[2.5rem] p-10 shadow-2xl border-4 border-dashed border-violet-200 dark:border-violet-500/30 relative mb-12">
                    <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-2">كود الغرفة</p>
                    <p className="text-5xl font-black text-violet-600 dark:text-violet-400">{roomData?.room_code}</p>
                </div>
                <div className={`p-6 rounded-3xl border w-full max-w-xs transition-all ${isPartnerInRoom ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-200' : 'bg-white/50 dark:bg-white/5 border-stone-200 opacity-60'}`}>
                    <p className="font-black text-violet-950 dark:text-white">{partnerInfo?.name || 'الشريك'}</p>
                    <span className={`text-[10px] font-black ${isPartnerInRoom ? 'text-emerald-500' : 'text-stone-400'}`}>
                        {isPartnerInRoom ? 'دخل التحدي ⚡' : 'بانتظار دخوله..'}
                    </span>
                </div>
            </div>
        );
    }

    if (uiState === 'playing') {
        const isHost = userId === roomData?.host_user_id;
        const myPick = isHost ? roomData?.game_state.host_pick : roomData?.game_state.guest_pick;
        const partnerPick = isHost ? roomData?.game_state.guest_pick : roomData?.game_state.host_pick;
        const currentDilemma = DILEMMAS[roomData?.game_state.question_index || 0];
        const isTurn = roomData?.game_state.turn === userId;
        const phase = roomData?.game_state.phase || 'picking';

        return (
            <div dir="rtl" className="flex flex-col h-full bg-[#fdf2f2] dark:bg-[#0c0a12] p-4 pt-10 overflow-hidden relative">
                <div className="flex justify-between items-center mb-12 px-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white dark:bg-white/10 shadow-md flex items-center justify-center text-violet-600 font-black">{roomData?.game_state.matches}</div>
                        <p className="text-[10px] font-black text-violet-900/40 dark:text-white/40 uppercase">نقاط التطابق</p>
                    </div>
                    <p className="text-xs font-black text-violet-950 dark:text-white">سؤال { (roomData?.game_state.question_index || 0) + 1 } / {DILEMMAS.length}</p>
                </div>

                <div className="flex-1 flex flex-col items-center justify-start gap-12">
                    <div className="text-center space-y-4 px-6">
                        <p className="inline-block bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">الموقف</p>
                        <h3 className="text-3xl font-black text-violet-950 dark:text-white leading-tight">أيهما يختار؟ 🤔</h3>
                        <p className="text-sm font-bold text-violet-600/70 dark:text-violet-300/70">
                            {isTurn ? `شريكك يحاول تخمين ما ستختاره!` : `خمّن ما سيختاره ${partnerInfo?.name}!`}
                        </p>
                    </div>

                    <div className="w-full flex flex-col gap-4 px-4 overflow-y-auto pb-48">
                        {['a', 'b'].map((optKey) => {
                            const optVal = currentDilemma[optKey as 'a' | 'b'];
                            const isPicked = myPick === optKey;
                            const isPartnerPicked = partnerPick === optKey;
                            const showResult = phase === 'revealed';

                            return (
                                <motion.button
                                    key={optKey}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => !myPick && phase === 'picking' && handlePick(optKey)}
                                    disabled={!!myPick || phase !== 'picking'}
                                    className={`relative p-8 rounded-[2rem] border-4 transition-all duration-500 flex flex-col items-center text-center gap-2 ${
                                        showResult
                                        ? (isPicked && isPartnerPicked ? 'bg-emerald-500 border-emerald-600 text-white shadow-emerald-200' : isPicked || isPartnerPicked ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-100 text-rose-900 dark:text-rose-100' : 'bg-white dark:bg-white/5 border-white opacity-40')
                                        : (isPicked ? 'bg-violet-600 border-violet-700 text-white shadow-violet-200' : 'bg-white dark:bg-white/5 border-white dark:border-white/10 hover:border-violet-100 shadow-xl')
                                    }`}
                                >
                                    <span className="text-lg font-black">{optVal}</span>
                                    {showResult && isPicked && isPartnerPicked && <Sparkles className="absolute top-4 end-4 w-5 h-5" />}
                                    {showResult && isPicked && !isPartnerPicked && <span className="text-[10px] font-black opacity-50">خيارك</span>}
                                    {showResult && !isPicked && isPartnerPicked && <span className="text-[10px] font-black opacity-50">خيار الشريك</span>}
                                </motion.button>
                            );
                        })}
                    </div>
                </div>

                {phase === 'revealed' && isHost && (
                    <div className="fixed bottom-10 start-6 end-6">
                        <Button onClick={nextQuestion} className="w-full h-20 rounded-[2rem] bg-violet-900 text-white font-black text-xl shadow-2xl">الموقف التالي ⬅️</Button>
                    </div>
                )}
            </div>
        );
    }

    if (uiState === 'finished') {
        return (
            <div dir="rtl" className="flex flex-col h-full bg-[#fdf2f2] dark:bg-[#0c0a12] items-center justify-center p-6 text-center">
                <Trophy className="w-24 h-24 text-violet-600 mb-8" />
                <h2 className="text-4xl font-black mb-4 text-violet-950 dark:text-white">انتهى التحدي! 🏁</h2>
                <div className="bg-white dark:bg-white/5 p-10 rounded-[2.5rem] shadow-xl border-b-8 border-violet-500/20 w-full max-w-xs mb-10">
                    <p className="text-[11px] font-black text-violet-400 uppercase mb-4 tracking-widest">مستوى التوافق</p>
                    <p className="text-6xl font-black text-violet-600 mb-2">{Math.round((roomData?.game_state.matches || 0) / DILEMMAS.length * 100)}%</p>
                    <p className="font-bold text-violet-900/60 dark:text-white/60">خمّنت {roomData?.game_state.matches} مواقف صحيحة من {DILEMMAS.length}</p>
                </div>
                <Button onClick={onBack} className="w-full max-w-xs h-16 rounded-2xl bg-violet-900 text-white font-black">العودة للألعاب</Button>
            </div>
        );
    }
    return null;
}
