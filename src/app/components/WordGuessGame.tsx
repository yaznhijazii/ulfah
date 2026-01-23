import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Copy, Brain, MessageCircle, Send, CheckCircle2, Trophy, Home, Users, Ghost, HelpCircle, Sparkles, Compass } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface WordGuessGameProps {
    onBack: () => void;
    userId: string;
    userName: string;
    partnershipId: string | null;
}

type GameState = 'menu' | 'lobby' | 'setup' | 'playing' | 'finished';

interface Question {
    player_id: string;
    player_name: string;
    text: string;
    timestamp: string;
}

interface RoomData {
    id: string;
    room_code: string;
    host_user_id: string;
    guest_user_id: string | null;
    status: string;
    game_state: {
        host_word: string;
        guest_word: string;
        question_count: number;
        host_closeness: 'far' | 'near' | 'very_near' | null; // Feedback FOR host TO see (from guest)
        guest_closeness: 'far' | 'near' | 'very_near' | null; // Feedback FOR guest TO see (from host)
        turn: string | null;
        winner: string | null;
        rematch_requests: string[];
    };
}

export function WordGuessGame({ onBack, userId, userName, partnershipId }: WordGuessGameProps) {
    const [gameState, setGameState] = useState<GameState>('menu');
    const [joinCode, setJoinCode] = useState('');
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tempSecretWord, setTempSecretWord] = useState('');
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [guessedWord, setGuessedWord] = useState('');
    const [presence, setPresence] = useState<any>({});
    const [partnerInfo, setPartnerInfo] = useState<{ id: string, name: string } | null>(null);

    // Realtime Subscription
    useEffect(() => {
        if (!roomData?.id) return;

        const channel = supabase
            .channel(`game_${roomData.id}`, {
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

            // Wait for both words to be set before playing
            if (status === 'setup' && roomData.game_state.host_word && roomData.game_state.guest_word) {
                status = 'playing';
            }

            if (roomData.game_state.winner && status !== 'finished') status = 'finished';

            if (status !== gameState) {
                setGameState(status);
            }
        }
    }, [roomData?.status, roomData?.game_state.host_word, roomData?.game_state.guest_word, roomData?.game_state.winner, gameState]);

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

    const generateRoomCode = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    };

    const createRoom = async () => {
        setLoading(true);
        const code = generateRoomCode();
        const initialGameState = {
            host_word: '',
            guest_word: '',
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
                game_type: 'word-guess',
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

        setRoomData({
            ...data,
            game_state: initialGameState
        });
        setGameState('lobby');
        setLoading(false);

        // Auto-invite if partner info exists
        if (partnerInfo) {
            sendInvite(code);
        }
    };

    const sendInvite = async (code?: string) => {
        if (!partnerInfo) return;
        const roomCodeToUse = code || roomData?.room_code;
        if (!roomCodeToUse) return;

        await supabase.from('notifications').insert({
            user_id: partnerInfo.id,
            title: 'تحدي الكلمة! 🧠',
            body: `${userName} ينتظرك في لعبة الكلمة! الكود: ${roomCodeToUse}`,
            type: 'game_invite',
            metadata: { room_code: roomCodeToUse, game_type: 'word-guess' }
        });
        toast.success(`تم إرسال دعوة لـ ${partnerInfo.name}`);
    };

    const joinRoom = async () => {
        if (!joinCode) return;
        setLoading(true);

        const { data: room, error: searchError } = await supabase
            .from('game_rooms')
            .select('*')
            .eq('room_code', joinCode.toUpperCase())
            .eq('game_type', 'word-guess')
            .eq('status', 'waiting')
            .single();

        if (searchError || !room) {
            setError('الغرفة غير موجودة أو بدأت بالفعل');
            setLoading(false);
            return;
        }

        const { data: updatedRoom, error: joinError } = await supabase
            .from('game_rooms')
            .update({
                guest_user_id: userId,
                status: 'setup'
            })
            .eq('id', room.id)
            .select()
            .single();

        if (joinError) {
            setError('تعذر الانضمام');
            setLoading(false);
            return;
        }

        const parsedState = typeof updatedRoom.game_state === 'string' ? JSON.parse(updatedRoom.game_state) : updatedRoom.game_state;
        setRoomData({ ...updatedRoom, game_state: parsedState });
        setGameState('setup');
        setLoading(false);
    };

    const setSecretWord = async () => {
        if (!tempSecretWord.trim() || !roomData) return;
        setLoading(true);

        const isHost = userId === roomData.host_user_id;
        const newState = {
            ...roomData.game_state,
            [isHost ? 'host_word' : 'guest_word']: tempSecretWord.trim().toLowerCase()
        };

        const { error } = await supabase
            .from('game_rooms')
            .update({
                game_state: newState
            })
            .eq('id', roomData.id);

        if (error) {
            setError('تعذر حفظ الكلمة');
        }
        setLoading(false);
    };

    const nextTurn = async () => {
        if (!roomData) return;
        const isHost = userId === roomData.host_user_id;
        const opponentId = isHost ? roomData.guest_user_id : roomData.host_user_id;

        const newState = {
            ...roomData.game_state,
            turn: opponentId,
            question_count: roomData.game_state.question_count + 1
        };

        await supabase.from('game_rooms').update({ game_state: newState }).eq('id', roomData.id);
    };

    const updateCloseness = async (closenessStatus: 'far' | 'near' | 'very_near') => {
        if (!roomData) return;
        const isHost = userId === roomData.host_user_id;

        // If I am host, I update 'guest_closeness' (feedback for guest to see)
        const newState = {
            ...roomData.game_state,
            [isHost ? 'guest_closeness' : 'host_closeness']: closenessStatus
        };
        await supabase.from('game_rooms').update({ game_state: newState }).eq('id', roomData.id);
    };

    const submitGuess = async () => {
        if (!roomData) return;

        const newState = {
            ...roomData.game_state,
            winner: userId
        };

        await supabase
            .from('game_rooms')
            .update({
                game_state: newState,
                status: 'finished'
            })
            .eq('id', roomData.id);

        toast.success('مبروووووك! عرفتها 🎉');
    };

    const requestRematch = async () => {
        if (!roomData) return;
        const initialGameState = {
            host_word: '',
            guest_word: '',
            question_count: 0,
            host_closeness: 'far',
            guest_closeness: 'far',
            turn: userId,
            winner: null,
            rematch_requests: []
        };
        await supabase.from('game_rooms').update({
            game_state: initialGameState,
            status: 'setup'
        }).eq('id', roomData.id);
    };

    // --- RENDERERS ---

    if (gameState === 'menu') {
        return (
            <div className="flex flex-col h-full bg-background p-6">
                <div className="flex-1 flex flex-col justify-center gap-6 pb-20">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-primary/10 rounded-[2.5rem] p-8 text-center border-2 border-primary/20"
                    >
                        <div className="w-20 h-20 bg-primary text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/30 -rotate-3">
                            <Brain className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-black mb-2">لعبة الكلمة 🧠</h2>
                        <p className="text-muted-foreground font-bold text-sm mb-8">خمن الكلمة اللي في بال شريكك بالأسئلة!</p>

                        <div className="space-y-3">
                            <Button onClick={createRoom} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black shadow-lg">
                                {loading ? 'جاري الإنشاء..' : '🎮 إنشاء غرفة'}
                            </Button>
                        </div>
                    </motion.div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground font-black">أو انضم</span></div>
                    </div>

                    <div className="space-y-4">
                        <input
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="كود الغرفة.."
                            className="w-full h-16 rounded-2xl bg-muted/50 border-2 border-border px-6 text-center text-xl font-black tracking-widest uppercase outline-none focus:border-primary transition-all"
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
                <h2 className="text-2xl font-black mb-2">اتصال المودة 🤝</h2>
                <div className="bg-card w-full max-w-xs rounded-[2.5rem] p-8 border-2 border-dashed border-primary/30 relative mb-8">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">كود الغرفة للمشاركة</p>
                    <p className="text-4xl font-black tracking-widest text-foreground">{roomData?.room_code}</p>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="absolute bottom-4 right-4 text-primary"
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
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-black">{userName[0]}</div>
                        <div className="text-right flex-1">
                            <p className="font-bold text-sm">أنت ({userName})</p>
                            <div className="flex items-center gap-1.5 text-emerald-500">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-black">متواجد</span>
                            </div>
                        </div>
                    </div>

                    <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${isPartnerInRoom ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-muted/10 border-dashed border-border/50 opacity-60'}`}>
                        <div className="w-10 h-10 rounded-full bg-muted-foreground/20 flex items-center justify-center text-muted-foreground">
                            {isPartnerInRoom ? <Users className="w-5 h-5 text-emerald-500" /> : <Ghost className="w-5 h-5" />}
                        </div>
                        <div className="text-right flex-1">
                            <p className="font-bold text-sm">{partnerInfo?.name || 'الشريك'}</p>
                            <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${isPartnerInRoom ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                <span className={`text-[10px] font-black ${isPartnerInRoom ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {isPartnerInRoom ? 'دخل اللعبة' : 'بانتظار دخوله..'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {!isPartnerInRoom && partnerInfo && (
                        <Button
                            variant="outline"
                            onClick={() => sendInvite()}
                            className="w-full mt-4 rounded-2xl font-black text-xs h-12 border-primary/20 text-primary hover:bg-primary/5"
                        >
                            تنبيه الشريك للدخول 🔔
                        </Button>
                    )}

                    <p className="text-[10px] text-muted-foreground font-black px-6">
                        بمجرد دخول شريكك الكود، ستبدأ اللعبة تلقائياً
                    </p>
                </div>
            </div>
        );
    }

    if (gameState === 'setup') {
        const isHost = userId === roomData?.host_user_id;
        const myWordSet = isHost ? !!roomData?.game_state.host_word : !!roomData?.game_state.guest_word;
        const partnerWordSet = isHost ? !!roomData?.game_state.guest_word : !!roomData?.game_state.host_word;

        return (
            <div className="flex flex-col h-full bg-background p-6 pt-10">
                <header className="text-center mb-10">
                    <div className="w-16 h-16 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4 text-amber-600">
                        <Ghost className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-black">{!myWordSet ? 'اختر كلمتك السرية 🤫' : 'بانتظار الشريك..'}</h2>
                    <p className="text-muted-foreground font-bold text-sm">
                        {!myWordSet ? 'صعب الكلمة مشان ما يحزرها شريكك بسرعة!' : 'شريكك الآن يحدد الكلمة، خليك جاهز!'}
                    </p>
                </header>

                {!myWordSet ? (
                    <div className="space-y-6">
                        <input
                            type="text"
                            value={tempSecretWord}
                            onChange={(e) => setTempSecretWord(e.target.value)}
                            placeholder="مثلاً: قمر، بحر، بيت.."
                            className="w-full h-16 rounded-2xl bg-card border-2 border-border px-6 text-center text-xl font-bold outline-none focus:border-amber-500"
                        />
                        <Button
                            onClick={setSecretWord}
                            disabled={!tempSecretWord.trim() || loading}
                            className="w-full h-16 bg-amber-500 hover:bg-amber-600 rounded-2xl text-lg font-black text-white shadow-lg"
                        >
                            تم، أنا جاهز! 🔥
                        </Button>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-6">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                        <div className="bg-emerald-500/10 text-emerald-500 px-6 py-3 rounded-2xl border border-emerald-500/20 font-black">
                            {partnerWordSet ? 'الشريك جاهز! جاري التحميل..' : 'أنت جاهز ✅ بانتظار الشريك..'}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (gameState === 'playing') {
        const isMyTurn = roomData?.game_state.turn === userId;
        const isHost = userId === roomData?.host_user_id;
        const partnerId = isHost ? roomData?.guest_user_id : roomData?.host_user_id;
        const isPartnerInRoom = partnerId && presence[partnerId];

        // Closeness I see about my GUESSES (from partner)
        const myCloseness = isHost ? roomData?.game_state.host_closeness : roomData?.game_state.guest_closeness;
        // Closeness the partner sees (I set this for them)
        const partnerCloseness = isHost ? roomData?.game_state.guest_closeness : roomData?.game_state.host_closeness;

        return (
            <div className="flex flex-col h-full bg-background p-4 pt-4 overflow-hidden relative">
                {/* Compact Game Header */}
                <div className="flex items-center justify-between mb-4 bg-card/60 backdrop-blur-xl p-2.5 rounded-2xl border border-border shadow-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-[9px] font-black shadow-lg">أنا</div>
                        <p className="text-[9px] font-black opacity-60">تحدي متبادل</p>
                    </div>
                    <div className="flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/10">
                        <HelpCircle className="w-3 h-3 text-primary" />
                        <span className="text-xs font-black tracking-tighter text-primary">{roomData?.game_state.question_count} سؤال</span>
                    </div>
                    <div className="relative">
                        <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[9px] font-black shadow-lg">هو</div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-card ${isPartnerInRoom ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-start pt-6 gap-6">
                    {/* Compact Visual Proximity Indicator */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center space-y-3"
                    >
                        <motion.div
                            animate={{
                                scale: myCloseness === 'very_near' ? [1, 1.03, 1] : 1,
                            }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className={`w-24 h-24 rounded-[2.5rem] mx-auto flex items-center justify-center shadow-xl transition-all duration-700 relative ${myCloseness === 'far' ? 'bg-rose-500 text-white shadow-rose-500/10' :
                                    myCloseness === 'near' ? 'bg-amber-500 text-white shadow-amber-500/10' :
                                        'bg-emerald-500 text-white shadow-emerald-500/20'
                                }`}>
                            <div className="absolute inset-0 bg-white/10 rounded-[inherit] animate-pulse" />
                            {myCloseness === 'far' ? <Ghost className="w-10 h-10 relative z-10" /> :
                                myCloseness === 'near' ? <Compass className="w-10 h-10 relative z-10" /> : <Sparkles className="w-10 h-10 relative z-10 text-emerald-100" />}
                        </motion.div>

                        <div className="space-y-0.5">
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">مدى قربك من الحل</p>
                            <h3 className="text-xl font-black tracking-tight">
                                {myCloseness === 'far' ? 'لسه ببعيد 💨' :
                                    myCloseness === 'near' ? 'قربت كثير! 👀' : 'خلاص، قدامك! 🔥'}
                            </h3>
                        </div>
                    </motion.div>

                    {/* Compact Interaction Zone */}
                    <div className="w-full flex flex-col gap-3 max-w-[280px]">
                        {isMyTurn ? (
                            <motion.div whileTap={{ scale: 0.97 }}>
                                <Button
                                    onClick={nextTurn}
                                    className="w-full h-16 rounded-[1.8rem] bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-500/20 text-md font-black border-2 border-indigo-400/20"
                                >
                                    سألت، دورك! 🤝
                                </Button>
                            </motion.div>
                        ) : (
                            <div className="h-16 flex items-center justify-center bg-muted/20 rounded-[1.8rem] border border-dashed border-primary/20 text-muted-foreground text-xs font-black animate-pulse">
                                بانتظار الشريك.. ⏳
                            </div>
                        )}

                        <Button
                            onClick={() => {
                                if (window.confirm('أكيد عرفت الكلمة؟')) {
                                    submitGuess();
                                }
                            }}
                            className="w-full h-11 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 font-black text-[10px] transition-all active:scale-95"
                        >
                            خمنت كلمته صح؟ 🎉
                        </Button>
                    </div>
                </div>

                {/* Compact Word Picker Tools */}
                <motion.div
                    initial={{ y: 50 }}
                    animate={{ y: 0 }}
                    className="absolute bottom-20 left-4 right-4 bg-card/90 backdrop-blur-3xl p-4 rounded-3xl border border-border shadow-2xl space-y-3 z-40"
                >
                    <div className="flex items-center justify-between px-1">
                        <p className="text-[8px] font-black text-muted-foreground uppercase">وجه شريكك لـ كلمتك:</p>
                        <div className="bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/10">
                            <span className="text-[9px] font-black text-primary uppercase">سرّي: {isHost ? roomData?.game_state.host_word : roomData?.game_state.guest_word}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { id: 'far', label: 'ببعيد', icon: Ghost, color: 'rose' },
                            { id: 'near', label: 'قريب', icon: Compass, color: 'amber' },
                            { id: 'very_near', label: 'جداً!', icon: Sparkles, color: 'emerald' }
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => updateCloseness(item.id as any)}
                                className={`h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 border-2 active:scale-95 ${partnerCloseness === item.id
                                        ? `bg-${item.color}-500 text-white border-${item.color}-300 shadow-lg shadow-${item.color}-500/20`
                                        : 'bg-muted/30 border-transparent text-muted-foreground'
                                    }`}
                            >
                                <item.icon className="w-4 h-4" />
                                <span className="text-[8px] font-black tracking-tighter">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </motion.div>
            </div>
        );
    }

    if (gameState === 'finished') {
        const iWon = roomData?.game_state.winner === userId;
        const myWord = userId === roomData?.host_user_id ? roomData?.game_state.host_word : roomData?.game_state.guest_word;
        const partnerWord = userId === roomData?.host_user_id ? roomData?.game_state.guest_word : roomData?.game_state.host_word;

        return (
            <div className="flex flex-col h-full bg-background items-center justify-center p-6 text-center overflow-y-auto">
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl ${iWon ? 'bg-amber-500 text-white' : 'bg-primary text-white'}`}
                >
                    {iWon ? <Trophy className="w-12 h-12" /> : <Sparkles className="w-12 h-12" />}
                </motion.div>

                <h2 className="text-3xl font-black mb-2">{iWon ? 'مبروك الفوز! 🏆' : 'عاش.. حزرها! 👏'}</h2>
                <p className="text-muted-foreground font-bold mb-8">كشفتم السر لبعضكم البعض</p>

                <div className="grid grid-cols-1 gap-4 w-full mb-12">
                    <div className="bg-card p-4 rounded-3xl border border-border shadow-sm">
                        <p className="text-[10px] font-black text-muted-foreground uppercase mb-2">كلمتي أنا</p>
                        <p className="text-2xl font-black text-primary tracking-tight">{myWord}</p>
                    </div>
                    <div className="bg-primary/5 p-4 rounded-3xl border border-primary/10 shadow-sm">
                        <p className="text-[10px] font-black text-primary uppercase mb-2">كلمة الشريك</p>
                        <p className="text-2xl font-black text-primary tracking-tight">{partnerWord}</p>
                    </div>
                </div>

                <div className="w-full space-y-3">
                    <Button onClick={requestRematch} className="w-full h-16 rounded-2xl text-lg font-black shadow-lg">
                        جولة أخرى
                    </Button>
                    <Button onClick={onBack} variant="ghost" className="w-full h-14 rounded-2xl font-black text-xs opacity-50">
                        عودة لساحة الألعاب
                    </Button>
                </div>
            </div>
        );
    }

    return null;
}
