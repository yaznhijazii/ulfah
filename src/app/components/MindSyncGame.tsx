import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Copy, Zap, CheckCircle2, Trophy, Ghost, Users, Sparkles, RefreshCw, HandMetal } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface MindSyncGameProps {
    onBack: () => void;
    userId: string;
    userName: string;
    partnershipId: string | null;
}

type GameState = 'menu' | 'lobby' | 'playing' | 'result';

interface RoomData {
    id: string;
    room_code: string;
    host_user_id: string;
    guest_user_id: string | null;
    status: string;
    game_state: {
        category: string;
        sync_score: number;
        host_ready: boolean;
        guest_ready: boolean;
        countdown_active: boolean;
        last_sync_result: 'success' | 'fail' | null;
    };
}

const CATEGORIES = [
  "أكلة بنحبها 🍕",
  "مكان سافرنا عليه ✈️",
  "فيلم حضرناه سوى 🍿",
  "لون بتحبه هي 🎨",
  "أول مكان تقابلنا فيه 📍",
  "صفة مميزة في شريكك ✨",
  "شيء بنكرهه الاثنين 😤",
  "كلمة بنقولها كثير 🗣️",
  "أغنية بتذكرنا ببعض 🎵",
  "أحلى هدية تبادلناها 🎁"
];

