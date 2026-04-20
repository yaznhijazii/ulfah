import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Zap, Trophy, Users, Play, Timer, Swords, Rocket } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface ReactionWarGameProps {
    onBack: () => void;
    userId: string;
    userName: string;
    partnershipId: string | null;
    initialCode?: string;
}

type GameState = 'menu' | 'lobby' | 'playing' | 'result';

interface RoomData {
    id: string;
    room_code: string;
    host_user_id: string;
    guest_user_id: string | null;
    status: string;
    game_state: {
        host_score: number;
        guest_score: number;
        round_status: 'waiting' | 'countdown' | 'action' | 'result';
        target_time: number | null;
        winner_id: string | null;
        round_number: number;
        host_ready: boolean;
        guest_ready: boolean;
    };
}

export function ReactionWarGame({ onBack, userId, userName, partnershipId, initialCode }: ReactionWarGameProps) {
    const [gameState, setGameState] = useState<GameState>('menu');
    const [joinCode, setJoinCode] = useState('');
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [partnerInfo, setPartnerInfo] = useState<{ id: string, name: string } | null>(null);
    const [reactionTime, setReactionTime] = useState<number | null>(null);
    const [isButtonVisible, setIsButtonVisible] = useState(false);
    
    const clickStartTime = useRef<number | null>(null);

    // Realtime Subscription
    useEffect(() => {
        if (!roomData?.id) return;

        const channel = supabase
            .channel(`reaction_war_${roomData.id}`)
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomData.id}` },
                (payload) => {
                    const newData = payload.new as any;
                    const parsedState = typeof newData.game_state === 'string' ? JSON.parse(newData.game_state) : newData.game_state;
                    
                    setRoomData(prev => ({
                        ...prev!,
                        ...newData,
                        game_state: parsedState
                    }));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomData?.id]);

    // Game Logic based on remote room state
    useEffect(() => {
        if (!roomData) return;

        // Transition from lobby to playing
        if (roomData.status === 'playing' && gameState === 'lobby') {
            setGameState('playing');
        }

        const state = roomData.game_state;

        // Countdown handling
        if (state.round_status === 'countdown') {
            if (countdown === null) setCountdown(3);
            setIsButtonVisible(false);
            setReactionTime(null);
        } else {
            setCountdown(null);
        }

        // Action trigger handling
        if (state.round_status === 'action' && state.target_time) {
            const now = Date.now();
            const delay = state.target_time - now;
            
            if (delay <= 0) {
                setIsButtonVisible(true);
                clickStartTime.current = Date.now();
            } else {
                const timer = setTimeout(() => {
                    setIsButtonVisible(true);
                    clickStartTime.current = Date.now();
                }, delay);
                return () => clearTimeout(timer);
            }
        } else {
            setIsButtonVisible(false);
        }

        if (state.round_status === 'result') {
            setIsButtonVisible(false);
        }

    }, [roomData, gameState]);

    // Local Countdown timer
    useEffect(() => {
        if (countdown !== null && countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0) {
            // If I am host, transition to action after a random delay
            if (userId === roomData?.host_user_id && roomData?.game_state.round_status === 'countdown') {
                startActionDelay();
            }
        }
    }, [countdown]);

    // Partner Info loading
    useEffect(() => {
        if (!partnershipId) return;
        supabase.from('partnerships').select('user1_id, user2_id, user1:user1_id(name), user2:user2_id(name)')
            .eq('id', partnershipId).single().then(({ data }) => {
                if (data) {
                    const isUser1 = data.user1_id === userId;
                    const pId = isUser1 ? data.user2_id : data.user1_id;
                    const pName = isUser1 ? (data.user2 as any)?.name : (data.user1 as any)?.name;
                    setPartnerInfo({ id: pId, name: pName || 'الشريك' });
                }
            });
    }, [partnershipId, userId]);

    // Game Actions
    const createRoom = async () => {
        setLoading(true);
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const initialGameState = {
            host_score: 0,
            guest_score: 0,
            round_status: 'waiting',
            target_time: null,
            winner_id: null,
            round_number: 1,
            host_ready: false,
            guest_ready: false
        };
        const { data, error } = await supabase.from('game_rooms').insert({
            room_code: code, game_type: 'reaction-war', host_user_id: userId, status: 'waiting', game_state: initialGameState
        }).select().single();

        if (error) { toast.error('خطأ في إنشاء الغرفة'); setLoading(false); return; }
        setRoomData({ ...data, game_state: initialGameState });
        setGameState('lobby');
        setLoading(false);
        
        if (partnerInfo) {
            await supabase.from('notifications').insert({
                user_id: partnerInfo.id, title: 'حرب السرعة! ⚡️', body: `${userName} يتحداك في سباق أصابع!`, type: 'game_invite', metadata: { room_code: code, game_type: 'reaction-war' }
            });
        }
    };

    const joinRoom = async (codeOverride?: string) => {
        const codeToUse = codeOverride || joinCode;
        if (!codeToUse) return;
        setLoading(true);
        const { data: room, error } = await supabase.from('game_rooms')
            .select('*')
            .eq('room_code', codeToUse.toUpperCase())
            .eq('game_type', 'reaction-war')
            .eq('status', 'waiting')
            .single();
        if (error || !room) { toast.error('الغرفة غير موجودة أو بدأت'); setLoading(false); return; }
        
        const { data: updated } = await supabase.from('game_rooms').update({ guest_user_id: userId, status: 'playing' }).eq('id', room.id).select().single();
        if (updated) {
            const state = typeof updated.game_state === 'string' ? JSON.parse(updated.game_state) : updated.game_state;
            setRoomData({ ...updated, game_state: state });
            setGameState('playing');
        }
        setLoading(false);
    };

    useEffect(() => {
        if (initialCode && !roomData) {
            joinRoom(initialCode);
        }
    }, [initialCode]);

    const toggleReady = async () => {
        if (!roomData) return;
        const isHost = userId === roomData.host_user_id;
        const newState = {
            ...roomData.game_state,
            [isHost ? 'host_ready' : 'guest_ready']: !roomData.game_state[isHost ? 'host_ready' : 'guest_ready'],
            winner_id: null,
            round_status: 'waiting'
        };

        if (newState.host_ready && newState.guest_ready) {
            newState.round_status = 'countdown';
        }

        await supabase.from('game_rooms').update({ game_state: newState }).eq('id', roomData.id);
    };

    const startActionDelay = async () => {
        if (!roomData || userId !== roomData.host_user_id) return;
        const delay = Math.floor(Math.random() * 4000) + 2000; // 2-6 seconds
        const targetTime = Date.now() + delay;
        
        const newState = {
            ...roomData.game_state,
            round_status: 'action',
            target_time: targetTime
        };
        await supabase.from('game_rooms').update({ game_state: newState }).eq('id', roomData.id);
    };

    const handleReaction = async () => {
        if (!roomData || roomData.game_state.round_status !== 'action' || !isButtonVisible || roomData.game_state.winner_id) return;
        
        const time = Date.now() - (clickStartTime.current || 0);
        setReactionTime(time);

        const isHost = userId === roomData.host_user_id;
        const newState = {
            ...roomData.game_state,
            round_status: 'result',
            winner_id: userId,
            host_score: isHost ? roomData.game_state.host_score + 1 : roomData.game_state.host_score,
            guest_score: !isHost ? roomData.game_state.guest_score + 1 : roomData.game_state.guest_score,
            host_ready: false,
            guest_ready: false,
            round_number: roomData.game_state.round_number + 1
        };

        await supabase.from('game_rooms').update({ game_state: newState }).eq('id', roomData.id);
    };

    // --- Renderers ---

    if (gameState === 'menu') {
        return (
            <div className="flex flex-col h-full bg-background p-6">
                <div className="flex-1 flex flex-col justify-center gap-6 pb-20">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-indigo-500/10 rounded-[2.5rem] p-8 text-center border-2 border-indigo-500/20">
                        <div className="w-20 h-20 bg-indigo-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/30 rotate-12">
                            <Zap className="w-10 h-10 fill-white" />
                        </div>
                        <h2 className="text-2xl font-black mb-2">حرب السرعة! ⚡️</h2>
                        <p className="text-muted-foreground font-bold text-sm mb-8">تحدي أسرع أصابع في "ألفة".. هل أنت جاهز؟</p>
                        <Button onClick={createRoom} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20">
                            {loading ? 'تعليق..' : '🏁 إنشاء تحدٍ جديد'}
                        </Button>
                    </motion.div>
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground font-black">أو انضم للتحدي</span></div>
                    </div>
                    <div className="space-y-4">
                        <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="كود الغرفة.." className="w-full h-16 rounded-2xl bg-muted/50 border-2 border-border px-6 text-center text-xl font-black outline-none focus:border-indigo-500" />
                        <Button onClick={() => joinRoom()} disabled={!joinCode || loading} variant="secondary" className="w-full h-16 rounded-2xl text-lg font-black">انضمام</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (gameState === 'lobby') {
        return (
            <div className="flex flex-col h-full bg-background p-6 pt-12 items-center text-center">
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-6 w-full max-w-xs">
                    <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="w-12 h-12" />
                    </div>
                    <h2 className="text-2xl font-black">بانتظار النشمي الآخر.. ⏳</h2>
                    <div className="bg-white dark:bg-white/5 w-full rounded-[2.5rem] p-10 border-2 border-dashed border-indigo-500/30 relative shadow-sm">
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">شارك الكود مع شريكك</p>
                        <p className="text-4xl font-black text-foreground tracking-widest">{roomData?.room_code}</p>
                    </div>
                    <p className="text-muted-foreground/50 text-xs font-bold px-4">أرسل الكود لنور لتبدأ المعركة!</p>
                </motion.div>
            </div>
        );
    }

    if (gameState === 'playing') {
        const state = roomData?.game_state;
        const isHost = userId === roomData?.host_user_id;
        const myScore = isHost ? state?.host_score : state?.guest_score;
        const partnerScore = isHost ? state?.guest_score : state?.host_score;
        const myReady = isHost ? state?.host_ready : state?.guest_ready;
        const partnerReady = isHost ? state?.guest_ready : state?.host_ready;
        const someoneWon = state?.winner_id !== null;
        const iWon = state?.winner_id === userId;

        return (
            <div className="flex flex-col h-full bg-background p-4 relative overflow-hidden">
                {/* Scoreboard */}
                <div className="flex justify-between items-center mb-8 px-2">
                    <div className="flex items-center gap-3 bg-white/5 p-3 px-5 rounded-2xl border border-white/5">
                        <div className="flex flex-col items-start leading-none">
                            <span className="text-[9px] font-black uppercase text-muted-foreground mb-1">أنت</span>
                            <span className="text-2xl font-black">{myScore}</span>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                        <Swords className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 p-3 px-5 rounded-2xl border border-white/5">
                        <div className="flex flex-col items-end leading-none">
                            <span className="text-[9px] font-black uppercase text-muted-foreground mb-1">{partnerInfo?.name || 'الشريك'}</span>
                            <span className="text-2xl font-black">{partnerScore}</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center gap-8 relative">
                    <AnimatePresence mode="wait">
                        {state?.round_status === 'waiting' && (
                            <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center space-y-6">
                                <h3 className="text-xl font-black">الجولة {state.round_number}</h3>
                                <p className="text-muted-foreground text-sm font-bold">كل واحد يضغط "جاهز" عشان نبدأ</p>
                                <Button onClick={toggleReady} className={`w-64 h-20 rounded-3xl text-xl font-black shadow-xl transition-all ${myReady ? 'bg-muted text-muted-foreground' : 'bg-indigo-600 text-white'}`}>
                                    {myReady ? 'جاهز.. بانتظاره' : 'أنا جاهز! 🔥'}
                                </Button>
                                <div className="flex justify-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${myReady ? 'bg-indigo-500 animate-pulse' : 'bg-muted'}`} />
                                    <div className={`w-2 h-2 rounded-full ${partnerReady ? 'bg-indigo-500 animate-pulse' : 'bg-muted'}`} />
                                </div>
                            </motion.div>
                        )}

                        {countdown !== null && (
                            <motion.div key="countdown" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 2, opacity: 0 }} className="flex flex-col items-center">
                                <div className="text-9xl font-black text-indigo-600 drop-shadow-2xl">
                                    {countdown === 0 ? 'ثبت!' : countdown}
                                </div>
                                <p className="text-muted-foreground font-black uppercase tracking-widest mt-4">استعد للضغط..</p>
                            </motion.div>
                        )}

                        {state?.round_status === 'action' && !isButtonVisible && countdown === null && (
                            <motion.div key="steady" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                                <div className="w-32 h-32 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin mb-6 mx-auto" />
                                <h2 className="text-4xl font-black">ثبـّت...</h2>
                                <p className="text-muted-foreground/40 text-xs font-black uppercase mt-4">لا تضغط لسا!</p>
                            </motion.div>
                        )}

                        {isButtonVisible && !someoneWon && (
                            <motion.button
                                key="hit-button"
                                initial={{ scale: 0, rotate: -45 }}
                                animate={{ scale: 1.2, rotate: 0 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={handleReaction}
                                className="w-72 h-72 rounded-full bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 shadow-[0_0_80px_rgba(79,70,229,0.5)] flex flex-col items-center justify-center text-white border-8 border-white/20 select-none touch-none"
                            >
                                <Rocket className="w-16 h-16 mb-4 animate-bounce" />
                                <span className="text-5xl font-black tracking-tighter">اطخخخخ!</span>
                            </motion.button>
                        )}

                        {someoneWon && (
                            <motion.div key="result" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-6">
                                <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-4 ${iWon ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-rose-500 shadow-rose-500/30'} shadow-xl rotate-6`}>
                                    {iWon ? <Trophy className="w-12 h-12 text-white" /> : <Timer className="w-12 h-12 text-white" />}
                                </div>
                                <h1 className="text-4xl font-black">
                                    {iWon ? 'وحـش! 😎' : 'ما حالفك الحظ 🐢'}
                                </h1>
                                <p className="text-muted-foreground font-bold">
                                    {iWon ? `أكّلت الجو بسرعتك!` : `${partnerInfo?.name} كان أسرع منك!`}
                                </p>
                                {reactionTime && iWon && (
                                    <div className="bg-emerald-500/10 text-emerald-600 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest inline-block">
                                        سرعة ردّ الفعل: {reactionTime}ms
                                    </div>
                                )}
                                <div className="pt-8">
                                    <Button onClick={toggleReady} className="w-64 h-16 rounded-2xl text-lg font-black bg-indigo-600 hover:bg-indigo-700">
                                        جولة ثانية؟ 🔥
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        );
    }

    return null;
}
