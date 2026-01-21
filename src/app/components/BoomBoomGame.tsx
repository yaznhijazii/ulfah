import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Copy, CheckCircle2, AlertTriangle, Bomb, Crown, RefreshCw, Hand, Ghost, Users, Play, ShieldCheck, Share2 } from 'lucide-react';
import { Button } from './ui/button';

interface BoomBoomGameProps {
    onBack: () => void;
    userId: string;
    userName: string;
    userAvatar?: string;
    isDarkMode?: boolean;
}

type GameState = 'menu' | 'lobby' | 'setup' | 'playing' | 'finished';

interface GridCell {
    id: number;
    isBoom: boolean;
    isRevealed: boolean;
    revealedBy?: string; // userId
}

interface RoomData {
    id: string;
    room_code: string;
    host_user_id: string;
    guest_user_id: string | null;
    status: string;
    grid_size: 6 | 9;
    turn: string | null; // userId
    winner: string | null; // userId
    host_grid: GridCell[];
    guest_grid: GridCell[];
    rematch_requests: string[];
}

export function BoomBoomGame({ onBack, userId, userName }: BoomBoomGameProps) {
    const [gameState, setGameState] = useState<GameState>('menu');
    const [roomCode, setRoomCode] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [myBooms, setMyBooms] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Audio effects (optional, placeholders)
    const playSound = (type: 'pop' | 'boom' | 'win') => {
        // Implementation for sound effects
    };

    // Presence / Realtime
    useEffect(() => {
        if (!roomData?.id) return;

        const channel = supabase
            .channel(`game_${roomData.id}`)
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomData.id}` },
                (payload) => {
                    const newData = payload.new as any;
                    // Parse necessary jsonb fields
                    const parsedState = typeof newData.game_state === 'string' ? JSON.parse(newData.game_state) : newData.game_state;

                    setRoomData(prev => ({
                        ...prev!,
                        ...newData,
                        ...parsedState
                    }));

                    // State transitions based on updates
                    if (newData.status === 'setup' && gameState === 'lobby') setGameState('setup');
                    if (newData.status === 'playing' && gameState === 'setup') setGameState('playing');
                    if (newData.status === 'finished' && gameState !== 'finished') setGameState('finished');
                    if (newData.status === 'setup' && gameState === 'finished') {
                        // Rematch started
                        setGameState('setup');
                        setMyBooms([]);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomData?.id, gameState]);

    const generateRoomCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return result;
    };

    const createRoom = async () => {
        setLoading(true);
        const code = generateRoomCode();

        const initialGridState = {
            host_grid: [],
            guest_grid: [],
            turn: null,
            winner: null,
            rematch_requests: []
        };

        const { data, error } = await supabase
            .from('game_rooms')
            .insert({
                room_code: code,
                game_type: 'boom-boom',
                host_user_id: userId,
                status: 'waiting',
                game_state: initialGridState,
                grid_size: 6 // default
            })
            .select()
            .single();

        if (error) {
            console.error('Create Room Error:', error);
            setError(`تعذر إنشاء الغرفة: ${error.message || 'خطأ غير معروف'}`);
            setLoading(false);
            return;
        }

        setRoomData({
            id: data.id,
            room_code: data.room_code,
            host_user_id: data.host_user_id,
            guest_user_id: null,
            status: data.status,
            grid_size: 6,
            ...initialGridState
        });
        setGameState('lobby');
        setLoading(false);
    };

    const joinRoom = async () => {
        if (!joinCode) return;
        setLoading(true);

        // Find room
        const { data: rooms, error: searchError } = await supabase
            .from('game_rooms')
            .select('*')
            .eq('room_code', joinCode.toUpperCase())
            .eq('status', 'waiting')
            .single();

        if (searchError || !rooms) {
            setError('الغرفة غير موجودة أو انتهت اللعبة فيها.');
            setLoading(false);
            return;
        }

        // Join room
        const { data: updatedRoom, error: joinError } = await supabase
            .from('game_rooms')
            .update({
                guest_user_id: userId,
                status: 'setup' // Move straight to setup once guest joins
            })
            .eq('id', rooms.id)
            .select()
            .single();

        if (joinError) {
            setError('تعذر الانضمام للغرفة.');
            setLoading(false);
            return;
        }

        const parsedState = updatedRoom.game_state;
        setRoomData({
            id: updatedRoom.id,
            room_code: updatedRoom.room_code,
            host_user_id: updatedRoom.host_user_id,
            guest_user_id: updatedRoom.guest_user_id,
            status: updatedRoom.status,
            grid_size: updatedRoom.grid_size,
            ...parsedState
        });
        setGameState('setup');
        setLoading(false);
    };

    const updateGridSize = async (size: 6 | 9) => {
        if (!roomData) return;
        await supabase
            .from('game_rooms')
            .update({ grid_size: size })
            .eq('id', roomData.id);
    };

    const confirmSetup = async () => {
        if (!roomData) return;

        const isHost = userId === roomData.host_user_id;
        const myGrid: GridCell[] = Array(roomData.grid_size).fill(null).map((_, i) => ({
            id: i,
            isBoom: myBooms.includes(i),
            isRevealed: false
        }));

        const updateKey = isHost ? 'host_grid' : 'guest_grid';
        const otherGrid = isHost ? roomData.guest_grid : roomData.host_grid;

        // Check if both are ready
        const isOpponentReady = otherGrid && otherGrid.length > 0;
        const nextStatus = isOpponentReady ? 'playing' : 'setup';
        const nextTurn = isOpponentReady ? roomData.host_user_id : null; // Host starts

        const newGameState = {
            ...roomData, // keep existing state props
            [updateKey]: myGrid,
            ...(isOpponentReady ? { turn: roomData.host_user_id } : {})
        };

        // Separate table columns update vs JSON update
        await supabase
            .from('game_rooms')
            .update({
                game_state: newGameState,
                status: nextStatus
            })
            .eq('id', roomData.id);

        // Local Optimistic Update
        setRoomData({
            ...roomData,
            [isHost ? 'host_grid' : 'guest_grid']: myGrid,
            status: nextStatus,
            turn: nextTurn
        } as RoomData);
    };

    const handleCellClick = async (cellIndex: number) => {
        if (!roomData || roomData.status !== 'playing') return;
        if (roomData.turn !== userId) return;

        const isHost = userId === roomData.host_user_id;
        const targetGridKey = isHost ? 'guest_grid' : 'host_grid';
        const targetGrid = isHost ? [...roomData.guest_grid] : [...roomData.host_grid];

        if (targetGrid[cellIndex].isRevealed) return;

        // Reveal logic
        targetGrid[cellIndex].isRevealed = true;
        targetGrid[cellIndex].revealedBy = userId;

        const isBoom = targetGrid[cellIndex].isBoom;

        // Game Over Logic
        // Win condition 1: Lose if you find all BOOMS (Wait, prompt says "Find all booms -> LOSE"? Usually finding booms makes you lose if they explode. 
        // Prompt says: "اللي يلاقي كل بومات الطرف الثاني أول واحد → يخسر" (Who finds all opponent's booms first -> LOSES).
        // "اللي يلاقي كل المكعبات الآمنة أول → يربح" (Who finds all safe cubes first -> WINS).
        // OK, so: Safe cells are the goal. Booms are bad? Or Booms are just obstacles?
        // Wait, "Who finds all booms first -> LOSES". This implies finding a boom is permanent count towards losing.

        // Let's count
        const totalBooms = targetGrid.filter(c => c.isBoom).length;
        const totalSafe = targetGrid.length - totalBooms;

        const myRevealedBooms = targetGrid.filter(c => c.isRevealed && c.isBoom).length;
        const myRevealedSafe = targetGrid.filter(c => c.isRevealed && !c.isBoom).length;

        let winner = null;
        let status = 'playing';

        if (myRevealedBooms === totalBooms) {
            // Found all booms => LOSE. So opponent wins.
            winner = isHost ? roomData.guest_user_id : roomData.host_user_id;
            status = 'finished';
        } else if (myRevealedSafe === totalSafe) {
            // Found all safe cells => WIN.
            winner = userId;
            status = 'finished';
        }

        // Switch turn
        const nextTurn = isHost ? roomData.guest_user_id : roomData.host_user_id;

        const newGameState = {
            ...roomData,
            [targetGridKey]: targetGrid,
            turn: nextTurn,
            winner: winner
        };

        await supabase
            .from('game_rooms')
            .update({
                game_state: newGameState,
                status: status
            })
            .eq('id', roomData.id);
    };

    const requestRematch = async () => {
        if (!roomData) return;
        const isHost = userId === roomData.host_user_id;

        // Add me to rematch requests
        const currentRequests = roomData.rematch_requests || [];
        if (currentRequests.includes(userId)) return;

        const newRequests = [...currentRequests, userId];

        // If both requested, restart
        if (newRequests.length >= 2) {
            // Reset Game
            const initialGridState = {
                host_grid: [],
                guest_grid: [],
                turn: null,
                winner: null,
                rematch_requests: []
            };

            await supabase
                .from('game_rooms')
                .update({
                    game_state: initialGridState,
                    status: 'setup'
                })
                .eq('id', roomData.id);
        } else {
            await supabase
                .from('game_rooms')
                .update({
                    game_state: { ...roomData, rematch_requests: newRequests }
                })
                .eq('id', roomData.id);
        }
    };

    // RENDER HELPERS
    const isMyTurn = roomData?.turn === userId;
    const isHost = roomData?.host_user_id === userId;
    const opponentGrid = isHost ? roomData?.guest_grid : roomData?.host_grid;
    const myGrid = isHost ? roomData?.host_grid : roomData?.guest_grid;

    // --- SCREEN RENDERERS ---

    if (gameState === 'menu') {
        return (
            <div className="flex flex-col h-full bg-background p-6">
                <div className="flex items-center gap-4 mb-10">
                    <Button variant="ghost" className="w-12 h-12 rounded-full p-0" onClick={onBack}>
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                    <h1 className="text-3xl font-black">بوم بوم! 💣</h1>
                </div>

                <div className="flex-1 flex flex-col justify-center gap-6">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-primary/10 rounded-[2.5rem] p-8 text-center border-2 border-primary/20"
                    >
                        <div className="w-20 h-20 bg-primary text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/30 rotate-3">
                            <Bomb className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-black mb-2">لعبة مفرقعة</h2>
                        <p className="text-muted-foreground font-bold text-sm mb-8">حط بوماتك بذكاء، ولاقي الأمان عند شريكك!</p>

                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="bg-destructive/10 text-destructive text-sm font-bold p-3 rounded-xl mb-4 border border-destructive/20"
                                >
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <Button onClick={createRoom} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black shadow-lg shadow-primary/20 mb-4">
                            {loading ? 'ثواني..' : 'إنشاء غرفة جديدة +'}
                        </Button>
                    </motion.div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground font-black">أو</span></div>
                    </div>

                    <div className="space-y-4">
                        <input
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="أدخل كود الغرفة (مثلاً ABCD12)"
                            className="w-full h-16 rounded-2xl bg-muted/50 border-2 border-border px-6 text-center text-xl font-black tracking-widest uppercase focus:border-primary focus:ring-4 ring-primary/10 transition-all outline-none"
                            maxLength={6}
                        />
                        <Button onClick={joinRoom} disabled={!joinCode || loading} variant="secondary" className="w-full h-16 rounded-2xl text-lg font-black">
                            {loading ? 'جاري الدخول..' : 'انضمام للعبة'}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (gameState === 'lobby') {
        return (
            <div className="flex flex-col h-full bg-background p-6 pt-12 items-center text-center">
                <h2 className="text-2xl font-black mb-2">غرفة الانتظار ⏳</h2>
                <p className="text-muted-foreground font-bold text-sm mb-12">شارك الكود مع شريكك لتبدأوا</p>

                <div className="bg-card w-full max-w-xs rounded-[2.5rem] p-8 border-2 border-dashed border-primary/30 relative mb-12">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">كود الغرفة</p>
                    <p className="text-4xl font-black tracking-widest text-foreground">{roomData?.room_code}</p>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="absolute bottom-4 right-4 text-primary hover:bg-primary/10"
                        onClick={() => navigator.clipboard.writeText(roomData?.room_code || '')}
                    >
                        <Copy className="w-5 h-5" />
                    </Button>
                </div>

                <div className="space-y-4 w-full max-w-xs">
                    <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-2xl border border-border">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-black">{userName[0]}</div>
                        <div className="text-right flex-1">
                            <p className="font-bold text-sm">أنت ({userName})</p>
                            <p className="text-[10px] text-emerald-500 font-black flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> جاهز</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-2xl border border-border opacity-50">
                        <div className="w-10 h-10 rounded-full bg-muted-foreground/20 flex items-center justify-center text-muted-foreground"><Users className="w-5 h-5" /></div>
                        <div className="text-right flex-1">
                            <p className="font-bold text-sm">بانتظار الشريك...</p>
                        </div>
                    </div>

                    {roomData?.host_user_id === userId && (
                        <div className="pt-8">
                            <p className="text-xs text-muted-foreground font-bold mb-4">اختر حجم الشبكة:</p>
                            <div className="flex gap-4 justify-center">
                                <button onClick={() => updateGridSize(6)} className={`px-6 py-3 rounded-xl border-2 font-black transition-all ${roomData?.grid_size === 6 ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>6 مكعبات</button>
                                <button onClick={() => updateGridSize(9)} className={`px-6 py-3 rounded-xl border-2 font-black transition-all ${roomData?.grid_size === 9 ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>9 مكعبات</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (gameState === 'setup') {
        const gridSize = roomData?.grid_size || 6;
        const maxBooms = gridSize === 6 ? 3 : 5;
        const currentBooms = myBooms.length;
        const isReady = currentBooms === maxBooms;

        // Wait for opponent
        const opponentGrid = isHost ? roomData?.guest_grid : roomData?.host_grid;
        const myGrid = isHost ? roomData?.host_grid : roomData?.guest_grid;

        const isOpponentReady = (opponentGrid && opponentGrid.length > 0) || false;
        const hasIConfirmed = (myGrid && myGrid.length > 0) || false;

        if (hasIConfirmed) {
            return (
                <div className="flex flex-col h-full bg-background items-center justify-center p-6 text-center">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-6"
                    >
                        <ShieldCheck className="w-12 h-12" />
                    </motion.div>
                    <h2 className="text-2xl font-black mb-2">تم تثبيت بوماتك! ✅</h2>
                    <p className="text-muted-foreground font-bold">بانتظار الشريك يخلص تفخيخ...</p>
                </div>
            );
        }

        return (
            <div className="flex flex-col h-full bg-background p-6 pt-10">
                <header className="text-center mb-10">
                    <h2 className="text-2xl font-black">أين نخبئ البومات؟ 🤫</h2>
                    <p className="text-muted-foreground font-bold text-sm">اختر {maxBooms} أماكن سرية واضغط تأكيد</p>
                </header>

                <div className="flex-1 flex flex-col items-center justify-center">
                    <div
                        className="grid gap-3 w-full max-w-sm mx-auto"
                        style={{ gridTemplateColumns: `repeat(3, 1fr)` }}
                    >
                        {Array.from({ length: gridSize }).map((_, i) => (
                            <motion.button
                                key={i}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => {
                                    if (myBooms.includes(i)) {
                                        setMyBooms(old => old.filter(b => b !== i));
                                    } else if (myBooms.length < maxBooms) {
                                        setMyBooms(old => [...old, i]);
                                    }
                                }}
                                className={`aspect-square rounded-2xl flex items-center justify-center text-3xl transition-all shadow-sm ${myBooms.includes(i)
                                    ? 'bg-rose-500 text-white shadow-rose-500/30'
                                    : 'bg-card border-2 border-border/50 hover:border-primary/50'
                                    }`}
                            >
                                {myBooms.includes(i) && <Bomb className="w-8 h-8 animate-pulse" />}
                            </motion.button>
                        ))}
                    </div>
                </div>

                <div className="pt-8">
                    <Button
                        disabled={!isReady}
                        onClick={confirmSetup}
                        className="w-full h-16 rounded-2xl text-lg font-black shadow-lg shadow-primary/20"
                    >
                        {isReady ? 'جاهز! ابدأ اللعب 🔥' : `باقي ${maxBooms - currentBooms} بومات`}
                    </Button>
                </div>
            </div>
        );
    }

    if (gameState === 'playing') {
        return (
            <div className="flex flex-col h-full bg-background p-5 pt-8">
                {/* Header Info */}
                <div className="flex items-center justify-between mb-8 bg-card p-4 rounded-3xl border border-border shadow-sm">
                    <div className={`flex items-center gap-3 ${isMyTurn ? 'opacity-100' : 'opacity-50 grayscale'}`}>
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-xs font-black">أنا</div>
                        <div className="text-right">
                            <p className="text-[10px] uppercase font-black text-muted-foreground">دورك</p>
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                    </div>
                    <div className="bg-muted px-4 py-2 rounded-xl text-xs font-black">
                        {isMyTurn ? 'دورك الآن' : 'دور الشريك'}
                    </div>
                    <div className={`flex items-center gap-3 flex-row-reverse ${!isMyTurn ? 'opacity-100' : 'opacity-50 grayscale'}`}>
                        <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-black">هو</div>
                        <div className="text-right">
                            <p className="text-[10px] uppercase font-black text-muted-foreground">دوره</p>
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col gap-8 overflow-y-auto pb-4">
                    {/* Opponent Grid (Target) */}
                    <div>
                        <h3 className="text-center font-black mb-4 flex items-center justify-center gap-2">
                            <Ghost className="w-4 h-4 text-indigo-500" /> منطقة الخصم (اضرب هنا)
                        </h3>
                        <div
                            className="grid gap-3 w-full max-w-sm mx-auto"
                            style={{ gridTemplateColumns: `repeat(3, 1fr)` }}
                        >
                            {opponentGrid?.map((cell, i) => (
                                <motion.button
                                    key={i}
                                    whileTap={{ scale: 0.95 }}
                                    disabled={!isMyTurn || cell.isRevealed}
                                    onClick={() => handleCellClick(i)}
                                    className={`aspect-square rounded-2xl flex items-center justify-center text-2xl transition-all shadow-sm relative overflow-hidden ${cell.isRevealed
                                        ? (cell.isBoom ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white')
                                        : 'bg-card border-2 border-dashed border-border hover:border-primary cursor-pointer'
                                        }`}
                                >
                                    {cell.isRevealed && (
                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                            {cell.isBoom ? <Bomb className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
                                        </motion.div>
                                    )}
                                    {!cell.isRevealed && isMyTurn && (
                                        <div className="absolute inset-0 bg-primary/5 opacity-0 hover:opacity-100 transition-opacity" />
                                    )}
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    <div className="w-full h-px bg-border/50" />

                    {/* My Grid (Status) */}
                    <div className="opacity-80 scale-90 origin-top">
                        <h3 className="text-center font-black mb-4 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                            <ShieldCheck className="w-4 h-4" /> منطقتي (محاولاته)
                        </h3>
                        <div
                            className="grid gap-3 w-full max-w-sm mx-auto pointer-events-none"
                            style={{ gridTemplateColumns: `repeat(3, 1fr)` }}
                        >
                            {myGrid?.map((cell, i) => (
                                <div
                                    key={i}
                                    className={`aspect-square rounded-2xl flex items-center justify-center text-xl transition-all shadow-sm ${cell.isRevealed
                                        ? (cell.isBoom ? 'bg-rose-500/20 text-rose-500 border-2 border-rose-500' : 'bg-emerald-500/20 text-emerald-500 border-2 border-emerald-500')
                                        : (cell.isBoom ? 'bg-primary/20 border-2 border-primary/30' : 'bg-muted/10 border-2 border-border/30')
                                        }`}
                                >
                                    {/* Show my booms to me, and hits */}
                                    {cell.isBoom && !cell.isRevealed && <Bomb className="w-5 h-5 opacity-40" />}
                                    {cell.isRevealed && (cell.isBoom ? <Bomb className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />)}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (gameState === 'finished') {
        const iWon = roomData?.winner === userId;
        const opponentRematch = roomData?.rematch_requests?.some(id => id !== userId);
        const iRequestedRematch = roomData?.rematch_requests?.includes(userId);

        return (
            <div className="flex flex-col h-full bg-background items-center justify-center p-6 text-center">
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className={`w-32 h-32 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl ${iWon ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}
                >
                    {iWon ? <Crown className="w-16 h-16" /> : <Ghost className="w-16 h-16" />}
                </motion.div>

                <h2 className="text-4xl font-black mb-2">{iWon ? 'مبروك الفوز! 🎉' : 'حظ أوفر! 😅'}</h2>
                <p className="text-muted-foreground font-bold mb-12 max-w-[200px] mx-auto">
                    {iWon ? 'لقد نجوت بذكاء وكشفت كل الألغام!' : 'لقد وقعت في الفخ.. هل تنتقم؟'}
                </p>

                <div className="w-full space-y-4">
                    <Button
                        onClick={requestRematch}
                        disabled={iRequestedRematch}
                        className="w-full h-16 rounded-2xl text-lg font-black shadow-lg"
                    >
                        <RefreshCw className={`w-5 h-5 ml-2 ${iRequestedRematch ? 'animate-spin' : ''}`} />
                        {iRequestedRematch ? 'بانتظار الشريك...' : 'لعبة جديدة'}
                    </Button>

                    <Button variant="ghost" onClick={onBack} className="w-full h-14 rounded-2xl font-black">
                        خروج للقائمة
                    </Button>

                    {opponentRematch && !iRequestedRematch && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-xs font-black"
                        >
                            الشريك يريد اللعب مرة أخرى! ⚡
                        </motion.div>
                    )}
                </div>
            </div>
        );
    }

    return null;
}
