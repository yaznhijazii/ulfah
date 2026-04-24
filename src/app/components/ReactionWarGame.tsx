import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { Trophy, Users, Timer } from 'lucide-react';
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

interface HoleData {
    id: number;
    type: 'empty' | 'rabbit' | 'bomb' | 'rabbit_hit' | 'bomb_hit';
    activeUntil: number;
}

interface RoomData {
    id: string;
    room_code: string;
    host_user_id: string;
    status: string;
    game_state: {
        host_score: number;
        guest_score: number;
        round_status: 'waiting' | 'countdown' | 'action' | 'result';
        end_time: number | null;
        winner_id: string | null;
        host_ready: boolean;
        guest_ready: boolean;
        is_bot: boolean;
    };
}

export function ReactionWarGame({ onBack, userId, userName, partnershipId, initialCode }: ReactionWarGameProps) {
    const [gameState, setGameState] = useState<GameState>('menu');
    const [joinCode, setJoinCode] = useState('');
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [partnerInfo, setPartnerInfo] = useState<{ id: string, name: string } | null>(null);
    
    // Game specific
    const [timeLeft, setTimeLeft] = useState<number>(30);
    const [localScore, setLocalScore] = useState(0);
    const [holes, setHoles] = useState<HoleData[]>(Array(9).fill(null).map((_, i) => ({ id: i, type: 'empty', activeUntil: 0 })));
    
    const scoreRef = useRef(0);
    const syncIntervalRef = useRef<any>(null);
    const gameLoopRef = useRef<any>(null);

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

        return () => { supabase.removeChannel(channel); };
    }, [roomData?.id]);

    // Remote State Handling
    useEffect(() => {
        if (!roomData) return;

        if (roomData.status === 'playing' && gameState === 'lobby') {
            setGameState('playing');
        }

        const state = roomData.game_state;

        if (state.round_status === 'countdown') {
            if (countdown === null) {
                setCountdown(3);
                scoreRef.current = 0;
                setLocalScore(0);
            }
        } else {
            setCountdown(null);
        }

        if (state.round_status === 'action' && state.end_time) {
            const remaining = Math.ceil((state.end_time - Date.now()) / 1000);
            if (remaining > 0 && remaining <= 30) {
                setTimeLeft(remaining);
            } else if (remaining <= 0 && userId === roomData.host_user_id) {
                // Time's up! Host declares result
                endGame(state);
            }
        }
    }, [roomData, gameState]);

    // Local Countdown timer
    useEffect(() => {
        if (countdown !== null && countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0) {
            if (userId === roomData?.host_user_id && roomData?.game_state.round_status === 'countdown') {
                startAction();
            }
            // Reset local score when game starts
            setLocalScore(0);
            scoreRef.current = 0;
            setHoles(Array(9).fill(null).map((_, i) => ({ id: i, type: 'empty', activeUntil: 0 })));
        }
    }, [countdown]);

    // Game Loop (Moles popping)
    useEffect(() => {
        if (roomData?.game_state.round_status === 'action') {
            gameLoopRef.current = setInterval(() => {
                const now = Date.now();
                setHoles(prev => {
                    const next = [...prev];
                    // Clean up expired moles
                    next.forEach(h => { if (h.type !== 'empty' && h.activeUntil < now) h.type = 'empty'; });
                    
                    // Spawn new mole randomly
                    if (Math.random() > 0.4) { // 60% chance every 400ms to spawn something
                        const emptyHoles = next.filter(h => h.type === 'empty');
                        if (emptyHoles.length > 0) {
                            const randomHole = emptyHoles[Math.floor(Math.random() * emptyHoles.length)];
                            const isBomb = Math.random() > 0.8; // 20% chance for bomb
                            randomHole.type = isBomb ? 'bomb' : 'rabbit';
                            randomHole.activeUntil = now + (isBomb ? 1200 : 800) + Math.random() * 400;
                        }
                    }
                    return next;
                });
            }, 400);

            // Sync score interval
            syncIntervalRef.current = setInterval(() => {
                syncScore();
            }, 2000);

            // Time tick
            const timeTick = setInterval(() => {
                setTimeLeft(prev => Math.max(0, prev - 1));
            }, 1000);

            return () => {
                clearInterval(gameLoopRef.current);
                clearInterval(syncIntervalRef.current);
                clearInterval(timeTick);
            };
        }
    }, [roomData?.game_state.round_status]);

    // Bot Logic
    useEffect(() => {
        if (roomData?.game_state.round_status === 'action' && roomData.game_state.is_bot && userId === roomData.host_user_id) {
            const botTick = setInterval(() => {
                // Bot randomly gets points
                if (Math.random() > 0.3) {
                    const points = Math.random() > 0.9 ? -10 : 10;
                    updateBotScore(points);
                }
            }, 1000);
            return () => clearInterval(botTick);
        }
    }, [roomData?.game_state.round_status]);

    const updateBotScore = async (points: number) => {
        if (!roomData) return;
        const { data: currentRoom } = await supabase.from('game_rooms').select('game_state').eq('id', roomData.id).single();
        if (currentRoom && currentRoom.game_state.round_status === 'action') {
            const newState = {
                ...currentRoom.game_state,
                guest_score: Math.max(0, currentRoom.game_state.guest_score + points)
            };
            await supabase.from('game_rooms').update({ game_state: newState }).eq('id', roomData.id);
        }
    };

    const syncScore = async () => {
        if (!roomData) return;
        const isHost = userId === roomData.host_user_id;
        const { data: currentRoom } = await supabase.from('game_rooms').select('game_state').eq('id', roomData.id).single();
        
        if (currentRoom && currentRoom.game_state.round_status === 'action') {
            const newState = { ...currentRoom.game_state };
            if (isHost) newState.host_score = scoreRef.current;
            else newState.guest_score = scoreRef.current;
            
            await supabase.from('game_rooms').update({ game_state: newState }).eq('id', roomData.id);
        }
    };

    const startAction = async () => {
        if (!roomData) return;
        const endTime = Date.now() + 30000; // 30 seconds
        const newState = { ...roomData.game_state, round_status: 'action', end_time: endTime };
        await supabase.from('game_rooms').update({ game_state: newState }).eq('id', roomData.id);
    };

    const endGame = async (state: any) => {
        // Final sync of scores
        let finalHostScore = state.host_score;
        let finalGuestScore = state.guest_score;
        if (userId === roomData?.host_user_id) finalHostScore = scoreRef.current;
        else finalGuestScore = scoreRef.current;

        const winner = finalHostScore > finalGuestScore ? roomData?.host_user_id : (finalGuestScore > finalHostScore ? 'guest' : null); // 'guest' is placeholder for guest_user_id or bot
        
        const newState = {
            ...state,
            round_status: 'result',
            host_score: finalHostScore,
            guest_score: finalGuestScore,
            winner_id: winner,
            host_ready: false,
            guest_ready: false
        };
        await supabase.from('game_rooms').update({ game_state: newState }).eq('id', roomData?.id);
    };

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

    const createRoom = async () => {
        setLoading(true);
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const initialGameState = {
            host_score: 0, guest_score: 0, round_status: 'waiting', end_time: null, winner_id: null, host_ready: false, guest_ready: false, is_bot: false
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
                user_id: partnerInfo.id, title: 'صياد الأرانب! 🐰', body: `${userName} يتحداك!`, type: 'game_invite', metadata: { room_code: code, game_type: 'reaction-war' }
            });
        }
    };

    const startBotMode = async () => {
        setLoading(true);
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const initialGameState = {
            host_score: 0, guest_score: 0, round_status: 'waiting', end_time: null, winner_id: null, host_ready: false, guest_ready: false, is_bot: true
        };
        const { data, error } = await supabase.from('game_rooms').insert({
            room_code: code, game_type: 'reaction-war', host_user_id: userId, status: 'playing', game_state: initialGameState
        }).select().single();

        if (error) { toast.error('خطأ في إنشاء الغرفة'); setLoading(false); return; }
        setRoomData({ ...data, game_state: initialGameState });
        setGameState('playing');
        setLoading(false);
    };

    const joinRoom = async (codeOverride?: string) => {
        const codeToUse = codeOverride || joinCode;
        if (!codeToUse) return;
        setLoading(true);
        const { data: room, error } = await supabase.from('game_rooms')
            .select('*').eq('room_code', codeToUse.toUpperCase()).eq('game_type', 'reaction-war').eq('status', 'waiting').single();
        
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
        if (initialCode && !roomData) joinRoom(initialCode);
    }, [initialCode]);

    const toggleReady = async () => {
        if (!roomData) return;
        const isBot = roomData.game_state?.is_bot === true;
        const isHost = userId === roomData.host_user_id;
        const newState = {
            ...roomData.game_state,
            [isHost ? 'host_ready' : 'guest_ready']: !roomData.game_state[isHost ? 'host_ready' : 'guest_ready'],
            winner_id: null,
            round_status: 'waiting',
            host_score: 0,
            guest_score: 0
        };

        if (isBot && isHost && newState.host_ready) newState.guest_ready = true;
        if (newState.host_ready && newState.guest_ready) newState.round_status = 'countdown';

        await supabase.from('game_rooms').update({ game_state: newState }).eq('id', roomData.id);
    };

    const handleWhack = (index: number) => {
        if (roomData?.game_state.round_status !== 'action') return;
        
        setHoles(prev => {
            const next = [...prev];
            const hole = next[index];
            if (hole.type === 'rabbit') {
                scoreRef.current += 10;
                hole.type = 'rabbit_hit';
                hole.activeUntil = Date.now() + 400;
                // Small vibration if supported
                if (navigator.vibrate) navigator.vibrate(50);
            } else if (hole.type === 'bomb') {
                scoreRef.current = Math.max(0, scoreRef.current - 10);
                hole.type = 'bomb_hit';
                hole.activeUntil = Date.now() + 400;
                if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            }
            setLocalScore(scoreRef.current);
            return next;
        });
    };

    // --- Renderers ---

    if (gameState === 'menu') {
        return (
            <div className="flex flex-col h-full bg-slate-950 p-6">
                <div className="flex-1 flex flex-col justify-center gap-6 pb-20">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-amber-500/10 rounded-[2.5rem] p-8 text-center border-2 border-amber-500/20">
                        <div className="w-24 h-24 bg-amber-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-amber-500/30">
                            <span className="text-5xl">🐰</span>
                        </div>
                        <h2 className="text-3xl font-black mb-3 text-white">صياد الأرانب!</h2>
                        <p className="text-white/60 font-bold text-sm mb-8">اضرب الأرانب، ابعد عن القنابل.. ولمّ أكثر نقاط بـ 30 ثانية!</p>
                        <div className="flex flex-col gap-3">
                            <Button onClick={createRoom} disabled={loading} className="w-full h-16 rounded-2xl text-xl font-black bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20 text-white">
                                {loading ? 'تعليق..' : '🏁 لعب مع الشريك'}
                            </Button>
                            <Button onClick={startBotMode} disabled={loading} className="w-full h-16 rounded-2xl text-xl font-black bg-zinc-800 hover:bg-zinc-700 text-white/90 border border-white/10">
                                🤖 لعب ضد لوفي
                            </Button>
                        </div>
                    </motion.div>
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-950 px-4 text-white/40 font-black tracking-widest">أو انضم للتحدي</span></div>
                    </div>
                    <div className="space-y-4">
                        <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="كود الغرفة.." className="w-full h-16 rounded-2xl bg-white/5 border-2 border-white/10 px-6 text-center text-2xl font-black outline-none focus:border-amber-500 text-white placeholder:text-white/20 tracking-widest" />
                        <Button onClick={() => joinRoom()} disabled={!joinCode || loading} className="w-full h-16 rounded-2xl text-xl font-black bg-white/10 hover:bg-white/20 text-white">انضمام</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (gameState === 'lobby') {
        return (
            <div className="flex flex-col h-full bg-slate-950 p-6 pt-12 items-center text-center">
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-6 w-full max-w-xs">
                    <div className="w-24 h-24 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
                        <Users className="w-12 h-12" />
                    </div>
                    <h2 className="text-2xl font-black text-white">بانتظار النشمي الآخر.. ⏳</h2>
                    <div className="bg-white/5 w-full rounded-[2.5rem] p-10 border-2 border-dashed border-amber-500/40 relative shadow-sm">
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">شارك الكود مع شريكك</p>
                        <p className="text-4xl font-black text-white tracking-widest">{roomData?.room_code}</p>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (gameState === 'playing') {
        const state = roomData?.game_state;
        const isHost = userId === roomData?.host_user_id;
        const myScore = state?.round_status === 'result' ? (isHost ? (state?.host_score ?? 0) : (state?.guest_score ?? 0)) : localScore;
        const partnerScore = isHost ? (state?.guest_score ?? 0) : (state?.host_score ?? 0);
        const myReady = isHost ? state?.host_ready : state?.guest_ready;
        const partnerReady = isHost ? state?.guest_ready : state?.host_ready;
        const someoneWon = state?.round_status === 'result';
        const iWon = isHost ? state?.winner_id === roomData?.host_user_id : state?.winner_id !== roomData?.host_user_id && state?.winner_id !== null;

        return (
            <div className="flex flex-col h-full bg-slate-950 p-4 relative overflow-hidden select-none">
                {/* Scoreboard */}
                <div className="flex justify-between items-center mb-8 px-2 z-10">
                    <div className="flex items-center gap-3 bg-amber-500/10 p-3 px-5 rounded-2xl border border-amber-500/20">
                        <div className="flex flex-col items-start leading-none">
                            <span className="text-[9px] font-black uppercase text-amber-500 mb-1">أنت</span>
                            <span className="text-3xl font-black text-white">{myScore}</span>
                        </div>
                    </div>
                    
                    {state?.round_status === 'action' && (
                        <div className="w-16 h-16 rounded-full bg-zinc-900 border-2 border-white/10 flex items-center justify-center flex-col shadow-2xl">
                            <span className="text-[9px] text-white/50 font-black uppercase">الوقت</span>
                            <span className={`text-xl font-black ${timeLeft <= 5 ? 'text-rose-500 animate-pulse' : 'text-white'}`}>{timeLeft}</span>
                        </div>
                    )}

                    <div className="flex items-center gap-3 bg-indigo-500/10 p-3 px-5 rounded-2xl border border-indigo-500/20">
                        <div className="flex flex-col items-end leading-none">
                            <span className="text-[9px] font-black uppercase text-indigo-400 mb-1">
                                {roomData?.game_state?.is_bot ? 'لوفي 🤖' : partnerInfo?.name || 'الشريك'}
                            </span>
                            <span className="text-3xl font-black text-white">{partnerScore}</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center gap-8 relative z-10">
                    <AnimatePresence mode="wait">
                        {state?.round_status === 'waiting' && (
                            <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center space-y-6">
                                <h3 className="text-3xl font-black text-white">التحدي القادم</h3>
                                <p className="text-white/50 text-sm font-bold">كل واحد يضغط "جاهز" عشان نبدأ الـ 30 ثانية</p>
                                <Button onClick={toggleReady} className={`w-64 h-20 rounded-3xl text-xl font-black shadow-xl transition-all ${myReady ? 'bg-white/10 text-white/50' : 'bg-amber-500 text-white'}`}>
                                    {myReady ? 'جاهز.. بانتظاره' : 'أنا جاهز! 🔥'}
                                </Button>
                            </motion.div>
                        )}

                        {countdown !== null && (
                            <motion.div key="countdown" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 2, opacity: 0 }} className="flex flex-col items-center">
                                <div className="text-[150px] font-black text-amber-500 drop-shadow-[0_0_40px_rgba(245,158,11,0.5)]">
                                    {countdown === 0 ? 'انطلق!' : countdown}
                                </div>
                            </motion.div>
                        )}

                        {state?.round_status === 'action' && countdown === null && (
                            <motion.div key="grid" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
                                <div className="grid grid-cols-3 gap-4 p-4 bg-zinc-900/50 rounded-[3rem] border border-white/5 shadow-2xl backdrop-blur-xl">
                                    {holes.map((hole, idx) => (
                                        <div key={hole.id} className="aspect-square relative flex items-end justify-center overflow-hidden rounded-full bg-black/40 border-b-4 border-black/80 shadow-inner">
                                            {/* Hole opening visual */}
                                            <div className="absolute bottom-0 w-full h-1/3 bg-black/80 rounded-full blur-[2px]" />
                                            
                                            <AnimatePresence>
                                                {hole.type === 'rabbit' && (
                                                    <motion.button
                                                        initial={{ y: '100%' }}
                                                        animate={{ y: '10%' }}
                                                        exit={{ y: '100%', transition: { duration: 0.1 } }}
                                                        whileTap={{ scale: 0.8, y: '30%' }}
                                                        onPointerDown={(e) => { e.preventDefault(); handleWhack(idx); }}
                                                        className="absolute w-[80%] h-[80%] text-5xl flex items-center justify-center drop-shadow-xl z-10 touch-none"
                                                    >
                                                        🐰
                                                    </motion.button>
                                                )}
                                                {hole.type === 'bomb' && (
                                                    <motion.button
                                                        initial={{ y: '100%' }}
                                                        animate={{ y: '10%' }}
                                                        exit={{ y: '100%', transition: { duration: 0.1 } }}
                                                        whileTap={{ scale: 0.8, y: '30%' }}
                                                        onPointerDown={(e) => { e.preventDefault(); handleWhack(idx); }}
                                                        className="absolute w-[80%] h-[80%] text-5xl flex items-center justify-center drop-shadow-xl z-10 touch-none"
                                                    >
                                                        💣
                                                    </motion.button>
                                                )}
                                                {hole.type === 'rabbit_hit' && (
                                                    <motion.div
                                                        initial={{ scale: 0.5, opacity: 1, y: '30%' }}
                                                        animate={{ scale: 1.5, opacity: 0, y: '0%' }}
                                                        transition={{ duration: 0.3 }}
                                                        className="absolute w-full h-full flex flex-col items-center justify-center text-amber-300 font-black text-2xl z-20 pointer-events-none drop-shadow-xl"
                                                    >
                                                        +10
                                                        <span className="text-4xl">✨</span>
                                                    </motion.div>
                                                )}
                                                {hole.type === 'bomb_hit' && (
                                                    <motion.div
                                                        initial={{ scale: 0.5, opacity: 1, y: '30%' }}
                                                        animate={{ scale: 2, opacity: 0, y: '0%' }}
                                                        transition={{ duration: 0.3 }}
                                                        className="absolute w-full h-full flex flex-col items-center justify-center text-rose-500 font-black text-3xl z-20 pointer-events-none drop-shadow-2xl"
                                                    >
                                                        💥
                                                        <span className="text-xl text-rose-300">-10</span>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {someoneWon && (
                            <motion.div key="result" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-6 w-full max-w-xs mx-auto bg-zinc-900/80 p-8 rounded-[3rem] border border-white/10 backdrop-blur-md">
                                <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-4 ${iWon ? 'bg-amber-500 shadow-amber-500/30' : 'bg-slate-700 shadow-slate-900/50'} shadow-xl rotate-6`}>
                                    {iWon ? <Trophy className="w-12 h-12 text-white" /> : <Timer className="w-12 h-12 text-white/50" />}
                                </div>
                                <h1 className="text-4xl font-black text-white">
                                    {myScore === partnerScore ? 'تعادل! 🤝' : (iWon ? 'مبروك الفوز! 🏆' : 'هاردلك! 🐢')}
                                </h1>
                                <p className="text-white/60 font-bold">
                                    {myScore === partnerScore 
                                        ? 'النتيجة متعادلة!' 
                                        : (iWon ? `سحقت ${roomData?.game_state?.is_bot ? 'لوفي' : partnerInfo?.name} بفارق ${myScore - partnerScore} نقاط!` 
                                               : `${roomData?.game_state?.is_bot ? 'لوفي' : partnerInfo?.name} كان أسرع وأدق منك!`)}
                                </p>
                                <div className="pt-6 flex flex-col gap-3">
                                    <Button onClick={toggleReady} className="w-full h-16 rounded-2xl text-lg font-black bg-amber-500 hover:bg-amber-600 text-white">
                                        إعادة التحدي؟ 🔥
                                    </Button>
                                    <Button onClick={onBack} variant="ghost" className="text-white/40 hover:text-white uppercase tracking-widest font-black text-[11px]">
                                        عودة للرئيسية
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
