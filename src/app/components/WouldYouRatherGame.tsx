import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Split, Heart, CheckCircle2, Trophy, HelpCircle, GitPullRequest, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface WouldYouRatherGameProps {
    onBack: () => void;
    userId: string;
    userName: string;
    partnershipId: string | null;
}

type GameState = 'menu' | 'lobby' | 'playing' | 'revealed' | 'finished';

interface RoomData {
    id: string;
    room_code: string;
    host_user_id: string;
    status: string;
    game_state: {
        question_index: number;
        host_pick: string | null;
        guest_pick: string | null;
        matches: number;
        turn: string | null; // Who is being guessed
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

export function WouldYouRatherGame({ onBack, userId, userName, partnershipId }: WouldYouRatherGameProps) {
    const [gameState, setGameState] = useState<GameState>('menu');
    const [joinCode, setJoinCode] = useState('');
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(false);
    const [presence, setPresence] = useState<any>({});
    const [partnerInfo, setPartnerInfo] = useState<{ id: string, name: string } | null>(null);

    useEffect(() => {
        if (!roomData?.id) return;
        const channel = supabase.channel(`game_wyr_${roomData.id}`, { config: { presence: { key: userId } } })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomData.id}` }, (payload) => {
                const newData = payload.new as any;
                const state = typeof newData.game_state === 'string' ? JSON.parse(newData.game_state) : newData.game_state;
                setRoomData(prev => ({ ...prev!, ...newData, game_state: state }));
            })
            .on('presence', { event: 'sync' }, () => setPresence(channel.presenceState()))
            .subscribe(async (status) => { if (status === 'SUBSCRIBED') await channel.track({ user_id: userId, name: userName }); });
        return () => { supabase.removeChannel(channel); };
    }, [roomData?.id, userId, userName]);

    useEffect(() => {
        if (roomData?.id) {
            let status = roomData.status as GameState;
            if (status === 'waiting') status = 'lobby';
            if (status !== gameState) setGameState(status);
        }
    }, [roomData?.status, gameState]);

    useEffect(() => {
        if (!partnershipId) return;
        supabase.from('partnerships').select('user1_id, user2_id, user1:user1_id(name), user2:user2_id(name)')
            .eq('id', partnershipId).single().then(({ data }) => {
                if (data) {
                    const isUser1 = data.user1_id === userId;
                    setPartnerInfo({ id: isUser1 ? data.user2_id : data.user1_id, name: isUser1 ? (data.user2 as any)?.name : (data.user1 as any)?.name || 'الشريك' });
                }
            });
    }, [partnershipId, userId]);

    const createRoom = async () => {
        setLoading(true);
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const state = { question_index: 0, host_pick: null, guest_pick: null, matches: 0, turn: userId };
        const { data, error } = await supabase.from('game_rooms').insert({ room_code: code, game_type: 'would-you-rather', host_user_id: userId, status: 'waiting', game_state: state }).select().single();
        if (error) { setLoading(false); return; }
        setRoomData({ ...data, game_state: state });
        setGameState('lobby');
        setLoading(false);
        if (partnerInfo) await supabase.from('notifications').insert({ user_id: partnerInfo.id, title: 'لو كنت مكاني! 🤔', body: `${userName} ينتظرك لاختبار مدى معرفتك به!`, type: 'game_invite', metadata: { room_code: code, game_type: 'would-you-rather' } });
    };

    const joinRoom = async () => {
        if (!joinCode) return;
        setLoading(true);
        const { data: room, error } = await supabase.from('game_rooms').select('*').eq('room_code', joinCode.toUpperCase()).eq('game_type', 'would-you-rather').eq('status', 'waiting').single();
        if (error || !room) { toast.error('الغرفة غير موجودة'); setLoading(false); return; }
        const { data: updated } = await supabase.from('game_rooms').update({ guest_user_id: userId, status: 'playing' }).eq('id', room.id).select().single();
        if (updated) setRoomData({ ...updated, game_state: typeof updated.game_state === 'string' ? JSON.parse(updated.game_state) : updated.game_state });
        setGameState('playing');
        setLoading(false);
    };

    const handlePick = async (option: string) => {
        if (!roomData) return;
        const isHost = userId === roomData.host_user_id;
        const newState = { ...roomData.game_state, [isHost ? 'host_pick' : 'guest_pick']: option };

        // Check if both picked
        if (newState.host_pick && newState.guest_pick) {
          const isMatch = newState.host_pick === newState.guest_pick;
          if (isMatch) newState.matches += 1;
          await supabase.from('game_rooms').update({ game_state: newState, status: 'revealed' }).eq('id', roomData.id);
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
          setGameState('finished');
          return;
        }

        const newState = { 
          ...roomData.game_state, 
          question_index: nextIdx, 
          host_pick: null, 
          guest_pick: null,
          turn: roomData.game_state.turn === roomData.host_user_id ? roomData.guest_user_id : roomData.host_user_id
        };
        await supabase.from('game_rooms').update({ game_state: newState, status: 'playing' }).eq('id', roomData.id);
    };

    // --- RENDERERS ---

    if (gameState === 'menu') {
        return (
            <div className="flex flex-col h-full bg-[#fdf2f2] p-6">
                <div className="flex-1 flex flex-col justify-center gap-6 pb-20">
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white rounded-[2.5rem] p-10 text-center shadow-xl border-b-8 border-blue-500/20">
                        <div className="w-20 h-20 bg-blue-500 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3">
                            <Split className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-black mb-3 text-blue-900">لو كنت مكاني.. 🤔</h2>
                        <p className="text-blue-600/60 font-bold text-sm mb-10 leading-relaxed">كم تعرف شريكك؟ حاول تخمين الخيار الذي سيفضله في مواقف صعبة!</p>
                        <Button onClick={createRoom} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black bg-blue-600 hover:bg-blue-700 text-white shadow-xl">
                            {loading ? 'ثوانِ..' : '🚀 بدء التحدي'}
                        </Button>
                    </motion.div>
                    <div className="space-y-4">
                        <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="كود التحدي.." className="w-full h-16 rounded-2xl bg-white/50 border-2 border-blue-100 px-6 text-center text-xl font-black outline-none focus:border-blue-400" />
                        <Button onClick={joinRoom} disabled={!joinCode || loading} variant="secondary" className="w-full h-16 rounded-2xl text-lg font-black text-blue-700">دخول</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (gameState === 'lobby') {
        const isPartnerInRoom = partnerInfo && presence[partnerInfo.id];
        return (
            <div className="flex flex-col h-full bg-[#fdf2f2] p-6 pt-12 items-center text-center">
                <h2 className="text-3xl font-black mb-10 text-blue-900">بانتظار المنافس..</h2>
                <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-10 shadow-2xl border-4 border-dashed border-blue-200 relative mb-12">
                    <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-2">كود الغرفة</p>
                    <p className="text-5xl font-black text-blue-600">{roomData?.room_code}</p>
                </div>
                <div className={`p-6 rounded-3xl border w-full max-w-xs transition-all ${isPartnerInRoom ? 'bg-blue-50 border-blue-200' : 'bg-white/50 border-stone-200 opacity-60'}`}>
                    <p className="font-black text-blue-900">{partnerInfo?.name || 'الشريك'}</p>
                    <span className={`text-[10px] font-black ${isPartnerInRoom ? 'text-emerald-500' : 'text-stone-400'}`}>
                        {isPartnerInRoom ? 'دخل التحدي ⚡' : 'بانتظار دخوله..'}
                    </span>
                </div>
            </div>
        );
    }

    if (gameState === 'playing' || gameState === 'revealed') {
        const isHost = userId === roomData?.host_user_id;
        const myPick = isHost ? roomData?.game_state.host_pick : roomData?.game_state.guest_pick;
        const partnerPick = isHost ? roomData?.game_state.guest_pick : roomData?.game_state.host_pick;
        const currentDilemma = DILEMMAS[roomData?.game_state.question_index || 0];
        const isTurn = roomData?.game_state.turn === userId; // Who is being guessed

        return (
            <div className="flex flex-col h-full bg-[#fdf2f2] p-4 pt-10 overflow-hidden relative">
                <div className="flex justify-between items-center mb-12 px-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white shadow-md flex items-center justify-center text-blue-600 font-black">{roomData?.game_state.matches}</div>
                        <p className="text-[10px] font-black text-blue-900/40 uppercase">نقاط التطابق</p>
                    </div>
                    <p className="text-xs font-black text-blue-900">سؤال { (roomData?.game_state.question_index || 0) + 1 } / {DILEMMAS.length}</p>
                </div>

                <div className="flex-1 flex flex-col items-center justify-start gap-12">
                    <div className="text-center space-y-4 px-6">
                        <p className="inline-block bg-blue-100 text-blue-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">الموقف</p>
                        <h3 className="text-3xl font-black text-blue-900 leading-tight">أيهما تختار؟ 🤔</h3>
                        <p className="text-sm font-bold text-blue-600/60">
                            {isTurn ? `شريكك يحاول تخمين ما ستختاره!` : `حاول تخمين ما سيختاره ${partnerInfo?.name}!`}
                        </p>
                    </div>

                    <div className="w-full flex flex-col gap-4 px-4 overflow-y-auto pb-48">
                        {['a', 'b'].map((optKey) => {
                            const optVal = currentDilemma[optKey as 'a' | 'b'];
                            const isPicked = myPick === optKey;
                            const isPartnerPicked = partnerPick === optKey;
                            const showResult = gameState === 'revealed';

                            return (
                                <motion.button
                                    key={optKey}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => !myPick && handlePick(optKey)}
                                    disabled={!!myPick}
                                    className={`relative p-8 rounded-[2rem] border-4 transition-all duration-500 flex flex-col items-center text-center gap-2 ${
                                        showResult 
                                        ? (isPicked && isPartnerPicked ? 'bg-emerald-500 border-emerald-600 text-white shadow-emerald-200' : isPicked || isPartnerPicked ? 'bg-rose-50 border-rose-100 text-rose-900' : 'bg-white border-white opacity-40')
                                        : (isPicked ? 'bg-blue-600 border-blue-700 text-white shadow-blue-200' : 'bg-white border-white hover:border-blue-100 shadow-xl')
                                    }`}
                                >
                                    <span className="text-lg font-black">{optVal}</span>
                                    {showResult && isPicked && isPartnerPicked && <Sparkles className="absolute top-4 right-4 w-5 h-5" />}
                                    {showResult && isPicked && !isPartnerPicked && <span className="text-[10px] font-black opacity-50">خيارك</span>}
                                    {showResult && !isPicked && isPartnerPicked && <span className="text-[10px] font-black opacity-50">خيار الشريك</span>}
                                </motion.button>
                            );
                        })}
                    </div>
                </div>

                {gameState === 'revealed' && isHost && (
                    <div className="fixed bottom-10 left-6 right-6">
                        <Button onClick={nextQuestion} className="w-full h-20 rounded-[2rem] bg-blue-900 text-white font-black text-xl shadow-2xl">الموقف التالي ➡️</Button>
                    </div>
                )}
            </div>
        );
    }

    if (gameState === 'finished') {
        return (
            <div className="flex flex-col h-full bg-[#fdf2f2] items-center justify-center p-6 text-center">
                <Trophy className="w-24 h-24 text-blue-600 mb-8" />
                <h2 className="text-4xl font-black mb-4 text-blue-900">انتهى التحدي! 🏁</h2>
                <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border-b-8 border-blue-500/20 w-full max-w-xs mb-10">
                    <p className="text-[11px] font-black text-blue-300 uppercase mb-4 tracking-widest">مستوى التوافق</p>
                    <p className="text-6xl font-black text-blue-600 mb-2">{Math.round((roomData?.game_state.matches || 0) / DILEMMAS.length * 100)}%</p>
                    <p className="font-bold text-blue-900/60">حزرت {roomData?.game_state.matches} مواقف صحيحة من {DILEMMAS.length}</p>
                </div>
                <Button onClick={onBack} className="w-full max-w-xs h-16 rounded-2xl bg-blue-900 text-white font-black">العودة للألعاب</Button>
            </div>
        );
    }
    return null;
}
