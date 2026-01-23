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
    const [isAIMode, setIsAIMode] = useState(false);
    const [presence, setPresence] = useState<any>({});

    // Audio effects (optional, placeholders)
    const playSound = (type: 'pop' | 'boom' | 'win') => {
        // Implementation for sound effects
    };

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
                        ...parsedState
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

    // Sync gameState with roomData status and detect AI Mode
    useEffect(() => {
        if (roomData?.status) {
            let status = roomData.status as string;
            if (status === 'waiting') status = 'lobby';

            // Critical check: if there is a winner, it's finished
            if (roomData.winner) status = 'finished';

            if (status !== gameState) {
                // Reset local selections if we are entering setup (rematch)
                if (status === 'setup') {
                    setMyBooms([]);
                }
                setGameState(status as GameState);
            }
        }
        // Recover AI mode from database state
        if (roomData && (roomData as any).isAIMode !== undefined) {
            if (isAIMode !== (roomData as any).isAIMode) {
                setIsAIMode((roomData as any).isAIMode);
            }
        }
    }, [roomData?.status, (roomData as any)?.isAIMode, gameState, roomData?.winner]);

    const generateRoomCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return result;
    };

    const createRoom = async (withAI = false) => {
        setLoading(true);
        setIsAIMode(withAI);
        const code = generateRoomCode();

        const initialGridState = {
            host_grid: [],
            guest_grid: [],
            turn: null,
            winner: null,
            rematch_requests: [],
            isAIMode: withAI
        };

        const { data, error } = await supabase
            .from('game_rooms')
            .insert({
                room_code: code,
                game_type: 'boom-boom',
                host_user_id: userId,
                guest_user_id: withAI ? null : null,
                status: withAI ? 'setup' : 'waiting',
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
        setGameState(withAI ? 'setup' : 'lobby');
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
            .eq('game_type', 'boom-boom')
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
                status: 'setup',
                updated_at: new Date().toISOString()
            })
            .eq('id', rooms.id)
            .select()
            .single();

        if (joinError) {
            setError('تعذر الانضمام للغرفة.');
            setLoading(false);
            return;
        }

        const parsedState = typeof updatedRoom.game_state === 'string'
            ? JSON.parse(updatedRoom.game_state)
            : updatedRoom.game_state;

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
        setLoading(true);

        try {
            // Fetch LATEST state to avoid race conditions (overwriting partner's grid)
            const { data: latestRoom, error: fetchError } = await supabase
                .from('game_rooms')
                .select('*')
                .eq('id', roomData.id)
                .single();

            if (fetchError || !latestRoom) throw fetchError || new Error('Room not found');

            const latestState = typeof latestRoom.game_state === 'string'
                ? JSON.parse(latestRoom.game_state)
                : latestRoom.game_state;

            const isHost = userId === latestRoom.host_user_id;
            const myGrid: GridCell[] = Array(latestRoom.grid_size).fill(null).map((_, i) => ({
                id: i,
                isBoom: myBooms.includes(i),
                isRevealed: false
            }));

            const updateKey = isHost ? 'host_grid' : 'guest_grid';
            const otherGridKey = isHost ? 'guest_grid' : 'host_grid';

            // Check latest data for other grid
            let otherGrid = latestState[otherGridKey];

            // If AI mode, create AI grid automatically
            let aiGrid: GridCell[] | null = null;
            if (isAIMode && isHost) {
                const maxBooms = latestRoom.grid_size === 6 ? 3 : 5;
                const aiBooms: number[] = [];
                while (aiBooms.length < maxBooms) {
                    const random = Math.floor(Math.random() * latestRoom.grid_size);
                    if (!aiBooms.includes(random)) aiBooms.push(random);
                }
                aiGrid = Array(latestRoom.grid_size).fill(null).map((_, i) => ({
                    id: i,
                    isBoom: aiBooms.includes(i),
                    isRevealed: false
                }));
                otherGrid = aiGrid;
            }

            // Check if both are ready using LATEST information
            const isOpponentReady = (otherGrid && otherGrid.length > 0);
            const nextStatus = isOpponentReady ? 'playing' : 'setup';

            const newGameState = {
                ...latestState,
                [updateKey]: myGrid,
                ...(aiGrid ? { guest_grid: aiGrid, isAIMode: true } : {}),
                ...(isOpponentReady ? { turn: latestRoom.host_user_id } : {})
            };

            const { error: updateError } = await supabase
                .from('game_rooms')
                .update({
                    game_state: newGameState,
                    status: nextStatus
                })
                .eq('id', latestRoom.id);

            if (updateError) throw updateError;

            // Local Optimistic Update
            setRoomData({
                ...latestRoom,
                ...newGameState,
                status: nextStatus
            } as RoomData);

            if (nextStatus === 'playing') {
                setGameState('playing');
            }

        } catch (err: any) {
            console.error('Setup Confirmation Error:', err);
            setError('فشل في بدء اللعبة. حاول مرة أخرى.');
        } finally {
            setLoading(false);
        }
    };



    const makeAIMove = async () => {
        if (!roomData || !isAIMode) return;
        if (roomData.status !== 'playing') return;

        // AI plays as guest (black)
        const targetGrid = [...roomData.host_grid];
        const unrevealedCells = targetGrid
            .map((cell, idx) => ({ cell, idx }))
            .filter(({ cell }) => !cell.isRevealed);

        if (unrevealedCells.length === 0) return;

        // Random pick
        const randomCell = unrevealedCells[Math.floor(Math.random() * unrevealedCells.length)];
        const cellIndex = randomCell.idx;

        targetGrid[cellIndex].isRevealed = true;
        targetGrid[cellIndex].revealedBy = 'AI';

        const totalBooms = targetGrid.filter(c => c.isBoom).length;
        const totalSafe = targetGrid.length - totalBooms;
        const aiRevealedBooms = targetGrid.filter(c => c.isRevealed && c.isBoom).length;
        const aiRevealedSafe = targetGrid.filter(c => c.isRevealed && !c.isBoom).length;

        let winner = null;
        let status = 'playing';

        if (aiRevealedBooms === totalBooms) {
            winner = userId; // AI loses, you win
            status = 'finished';
        } else if (aiRevealedSafe === totalSafe) {
            winner = null; // AI wins
            status = 'finished';
        }

        const newGameState = {
            ...roomData,
            host_grid: targetGrid,
            turn: userId,
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

    // AI auto-move
    useEffect(() => {
        if (isAIMode && roomData?.turn !== userId && roomData?.status === 'playing' && !roomData?.winner) {
            const timer = setTimeout(() => {
                makeAIMove();
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [roomData?.turn, isAIMode, roomData?.status]);

    const handleCellClick = async (cellIndex: number) => {
        if (!roomData || roomData.status !== 'playing') return;
        if (roomData.turn !== userId) return;

        const isHost = userId === roomData.host_user_id;
        // If I am host, I hit the guest_grid. If I am guest, I hit host_grid.
        const targetGridKey = isHost ? 'guest_grid' : 'host_grid';
        const targetGrid = isHost ? [...roomData.guest_grid] : [...roomData.host_grid];

        // Logic: Deep clone the specific cell to avoid state mutation
        targetGrid[cellIndex] = { ...targetGrid[cellIndex], isRevealed: true, revealedBy: userId };

        const isBoom = targetGrid[cellIndex].isBoom;
        const totalBooms = targetGrid.filter(c => c.isBoom).length;
        const totalSafe = targetGrid.length - totalBooms;

        const myRevealedBooms = targetGrid.filter(c => c.isRevealed && c.isBoom).length;
        const myRevealedSafe = targetGrid.filter(c => c.isRevealed && !c.isBoom).length;

        let winner = null;
        let status = 'playing';

        if (myRevealedBooms === totalBooms) {
            winner = isHost ? roomData.guest_user_id : roomData.host_user_id;
            status = 'finished';
        } else if (myRevealedSafe === totalSafe) {
            winner = userId;
            status = 'finished';
        }

        // Correct next turn logic: use the value from roomData if component state might be stale
        const effectiveAIMode = isAIMode || (roomData as any).isAIMode;
        const nextTurn = winner ? null : (effectiveAIMode ? 'AI' : (isHost ? roomData.guest_user_id : roomData.host_user_id));

        const newGameState = {
            ...roomData,
            [targetGridKey]: targetGrid,
            turn: nextTurn,
            winner: winner
        };

        // Optimistic Update
        setRoomData(newGameState as any);
        if (status === 'finished') setGameState('finished');

        const { error: updateError } = await supabase
            .from('game_rooms')
            .update({
                game_state: newGameState,
                status: status
            })
            .eq('id', roomData.id);

        if (updateError) {
            console.error('Update Cell Error:', updateError);
            setError('تعذر تحديث اللعبة. تأكد من اتصال الإنترنت.');
        }
    };

    const requestRematch = async () => {
        if (!roomData) return;
        const isHost = userId === roomData.host_user_id;

        // Add me to rematch requests
        const currentRequests = roomData.rematch_requests || [];
        if (currentRequests.includes(userId)) return;

        const newRequests = [...currentRequests, userId];

        // Optimistic update for local UI
        setRoomData({ ...roomData, rematch_requests: newRequests } as any);

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
                <div className="flex-1 flex flex-col justify-center gap-6 pb-20">
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

                        <div className="space-y-3">
                            <Button onClick={() => createRoom(false)} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black shadow-lg shadow-primary/20">
                                {loading ? 'ثواني..' : '🎮 لعب مع شريكي'}
                            </Button>
                            <Button onClick={() => createRoom(true)} disabled={loading} variant="secondary" className="w-full h-16 rounded-2xl text-lg font-black shadow-lg">
                                {loading ? 'ثواني..' : '🤖 لعب مع الكمبيوتر'}
                            </Button>
                        </div>
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
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <p className="text-[9px] text-emerald-500 font-black">متواجد بالروم</p>
                            </div>
                        </div>
                    </div>

                    <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${roomData?.guest_user_id ? 'bg-muted/30 border-border' : 'bg-muted/10 border-dashed border-border/50 opacity-50'}`}>
                        <div className="w-10 h-10 rounded-full bg-muted-foreground/20 flex items-center justify-center text-muted-foreground">
                            {roomData?.guest_user_id ? <Users className="w-5 h-5" /> : <Ghost className="w-5 h-5" />}
                        </div>
                        <div className="text-right flex-1">
                            <p className="font-bold text-sm">
                                {roomData?.guest_user_id ? 'الشريك' : 'بانتظار الشريك...'}
                            </p>
                            {(() => {
                                const partnerId = roomData?.host_user_id === userId ? roomData?.guest_user_id : roomData?.host_user_id;
                                const isPartnerInRoom = partnerId && presence[partnerId];
                                return (
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-2 h-2 rounded-full ${isPartnerInRoom ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                        <p className={`text-[9px] font-black ${isPartnerInRoom ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {isPartnerInRoom ? 'متواجد بالروم' : roomData?.guest_user_id ? 'غادر الروم' : '--'}
                                        </p>
                                    </div>
                                );
                            })()}
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

                    <div className="pt-10">
                        <Button
                            variant="ghost"
                            onClick={async () => {
                                setLoading(true);
                                const { data } = await supabase.from('game_rooms').select('*').eq('id', roomData?.id).single();
                                if (data) {
                                    const ps = typeof data.game_state === 'string' ? JSON.parse(data.game_state) : data.game_state;
                                    setRoomData({ ...roomData!, ...data, ...ps });
                                }
                                setLoading(false);
                            }}
                            className="text-[10px] font-black opacity-30 uppercase tracking-widest"
                        >
                            تحديث الحالة يدوياً
                        </Button>
                    </div>
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
                                className={`aspect-square rounded-2xl flex items-center justify-center text-3xl transition-all shadow-sm cursor-pointer ${myBooms.includes(i)
                                    ? 'bg-rose-500 text-white shadow-rose-500/30'
                                    : 'bg-card border-2 border-border/50 hover:border-primary/50 hover:bg-primary/5'
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
            <div className="flex flex-col h-full bg-background p-4 pt-4">
                {/* Header Info */}
                <div className="flex items-center justify-between mb-4 bg-card p-3 rounded-2xl border border-border shadow-sm">
                    <div className={`flex items-center gap-2 ${isMyTurn ? 'opacity-100' : 'opacity-50 grayscale'}`}>
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-black">أنا</div>
                        <div className="text-right">
                            <p className="text-[8px] uppercase font-black text-muted-foreground">أنا</p>
                            {isMyTurn && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                        </div>
                    </div>
                    <div className="bg-muted px-3 py-1.5 rounded-xl text-[10px] font-black min-w-[80px]">
                        {roomData?.winner ? 'انتهت اللعبة' : (isMyTurn ? 'دورك الآن' : 'دور الشريك')}
                    </div>
                    {(() => {
                        const partnerId = isHost ? roomData?.guest_user_id : roomData?.host_user_id;
                        const isPartnerInRoom = partnerId && presence[partnerId];
                        return (
                            <div className={`flex items-center gap-2 flex-row-reverse ${!isMyTurn ? 'opacity-100' : 'opacity-50 grayscale'}`}>
                                <div className="relative">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[10px] font-black">هو</div>
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${isPartnerInRoom ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                </div>
                                <div className="text-right">
                                    <p className="text-[8px] uppercase font-black text-muted-foreground">الشريك</p>
                                    {!isMyTurn && roomData?.status === 'playing' && !roomData.winner && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                <div className="flex-1 flex flex-col gap-4 overflow-y-auto pb-4 scrollbar-hide">
                    {/* Opponent Grid (Target) */}
                    <div>
                        <h3 className="text-center font-black mb-2 flex items-center justify-center gap-2 text-xs">
                            <Ghost className="w-3.5 h-3.5 text-indigo-500" /> منطقة الخصم (اضرب هنا)
                        </h3>
                        <div
                            className="grid gap-2 w-full max-w-[280px] mx-auto"
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
                    <div className="opacity-80 scale-[0.85] origin-top">
                        <h3 className="text-center font-black mb-2 flex items-center justify-center gap-2 text-muted-foreground text-[10px]">
                            <ShieldCheck className="w-3 h-3" /> منطقتي (محاولاته)
                        </h3>
                        <div
                            className="grid gap-2 w-full max-w-[280px] mx-auto pointer-events-none"
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
