import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Copy, Binary, MessageCircle, Send, CheckCircle2, Trophy, Home, Users, Ghost, HelpCircle, Sparkles, Compass, Hash, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface NumberGuessGameProps {
    onBack: () => void;
    userId: string;
    userName: string;
    partnershipId: string | null;
}

type GameState = 'menu' | 'lobby' | 'setup' | 'playing' | 'finished';

interface RoomData {
    id: string;
    room_code: string;
    host_user_id: string;
    guest_user_id: string | null;
    status: string;
    game_state: {
        host_number: string;
        guest_number: string;
        question_count: number;
        host_closeness: 'far' | 'near' | 'very_near' | null;
        guest_closeness: 'far' | 'near' | 'very_near' | null;
        turn: string | null;
        winner: string | null;
        rematch_requests: string[];
    };
}

export function NumberGuessGame({ onBack, userId, userName, partnershipId }: NumberGuessGameProps) {
    const [gameState, setGameState] = useState<GameState>('menu');
    const [joinCode, setJoinCode] = useState('');
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tempNumber, setTempNumber] = useState('');
    const [showNumber, setShowNumber] = useState(false);
    const [presence, setPresence] = useState<any>({});
    const [partnerInfo, setPartnerInfo] = useState<{ id: string, name: string } | null>(null);

    // Realtime Subscription
    useEffect(() => {
        if (!roomData?.id) return;

        const channel = supabase
            .channel(`game_number_${roomData.id}`, {
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
                    await channel.track({
                        user_id: userId,
                        name: userName,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomData?.id, userId, userName]);

    useEffect(() => {
        if (roomData?.status) {
            let status = roomData.status as GameState;
            if (roomData.status === 'waiting') status = 'lobby';

            // Wait for both numbers to be set before playing
            if (status === 'setup' && roomData.game_state.host_number && roomData.game_state.guest_number) {
                status = 'playing';
            }

            if (roomData.game_state.winner && status !== 'finished') status = 'finished';

            if (status !== gameState) {
                setGameState(status);
            }
        }
    }, [roomData?.status, roomData?.game_state.host_number, roomData?.game_state.guest_number, roomData?.game_state.winner, gameState]);

    // Fetch Partner Info
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
            host_number: '',
            guest_number: '',
            question_count: 0,
            host_closeness: 'far',
            guest_closeness: 'far',
            turn: userId,
            winner: null,
            rematch_requests: []
        };

        const { data, error } = await supabase
            .from('game_rooms')
            .insert({
                room_code: code,
                game_type: 'number-guess',
                host_user_id: userId,
                status: 'waiting',
                game_state: initialGameState
            })
            .select()
            .single();

        if (error) {
            setError('تعذر إنشاء الغرفة');
            setLoading(false);
            return;
        }

        setRoomData({ ...data, game_state: initialGameState });
        setGameState('lobby');
        setLoading(false);

        if (partnerInfo) {
            await supabase.from('notifications').insert({
                user_id: partnerInfo.id,
                title: 'تحدي الرقم! 🔢',
                body: `${userName} يتحداك في لعبة الرقم! الكود: ${code}`,
                type: 'game_invite',
                metadata: { room_code: code, game_type: 'number-guess' }
            });
            toast.success(`تم إرسال دعوة لـ ${partnerInfo.name}`);
        }
    };

    const joinRoom = async () => {
        if (!joinCode) return;
        setLoading(true);

        const { data: room, error: searchError } = await supabase
            .from('game_rooms')
            .select('*')
            .eq('room_code', joinCode.toUpperCase())
            .eq('game_type', 'number-guess')
            .eq('status', 'waiting')
            .single();

        if (searchError || !room) {
            setError('الغرفة غير موجودة');
            setLoading(false);
            return;
        }

        const { data: updatedRoom, error: joinError } = await supabase
            .from('game_rooms')
            .update({ guest_user_id: userId, status: 'setup' })
            .eq('id', room.id)
            .select()
            .single();

        if (joinError) return setLoading(false);

        const parsedState = typeof updatedRoom.game_state === 'string' ? JSON.parse(updatedRoom.game_state) : updatedRoom.game_state;
        setRoomData({ ...updatedRoom, game_state: parsedState });
        setGameState('setup');
        setLoading(false);
    };

    const setSecretNumber = async () => {
        if (!tempNumber.trim() || !roomData) return;
        setLoading(true);

        const isHost = userId === roomData.host_user_id;
        const newState = {
            ...roomData.game_state,
            [isHost ? 'host_number' : 'guest_number']: tempNumber.trim()
        };

        await supabase.from('game_rooms').update({ game_state: newState }).eq('id', roomData.id);
        setLoading(false);
    };

    const updateCloseness = async (status: 'far' | 'near' | 'very_near') => {
        if (!roomData) return;
        const isHost = userId === roomData.host_user_id;
        const newState = {
            ...roomData.game_state,
            [isHost ? 'guest_closeness' : 'host_closeness']: status
        };
        await supabase.from('game_rooms').update({ game_state: newState }).eq('id', roomData.id);
    };

    const handleWin = async () => {
        if (!roomData) return;
        const newState = { ...roomData.game_state, winner: userId };
        await supabase.from('game_rooms').update({ game_state: newState, status: 'finished' }).eq('id', roomData.id);
        toast.success('ألف مبروك! حزرت الرقم 🎉');
    };

    // --- RENDERERS ---

    if (gameState === 'menu') {
        return (
            <div className="flex flex-col h-full bg-background p-6">
                <div className="flex-1 flex flex-col justify-center gap-6 pb-20">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-amber-500/10 rounded-[2.5rem] p-8 text-center border-2 border-amber-500/20"
                    >
                        <div className="w-20 h-20 bg-amber-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-amber-500/30 rotate-3">
                            <Binary className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-black mb-2">احزر الرقم 🔢</h2>
                        <p className="text-muted-foreground font-bold text-sm mb-8">خمن الرقم السري اللي في بال شريكك!</p>

                        <div className="space-y-3">
                            <Button onClick={createRoom} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black shadow-lg bg-amber-500 hover:bg-amber-600">
                                {loading ? 'جاري الإنشاء..' : '🎮 إنشاء تحدي'}
                            </Button>
                        </div>
                    </motion.div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground font-black">أو انضم للتحدي</span></div>
                    </div>

                    <div className="space-y-4">
                        <input
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="كود الغرفة.."
                            className="w-full h-16 rounded-2xl bg-muted/50 border-2 border-border px-6 text-center text-xl font-black tracking-widest uppercase outline-none focus:border-amber-500 transition-all"
                        />
                        <Button onClick={joinRoom} disabled={!joinCode || loading} variant="secondary" className="w-full h-16 rounded-2xl text-lg font-black">
                            انضمام للعبة
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (gameState === 'lobby') {
        const isPartnerInRoom = partnerInfo && presence[partnerInfo.id];
        return (
            <div className="flex flex-col h-full bg-background p-6 pt-12 items-center text-center">
                <h2 className="text-2xl font-black mb-2">بانتظار المنافس 🕒</h2>
                <div className="bg-card w-full max-w-xs rounded-[2.5rem] p-8 border-2 border-dashed border-amber-500/30 relative mb-8">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">كود الغرفة</p>
                    <p className="text-4xl font-black tracking-widest text-foreground">{roomData?.room_code}</p>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="absolute bottom-4 right-4 text-amber-500"
                        onClick={() => {
                            navigator.clipboard.writeText(roomData?.room_code || '');
                            toast.success('تم نسخ الكود');
                        }}
                    >
                        <Copy className="w-5 h-5" />
                    </Button>
                </div>

                <div className="space-y-4 w-full max-w-xs">
                    <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-2xl border border-border">
                        <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-black">{userName[0]}</div>
                        <div className="text-right flex-1">
                            <p className="font-bold text-sm">{userName}</p>
                            <span className="text-[10px] font-black text-emerald-500 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> متواجد
                            </span>
                        </div>
                    </div>

                    <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${isPartnerInRoom ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-muted/10 border-dashed border-border/50 opacity-60'}`}>
                        <div className="w-10 h-10 rounded-full bg-muted-foreground/20 flex items-center justify-center text-muted-foreground">
                            {isPartnerInRoom ? <Users className="w-5 h-5 text-emerald-500" /> : <Ghost className="w-5 h-5" />}
                        </div>
                        <div className="text-right flex-1">
                            <p className="font-bold text-sm">{partnerInfo?.name || 'الشريك'}</p>
                            <span className={`text-[10px] font-black ${isPartnerInRoom ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {isPartnerInRoom ? 'دخل اللعبة ✅' : 'لسه ما دخل..'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (gameState === 'setup') {
        const isHost = userId === roomData?.host_user_id;
        const myNumberSet = isHost ? !!roomData?.game_state.host_number : !!roomData?.game_state.guest_number;
        const partnerNumberSet = isHost ? !!roomData?.game_state.guest_number : !!roomData?.game_state.host_number;

        return (
            <div className="flex flex-col h-full bg-background p-6 pt-10">
                <header className="text-center mb-10">
                    <div className="w-16 h-16 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4 text-amber-600">
                        <Hash className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-black">{!myNumberSet ? 'اختر رقمك السري 🔒' : 'بانتظار الشريك..'}</h2>
                    <p className="text-muted-foreground font-bold text-sm mt-2">
                        {!myNumberSet ? 'اكتب رقم من 1 إلى 100 (أو أي رقم تحبه)!' : 'شريكك الآن يحدد رقمه، خليك مستعد!'}
                    </p>
                </header>

                {!myNumberSet ? (
                    <div className="space-y-6">
                        <div className="relative">
                            <input
                                type={showNumber ? "text" : "password"}
                                value={tempNumber}
                                onChange={(e) => setTempNumber(e.target.value)}
                                placeholder="الرقم هنا.."
                                className="w-full h-16 rounded-2xl bg-card border-2 border-border px-6 text-center text-2xl font-black outline-none focus:border-amber-500"
                            />
                            <button 
                                onClick={() => setShowNumber(!showNumber)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                            >
                                {showNumber ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        <Button
                            onClick={setSecretNumber}
                            disabled={!tempNumber.trim() || loading}
                            className="w-full h-16 bg-amber-500 hover:bg-amber-600 rounded-2xl text-lg font-black text-white shadow-lg"
                        >
                            تم، حفظت الرقم! 🚀
                        </Button>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-6">
                        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        <div className="bg-emerald-500/10 text-emerald-500 px-6 py-3 rounded-2xl border border-emerald-500/20 font-black">
                            {partnerNumberSet ? 'الشريك جاهز! جاري التحميل..' : 'أنت جاهز ✅ بانتظار الشريك..'}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (gameState === 'playing') {
        const isHost = userId === roomData?.host_user_id;
        const myCloseness = isHost ? roomData?.game_state.host_closeness : roomData?.game_state.guest_closeness;
        const partnerCloseness = isHost ? roomData?.game_state.guest_closeness : roomData?.game_state.host_closeness;
        const mySecret = isHost ? roomData?.game_state.host_number : roomData?.game_state.guest_number;

        return (
            <div className="flex flex-col h-full bg-background p-4 pt-4 overflow-hidden relative">
                <div className="flex items-center justify-between mb-8 bg-card p-4 rounded-2xl border-2 border-amber-500/10 shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-black">أنا</div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">رقمي السري</p>
                            <p className="text-lg font-black text-foreground">{mySecret}</p>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                        <Binary className="w-5 h-5" />
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-start pt-6 gap-10">
                    <div className="text-center space-y-4">
                        <motion.div
                            animate={{ scale: myCloseness === 'very_near' ? [1, 1.05, 1] : 1 }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className={`w-32 h-32 rounded-[3rem] mx-auto flex items-center justify-center shadow-xl transition-colors duration-500 relative border-4 border-white/20 ${
                                myCloseness === 'far' ? 'bg-rose-500 text-white' :
                                myCloseness === 'near' ? 'bg-amber-500 text-white' :
                                'bg-emerald-500 text-white'
                            }`}>
                            {myCloseness === 'far' ? <Ghost className="w-14 h-14" /> :
                             myCloseness === 'near' ? <Compass className="w-14 h-14" /> : <Sparkles className="w-14 h-14" />}
                        </motion.div>

                        <div className="space-y-1">
                            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">تلميح الشريك لك</p>
                            <h3 className="text-3xl font-black text-foreground tracking-tighter">
                                {myCloseness === 'far' ? 'لسه بعيد! 💨' :
                                 myCloseness === 'near' ? 'قربت كثير! 👀' : 'خلاص، قربت جداً! 🔥'}
                            </h3>
                        </div>
                    </div>

                    <div className="w-full flex flex-col gap-4 max-w-[320px]">
                        <Button
                            onClick={handleWin}
                            className="w-full h-20 rounded-[2rem] bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl text-xl font-black border-b-4 border-indigo-900/30 active:border-b-0 active:translate-y-1 transition-all"
                        >
                            حزرت الرقم! 🎉
                        </Button>
                        <p className="text-[10px] text-center text-muted-foreground font-bold px-8">
                            اسأل شريكك (مثلاً: هل الرقم أكبر من 50؟) وهو بيعطيك تلميحات بالأزرار تحت
                        </p>
                    </div>
                </div>

                {/* Feedback Panel */}
                <div className="fixed bottom-10 left-6 right-6 bg-white/10 backdrop-blur-3xl p-6 rounded-[2.5rem] border-2 border-white/20 shadow-2xl space-y-5 z-40">
                    <div className="flex items-center justify-between px-2">
                        <p className="text-[11px] font-black text-foreground uppercase tracking-widest">وجه شريكك لرقمك ({mySecret}):</p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { id: 'far', label: 'بعيد', icon: Ghost, color: 'bg-rose-500' },
                            { id: 'near', label: 'قريب', icon: Compass, color: 'bg-amber-500' },
                            { id: 'very_near', label: 'جداً!', icon: Sparkles, color: 'bg-emerald-500' }
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => updateCloseness(item.id as any)}
                                className={`h-16 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 border-2 active:scale-95 ${
                                    partnerCloseness === item.id
                                    ? `${item.color} text-white border-white/20 shadow-lg`
                                    : 'bg-white/5 text-foreground border-transparent opacity-60'
                                }`}
                            >
                                <item.icon className={`w-5 h-5 ${partnerCloseness === item.id ? 'text-white' : 'text-muted-foreground'}`} />
                                <span className="text-[10px] font-black">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (gameState === 'finished') {
        const iWon = roomData?.game_state.winner === userId;
        const myNum = isHost ? roomData?.game_state.host_number : roomData?.game_state.guest_number;
        const partnerNum = isHost ? roomData?.game_state.guest_number : roomData?.game_state.host_number;

        return (
            <div className="flex flex-col h-full bg-background items-center justify-center p-6 text-center">
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className={`w-24 h-24 rounded-[3rem] flex items-center justify-center mb-8 shadow-2xl ${iWon ? 'bg-amber-500 text-white' : 'bg-indigo-500 text-white'}`}
                >
                    {iWon ? <Trophy className="w-12 h-12" /> : <Sparkles className="w-12 h-12" />}
                </motion.div>

                <h2 className="text-4xl font-black mb-2 tracking-tighter">{iWon ? 'عبقري! حزرت الرقم 🏆' : 'مبروك لشريكك! حزره 👏'}</h2>
                <p className="text-muted-foreground font-bold mb-10">انتهى تحدي الأرقام!</p>

                <div className="grid grid-cols-1 gap-4 w-full max-w-xs mb-12">
                    <div className="bg-card p-6 rounded-3xl border border-border shadow-sm text-right">
                        <p className="text-[11px] font-black text-muted-foreground uppercase mb-2">رقمك</p>
                        <p className="text-3xl font-black text-amber-500">{myNum}</p>
                    </div>
                    <div className="bg-indigo-500/5 p-6 rounded-3xl border border-indigo-500/10 shadow-sm text-right">
                        <p className="text-[11px] font-black text-indigo-500 uppercase mb-2">رقم الشريك</p>
                        <p className="text-3xl font-black text-indigo-600">{partnerNum}</p>
                    </div>
                </div>

                <div className="w-full max-w-xs space-y-3">
                    <Button onClick={() => setGameState('setup')} className="w-full h-16 rounded-2xl text-lg font-black shadow-lg bg-indigo-600 hover:bg-indigo-700">
                        تحدي جديد 🔄
                    </Button>
                    <Button onClick={onBack} variant="ghost" className="w-full h-14 rounded-2xl font-black text-xs opacity-50">
                        العودة للألعاب
                    </Button>
                </div>
            </div>
        );
    }

    return null;
}
