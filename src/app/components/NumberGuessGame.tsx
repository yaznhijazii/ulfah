import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { Copy, Binary, Trophy, Sparkles, Hash, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface NumberGuessGameProps {
    onBack: () => void;
    userId: string;
    userName: string;
    partnershipId: string | null;
    initialCode?: string;
}

type UiState = 'menu' | 'lobby' | 'setup' | 'playing' | 'finished';

type DigitLength = 2 | 3 | 4;

interface GameStatePayload {
    digit_length: DigitLength;
    host_secret: string;
    guest_secret: string;
    /** خانات كشفها المضيف وهو يحاول تخمين رقم الضيف (نفس طول الرقم) */
    host_revealed: (string | null)[];
    /** خانات كشفها الضيف وهو يحاول تخمين رقم المضيف */
    guest_revealed: (string | null)[];
    current_turn: string | null; // The user ID who is currently allowed to guess
    winner: string | null;
}

interface RoomData {
    id: string;
    room_code: string;
    host_user_id: string;
    guest_user_id: string | null;
    status: string;
    game_state: GameStatePayload;
}

function parseGs(raw: unknown): GameStatePayload {
    const o = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<GameStatePayload>;
    const L = (o.digit_length ?? 3) as DigitLength;
    if (L !== 2 && L !== 3 && L !== 4) {
        return {
            digit_length: 3,
            host_secret: '',
            guest_secret: '',
            host_revealed: emptyRevealed(3),
            guest_revealed: emptyRevealed(3),
            winner: null,
            current_turn: null,
        };
    }
    const hr = Array.isArray(o.host_revealed) ? o.host_revealed : emptyRevealed(L);
    const gr = Array.isArray(o.guest_revealed) ? o.guest_revealed : emptyRevealed(L);
    return {
        digit_length: L,
        host_secret: o.host_secret ?? '',
        guest_secret: o.guest_secret ?? '',
        host_revealed: hr.length === L ? hr : emptyRevealed(L),
        guest_revealed: gr.length === L ? gr : emptyRevealed(L),
        current_turn: o.current_turn ?? null,
        winner: o.winner ?? null,
    };
}

function emptyRevealed(len: DigitLength): (string | null)[] {
    return Array(len).fill(null);
}

function applyPositionalReveal(guess: string, secret: string, prev: (string | null)[]): (string | null)[] {
    const next = [...prev];
    for (let i = 0; i < secret.length; i++) {
        if (guess[i] === secret[i]) next[i] = secret[i];
    }
    return next;
}

function maskLine(revealed: (string | null)[]): string {
    return revealed.map((c) => (c != null ? c : '•')).join(' ');
}

export function NumberGuessGame({ onBack, userId, userName, partnershipId, initialCode }: NumberGuessGameProps) {
    const [digitLength, setDigitLength] = useState<DigitLength>(3);
    const [joinCode, setJoinCode] = useState('');
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(false);
    const [tempSecret, setTempSecret] = useState('');
    const [guessInput, setGuessInput] = useState('');
    const [showSecret, setShowSecret] = useState(false);
    const [partnerInfo, setPartnerInfo] = useState<{ id: string; name: string } | null>(null);

    useEffect(() => {
        if (!roomData?.id) return;
        const channel = supabase
            .channel(`game_number_${roomData.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomData.id}` },
                (payload) => {
                    const newData = payload.new as Record<string, unknown>;
                    setRoomData({
                        ...newData,
                        game_state: parseGs(newData.game_state),
                    } as RoomData);
                }
            )
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomData?.id]);

    const uiState = useMemo((): UiState => {
        if (!roomData) return 'menu';
        const gs = roomData.game_state;
        if (roomData.status === 'waiting') return 'lobby';
        if (roomData.status === 'setup') {
            if (gs.host_secret && gs.guest_secret) return 'playing';
            return 'setup';
        }
        if (roomData.status === 'playing') return 'playing';
        if (roomData.status === 'finished') return 'finished';
        return 'menu';
    }, [roomData]);

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
        const L = digitLength;
        const initial: GameStatePayload = {
            digit_length: L,
            host_secret: '',
            guest_secret: '',
            host_revealed: emptyRevealed(L),
            guest_revealed: emptyRevealed(L),
            current_turn: userId, // Creator starts
            winner: null,
        };
        const { data, error } = await supabase
            .from('game_rooms')
            .insert({
                room_code: code,
                game_type: 'number-guess',
                host_user_id: userId,
                status: 'waiting',
                game_state: initial,
            })
            .select()
            .single();

        if (error) {
            toast.error('تعذّر إنشاء الغرفة');
            setLoading(false);
            return;
        }
        setRoomData({ ...data, game_state: initial } as RoomData);
        setLoading(false);
        if (partnerInfo) {
            await supabase.from('notifications').insert({
                user_id: partnerInfo.id,
                title: 'تحدي الأرقام 🔢',
                body: `${userName} يتحداك (${L} أرقام)! الكود: ${code}`,
                type: 'game_invite',
                metadata: { room_code: code, game_type: 'number-guess' },
            });
            toast.success(`تم إرسال دعوة لـ ${partnerInfo.name}`);
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
            .eq('game_type', 'number-guess')
            .eq('status', 'waiting')
            .single();

        if (error || !room) {
            toast.error('الغرفة غير موجودة');
            setLoading(false);
            return;
        }

        const { data: updated, error: upErr } = await supabase
            .from('game_rooms')
            .update({ guest_user_id: userId, status: 'setup' })
            .eq('id', room.id)
            .select()
            .single();

        if (upErr || !updated) {
            setLoading(false);
            return;
        }
        setRoomData({ ...updated, game_state: parseGs(updated.game_state) } as RoomData);
        setLoading(false);
    };

    const validateSecret = (s: string, L: DigitLength): boolean => {
        if (s.length !== L) return false;
        return /^\d+$/.test(s);
    };

    const setSecretNumber = async () => {
        if (!roomData || !tempSecret.trim()) return;
        const L = roomData.game_state.digit_length;
        const trimmed = tempSecret.trim();
        if (!validateSecret(trimmed, L)) {
            toast.error(`الرقم لازم يكون بالضبط ${L} خانات (أرقام فقط)`);
            return;
        }
        setLoading(true);
        const isHost = userId === roomData.host_user_id;
        const key = isHost ? 'host_secret' : 'guest_secret';
        const newState: GameStatePayload = {
            ...roomData.game_state,
            [key]: trimmed,
        };
        const bothReady = !!(newState.host_secret && newState.guest_secret);
        await supabase
            .from('game_rooms')
            .update({
                game_state: newState,
                ...(bothReady ? { status: 'playing' } : {}),
            })
            .eq('id', roomData.id);
        setTempSecret('');
        setLoading(false);
    };

    const submitGuess = useCallback(async () => {
        if (!roomData || !guessInput.trim()) return;
        const gs = roomData.game_state;
        if (gs.current_turn !== userId) {
            toast.error('بانتظار دور الشريك');
            return;
        }
        const L = gs.digit_length;
        const g = guessInput.trim();
        if (!validateSecret(g, L)) {
            toast.error(`${L} أرقام بالضبط`);
            return;
        }
        const isHost = userId === roomData.host_user_id;
        const opponentSecret = isHost ? gs.guest_secret : gs.host_secret;
        const revealKey = isHost ? 'host_revealed' : 'guest_revealed';
        const prev = isHost ? gs.host_revealed : gs.guest_revealed;
        const merged = prev.map((val, i) => (val !== null ? val : (g[i] === opponentSecret![i] ? g[i] : null)));

        if (g === opponentSecret) {
            const newState: GameStatePayload = { ...gs, winner: userId };
            await supabase.from('game_rooms').update({ game_state: newState, status: 'finished' }).eq('id', roomData.id);
            toast.success('صح! خمّنت الرقم كامل 🎉');
            setGuessInput('');
            return;
        }

        const nextTurn = isHost ? roomData.guest_user_id! : roomData.host_user_id;
        const newState: GameStatePayload = { ...gs, [revealKey]: merged, current_turn: nextTurn };
        await supabase.from('game_rooms').update({ game_state: newState }).eq('id', roomData.id);

        const newHits = merged.filter((x, i) => x !== null && prev[i] === null).length;
        if (newHits > 0) toast.success(`خمنّت ${newHits} خانة صح — تبقّى على الباقي!`);
        else toast.message('لا خانة مطابقة في هذا التخمين');
        setGuessInput('');
    }, [guessInput, roomData, userId]);

    const isHost = roomData ? userId === roomData.host_user_id : false;

    if (uiState === 'menu') {
        return (
            <div dir="rtl" className="flex flex-col h-full bg-background p-6 overflow-y-auto">
                <div className="flex-1 flex flex-col justify-center gap-6 pb-20 max-w-md mx-auto w-full">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-amber-500/10 rounded-[2.5rem] p-8 text-center border-2 border-amber-500/20"
                    >
                        <div className="w-20 h-20 bg-amber-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl rotate-3">
                            <Binary className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-black mb-2">احزر الرقم 🔢</h2>
                        <p className="text-muted-foreground font-bold text-sm mb-6">
                            كل واحد يخفي رقمًا من {2}–{4} خانات. كل تخمين يكشف الخانات اللي خمنتها صح فقط (مثل 3••• إذا الخانة الأولى صح).
                        </p>

                        <p className="text-[11px] font-black text-amber-700/80 mb-3 uppercase tracking-widest">عدد الخانات</p>
                        <div className="flex gap-3 justify-center mb-8">
                            {([2, 3, 4] as const).map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => setDigitLength(n)}
                                    className={`flex-1 max-w-[88px] py-4 rounded-2xl font-black text-lg border-2 transition-all ${
                                        digitLength === n ? 'bg-amber-500 text-white border-amber-500 shadow-lg' : 'bg-white/50 dark:bg-white/5 border-border'
                                    }`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>

                        <Button onClick={createRoom} disabled={loading} className="w-full h-14 rounded-2xl text-lg font-black shadow-lg bg-amber-500 hover:bg-amber-600">
                            {loading ? 'جاري الإنشاء…' : '🎮 إنشاء تحدي'}
                        </Button>
                    </motion.div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground font-black">أو انضم بالكود</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <input
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="كود الغرفة"
                            className="w-full h-14 rounded-2xl bg-muted/50 border-2 border-border px-6 text-center text-xl font-black tracking-widest uppercase outline-none focus:border-amber-500"
                        />
                        <Button onClick={joinRoom} disabled={!joinCode || loading} variant="secondary" className="w-full h-14 rounded-2xl text-lg font-black">
                            انضمام
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (uiState === 'lobby' && roomData) {
        const L = roomData.game_state.digit_length;
        return (
            <div dir="rtl" className="flex flex-col h-full bg-background p-6 pt-12 items-center text-center">
                <h2 className="text-xl font-black mb-4">شارِك الكود مع شريكك</h2>
                <p className="text-sm text-muted-foreground font-bold mb-6">التحدي بـ {L} أرقام</p>
                <div className="bg-card w-full max-w-xs rounded-[2.5rem] p-8 border-2 border-dashed border-amber-500/30 relative mb-8">
                    <p className="text-[10px] font-black text-amber-600 uppercase mb-2">الكود</p>
                    <p className="text-4xl font-black tracking-widest">{roomData.room_code}</p>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="absolute bottom-4 end-4 text-amber-600"
                        onClick={() => {
                            navigator.clipboard.writeText(roomData.room_code);
                            toast.success('تم نسخ الكود');
                        }}
                    >
                        <Copy className="w-5 h-5" />
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground font-bold">لما ينضم الشريك تبدأ مرحلة إدخال الأرقام السرّية</p>
            </div>
        );
    }

    if (uiState === 'setup' && roomData) {
        const gs = roomData.game_state;
        const L = gs.digit_length;
        const mineSet = isHost ? !!gs.host_secret : !!gs.guest_secret;
        const partnerSet = isHost ? !!gs.guest_secret : !!gs.host_secret;

        return (
            <div dir="rtl" className="flex flex-col h-full bg-background p-6 pt-10">
                <header className="text-center mb-8">
                    <div className="w-16 h-16 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4 text-amber-600">
                        <Hash className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-black">{!mineSet ? `اختر رقمك السري (${L} خانات)` : 'بانتظار الشريك…'}</h2>
                    <p className="text-muted-foreground font-bold text-sm mt-2">
                        أرقام فقط • مثال لـ {L} خانات: {L === 2 ? '42' : L === 3 ? '307' : '4523'}
                    </p>
                </header>

                {!mineSet ? (
                    <div className="space-y-6 max-w-md mx-auto w-full">
                        <div className="relative">
                            <input
                                type={showSecret ? 'text' : 'password'}
                                inputMode="numeric"
                                autoComplete="off"
                                value={tempSecret}
                                onChange={(e) => setTempSecret(e.target.value.replace(/\D/g, '').slice(0, L))}
                                placeholder={'•'.repeat(L)}
                                className="w-full h-16 rounded-2xl bg-card border-2 border-border px-6 text-center text-2xl font-black tracking-[0.4em] outline-none focus:border-amber-500"
                            />
                            <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute end-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                                {showSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        <Button
                            onClick={setSecretNumber}
                            disabled={!validateSecret(tempSecret, L) || loading}
                            className="w-full h-16 bg-amber-500 hover:bg-amber-600 rounded-2xl text-lg font-black"
                        >
                            حفظ الرقم السري
                        </Button>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <p className="font-black text-amber-700">{partnerSet ? 'جاري بدء اللعب…' : `بانتظار يدخل شريكك رقمه (${L} خانات)`}</p>
                    </div>
                )}
            </div>
        );
    }

    if (uiState === 'playing' && roomData) {
        const gs = roomData.game_state;
        const L = gs.digit_length;
        const mySecret = isHost ? gs.host_secret : gs.guest_secret;
        const theirSecret = isHost ? gs.guest_secret : gs.host_secret;
        const myReveal = isHost ? gs.host_revealed : gs.guest_revealed;

        return (
            <div dir="rtl" className="flex flex-col h-full bg-background p-4 pt-4 overflow-hidden">
                <div className="flex items-center justify-between mb-4 bg-card p-4 rounded-2xl border-2 border-amber-500/15">
                    <div className="text-start">
                        <p className="text-[10px] font-black text-muted-foreground uppercase">رقمي</p>
                        <p className="text-xl font-black tracking-widest">{mySecret}</p>
                    </div>
                    <Binary className="w-8 h-8 text-amber-500 opacity-50" />
                </div>

                <div className="rounded-3xl bg-amber-500/10 border border-amber-500/20 p-6 mb-4 text-center">
                    <p className="text-[10px] font-black text-amber-800 dark:text-amber-200 uppercase mb-2">تقدّمك نحو رقم {partnerInfo?.name}</p>
                    <p dir="ltr" className="text-3xl font-black tracking-[0.35em] text-amber-950 dark:text-white">
                        {maskLine(myReveal)}
                    </p>
                    <p className="text-[11px] font-bold text-muted-foreground mt-3">الخانات الظاهرة = خمنت الرقم الصحيح في مكانها</p>
                </div>

                <div className="flex-1 flex flex-col gap-4 max-w-md mx-auto w-full">
                    <div className="text-center mb-2">
                        <p className="font-black text-sm">{gs.current_turn === userId ? 'دورك الآن: ' : `دور ${partnerInfo?.name}: `}خمّن رقم شريكك ({L} خانات)</p>
                        {gs.current_turn !== userId && (
                            <motion.span 
                                animate={{ opacity: [0.4, 1, 0.4] }} 
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="text-[10px] text-indigo-500 font-bold"
                            >
                                بانتظار الشريك يحزر...
                            </motion.span>
                        )}
                    </div>
                    <input
                        inputMode="numeric"
                        disabled={gs.current_turn !== userId}
                        value={guessInput}
                        onChange={(e) => setGuessInput(e.target.value.replace(/\D/g, '').slice(0, L))}
                        placeholder={Array(L).fill('•').join('')}
                        className={`w-full h-14 rounded-2xl border-2 bg-card text-center text-2xl font-black tracking-[0.4em] outline-none transition-all ${
                            gs.current_turn === userId ? 'border-amber-500 shadow-lg shadow-amber-500/10' : 'border-border opacity-50 bg-muted/30'
                        }`}
                    />
                    <Button 
                        onClick={submitGuess} 
                        disabled={guessInput.length !== L || loading || gs.current_turn !== userId} 
                        className={`h-14 rounded-2xl font-black text-lg ${
                            gs.current_turn === userId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-muted text-muted-foreground'
                        }`}
                    >
                        {gs.current_turn === userId ? 'جرّب التخمين' : 'انتظر دورك'}
                    </Button>
                </div>
            </div>
        );
    }

    if (uiState === 'finished' && roomData) {
        const gs = roomData.game_state;
        const iWon = gs.winner === userId;
        const myNum = isHost ? gs.host_secret : gs.guest_secret;
        const partnerNum = isHost ? gs.guest_secret : gs.host_secret;

        return (
            <div dir="rtl" className="flex flex-col h-full bg-background items-center justify-center p-6 text-center overflow-y-auto">
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className={`w-24 h-24 rounded-[3rem] flex items-center justify-center mb-8 shadow-2xl ${iWon ? 'bg-amber-500 text-white' : 'bg-indigo-500 text-white'}`}
                >
                    {iWon ? <Trophy className="w-12 h-12" /> : <Sparkles className="w-12 h-12" />}
                </motion.div>

                <h2 className="text-3xl font-black mb-2">{iWon ? 'فزت! خمّنت الرقم 🏆' : `${partnerInfo?.name} فاز بالتحدي`}</h2>
                <p className="text-muted-foreground font-bold mb-10">رقم من {gs.digit_length} خانات</p>

                <div className="grid grid-cols-1 gap-4 w-full max-w-xs mb-10">
                    <div className="bg-card p-6 rounded-3xl border text-start">
                        <p className="text-[11px] font-black text-muted-foreground uppercase mb-2">رقمك</p>
                        <p className="text-3xl font-black text-amber-500 tracking-widest">{myNum}</p>
                    </div>
                    <div className="bg-indigo-500/5 p-6 rounded-3xl border border-indigo-500/10 text-start">
                        <p className="text-[11px] font-black text-indigo-500 uppercase mb-2">رقم الشريك</p>
                        <p className="text-3xl font-black text-indigo-600 tracking-widest">{partnerNum}</p>
                    </div>
                </div>

                <Button onClick={onBack} variant="secondary" className="w-full max-w-xs h-14 rounded-2xl font-black">
                    العودة للألعاب
                </Button>
            </div>
        );
    }

    return null;
}