export function MindSyncGame({ onBack, userId, userName, partnershipId }: MindSyncGameProps) {
    const [gameState, setGameState] = useState<GameState>('menu');
    const [joinCode, setJoinCode] = useState('');
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [presence, setPresence] = useState<any>({});
    const [partnerInfo, setPartnerInfo] = useState<{ id: string, name: string } | null>(null);

    // Realtime Subscription
    useEffect(() => {
        if (!roomData?.id) return;

        const channel = supabase
            .channel(`game_sync_${roomData.id}`, {
                config: { presence: { key: userId } }
            })
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
            .on('presence', { event: 'sync' }, () => {
                setPresence(channel.presenceState());
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ user_id: userId, name: userName });
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomData?.id, userId, userName]);

    useEffect(() => {
        if (roomData?.id) {
            if (roomData.status === 'playing' && gameState !== 'playing') setGameState('playing');
            if (roomData.status === 'waiting' && gameState !== 'lobby') setGameState('lobby');
        }
    }, [roomData?.status, gameState]);

    // Countdown Logic
    useEffect(() => {
        if (roomData?.game_state.countdown_active && countdown === null) {
            setCountdown(3);
        } else if (!roomData?.game_state.countdown_active) {
            setCountdown(null);
        }
    }, [roomData?.game_state.countdown_active]);

    useEffect(() => {
        if (countdown !== null && countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

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
            category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
            sync_score: 0,
            host_ready: false,
            guest_ready: false,
            countdown_active: false,
            last_sync_result: null
        };
        const { data, error } = await supabase.from('game_rooms').insert({
            room_code: code, game_type: 'mind-sync', host_user_id: userId, status: 'waiting', game_state: initialGameState
        }).select().single();

        if (error) { toast.error('خطأ في الإنشاء'); setLoading(false); return; }
        setRoomData({ ...data, game_state: initialGameState });
        setGameState('lobby');
        setLoading(false);
        if (partnerInfo) {
            await supabase.from('notifications').insert({
                user_id: partnerInfo.id, title: 'تزامن الأرواح! ✨', body: `${userName} ينتظرك لمزامنة الأفكار!`, type: 'game_invite', metadata: { room_code: code, game_type: 'mind-sync' }
            });
        }
    };

    const joinRoom = async () => {
        if (!joinCode) return;
        setLoading(true);
        const { data: room, error } = await supabase.from('game_rooms').select('*').eq('room_code', joinCode.toUpperCase()).eq('game_type', 'mind-sync').eq('status', 'waiting').single();
        if (error || !room) { toast.error('الغرفة غير موجودة'); setLoading(false); return; }
        const { data: updated } = await supabase.from('game_rooms').update({ guest_user_id: userId, status: 'playing' }).eq('id', room.id).select().single();
        if (updated) {
            const state = typeof updated.game_state === 'string' ? JSON.parse(updated.game_state) : updated.game_state;
            setRoomData({ ...updated, game_state: state });
            setGameState('playing');
        }
        setLoading(false);
    };

    const toggleReady = async () => {
        if (!roomData) return;
        const isHost = userId === roomData.host_user_id;
        const newState = {
            ...roomData.game_state,
            [isHost ? 'host_ready' : 'guest_ready']: !roomData.game_state[isHost ? 'host_ready' : 'guest_ready'],
            last_sync_result: null
        };

        // If both ready, start countdown
        if (newState.host_ready && newState.guest_ready) {
            newState.countdown_active = true;
        }

        await supabase.from('game_rooms').update({ game_state: newState }).eq('id', roomData.id);
    };

    const markResult = async (success: boolean) => {
        if (!roomData) return;
        const newState = {
            ...roomData.game_state,
            sync_score: success ? roomData.game_state.sync_score + 1 : roomData.game_state.sync_score,
            host_ready: false,
            guest_ready: false,
            countdown_active: false,
            last_sync_result: success ? 'success' : 'fail',
            category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]
        };
        await supabase.from('game_rooms').update({ game_state: newState }).eq('id', roomData.id);
        if (success) toast.success('تزامن مذهل! 😍');
    };

    // --- RENDERERS ---

    if (gameState === 'menu') {
        return (
            <div className="flex flex-col h-full bg-background p-6">
                <div className="flex-1 flex flex-col justify-center gap-6 pb-20">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-rose-500/10 rounded-[2.5rem] p-8 text-center border-2 border-rose-500/20">
                        <div className="w-20 h-20 bg-rose-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-rose-500/30 -rotate-6">
                            <Zap className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-black mb-2">تزامن الأرواح ✨</h2>
                        <p className="text-muted-foreground font-bold text-sm mb-8">هل تفكرون بنفس الشيء في نفس اللحظة؟</p>
                        <Button onClick={createRoom} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black bg-rose-500 hover:bg-rose-600">
                            {loading ? 'تعليق..' : '🎮 بدء المزامنة'}
                        </Button>
                    </motion.div>
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground font-black">أو انضم لشريكك</span></div>
                    </div>
                    <div className="space-y-4">
                        <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="كود الغرفة.." className="w-full h-16 rounded-2xl bg-muted/50 border-2 border-border px-6 text-center text-xl font-black outline-none focus:border-rose-500" />
                        <Button onClick={joinRoom} disabled={!joinCode || loading} variant="secondary" className="w-full h-16 rounded-2xl text-lg font-black">انضمام</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (gameState === 'lobby') {
        const isPartnerInRoom = partnerInfo && presence[partnerInfo.id];
        return (
            <div className="flex flex-col h-full bg-background p-6 pt-12 items-center text-center">
                <h2 className="text-2xl font-black mb-10">بانتظار توأم الروح.. ✨</h2>
                <div className="bg-card w-full max-w-xs rounded-[2.5rem] p-8 border-2 border-dashed border-rose-500/30 relative mb-12">
                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2">كود الدخول</p>
                    <p className="text-4xl font-black text-foreground">{roomData?.room_code}</p>
                </div>
                <div className="space-y-4 w-full max-w-xs">
                    <div className={`p-4 rounded-2xl border transition-all ${isPartnerInRoom ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-muted/10 border-dashed border-border opacity-60'}`}>
                        <p className="font-bold">{partnerInfo?.name || 'الشريك'}</p>
                        <span className={`text-[10px] font-black ${isPartnerInRoom ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {isPartnerInRoom ? 'دخل الغرفة ✅' : 'لسه ما وصل..'}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    if (gameState === 'playing') {
        const isHost = userId === roomData?.host_user_id;
        const myReady = isHost ? roomData?.game_state.host_ready : roomData?.game_state.guest_ready;
        const partnerReady = isHost ? roomData?.game_state.guest_ready : roomData?.game_state.host_ready;

        return (
            <div className="flex flex-col h-full bg-background p-4 relative overflow-hidden">
                <div className="flex justify-between items-center mb-10 bg-white/5 p-4 rounded-3xl backdrop-blur-md">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center text-white"><Zap className="w-4 h-4" /></div>
                        <span className="font-black text-lg">{roomData?.game_state.sync_score}</span>
                    </div>
                    <p className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">نقاط التزامن</p>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center gap-12">
                    <AnimatePresence mode="wait">
                        {countdown !== null ? (
                            <motion.div key="countdown" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1.5, opacity: 1 }} exit={{ scale: 2, opacity: 0 }} className="text-8xl font-black text-rose-500">
                                {countdown === 0 ? 'الآن!' : countdown}
                            </motion.div>
                        ) : (
                            <motion.div key="category" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center space-y-6">
                                <div className="bg-rose-500/10 text-rose-600 px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest border border-rose-500/20">التصنيف الحالي</div>
                                <h2 className="text-4xl font-black text-foreground max-w-[280px] leading-tight">{roomData?.game_state.category}</h2>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {countdown === null && (
                      <div className="w-full max-w-xs space-y-4">
                        {roomData?.game_state.countdown_active && countdown === 0 ? (
                            <div className="grid grid-cols-2 gap-4">
                                <Button onClick={() => markResult(true)} className="h-20 rounded-3xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-lg">تزامنّا! ✅</Button>
                                <Button onClick={() => markResult(false)} variant="secondary" className="h-20 rounded-3xl font-black text-lg">للأسف ❌</Button>
                            </div>
                        ) : (
                            <Button onClick={toggleReady} className={`w-full h-20 rounded-3xl text-xl font-black shadow-xl transition-all ${myReady ? 'bg-muted text-muted-foreground' : 'bg-rose-500 text-white'}`}>
                                {myReady ? 'جاهز.. بانتظاره ⌛' : 'أنا جاهز! 🔥'}
                            </Button>
                        )}
                        {!roomData?.game_state.countdown_active && (
                            <div className="flex justify-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${myReady ? 'bg-rose-500 animate-pulse' : 'bg-muted'}`} />
                                <div className={`w-2 h-2 rounded-full ${partnerReady ? 'bg-rose-500 animate-pulse' : 'bg-muted'}`} />
                            </div>
                        )}
                      </div>
                    )}
                </div>
            </div>
        );
    }

    return null;
}
