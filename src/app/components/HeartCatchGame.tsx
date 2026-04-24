import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Heart, Bomb, Trophy, Play, RefreshCw, Star, Sparkles, Gamepad2 } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface HeartCatchGameProps {
    onBack: () => void;
    userId: string;
    userName: string;
    partnershipId: string | null;
    initialCode?: string;
}

type GameState = 'menu' | 'playing' | 'gameover';

interface FallingItem {
    id: number;
    x: number;
    y: number;
    type: 'heart' | 'bomb' | 'gold';
    speed: number;
}

export function HeartCatchGame({ onBack, userId, userName, partnershipId, initialCode }: HeartCatchGameProps) {
    const [gameState, setGameState] = useState<GameState>('menu');
    const [score, setScore] = useState(0);
    const [partnerScore, setPartnerScore] = useState(0);
    const [items, setItems] = useState<FallingItem[]>([]);
    const itemsRef = useRef<FallingItem[]>([]);
    const [bucketX, setBucketX] = useState(50); // percentage 0-100
    const bucketXRef = useRef(50);
    const [highScore, setHighScore] = useState(0);
    const [roomId, setRoomId] = useState<string | null>(null);
    const [playMode, setPlayMode] = useState<'partner' | 'bot'>('partner');

    const gameAreaRef = useRef<HTMLDivElement>(null);
    const requestRef = useRef<number | null>(null);
    const lastItemTime = useRef<number>(0);
    const scoreRef = useRef(0);

    // Invite Handling
    useEffect(() => {
        if (initialCode) {
            toast.success('تم الدخول للتحدي عبر الدعوة! 🔥');
            setPlayMode('partner');
        }
    }, [initialCode]);

    // Bot Logic
    useEffect(() => {
        if (gameState === 'playing' && playMode === 'bot') {
            const interval = setInterval(() => {
                setPartnerScore(prev => Math.max(0, prev + (Math.random() > 0.4 ? 10 : (Math.random() > 0.9 ? 50 : 0))));
            }, 800);
            return () => clearInterval(interval);
        }
    }, [gameState, playMode]);

    // Sync score to shared room
    useEffect(() => {
        if (!partnershipId || !userId) return;

        const setupRoom = async () => {
            // Find or create a long-lived room for this session
            const { data } = await supabase.from('game_rooms')
                .select('id, game_state')
                .eq('partnership_id', partnershipId)
                .eq('game_type', 'heart-catch')
                .eq('status', 'active')
                .maybeSingle();

            if (data) {
                setRoomId(data.id);
            } else {
                const { data: newRoom } = await supabase.from('game_rooms').insert({
                    partnership_id: partnershipId,
                    game_type: 'heart-catch',
                    host_user_id: userId,
                    status: 'active',
                    game_state: { [userId]: 0 }
                }).select().single();
                if (newRoom) setRoomId(newRoom.id);
            }
        };

        setupRoom();
    }, [partnershipId, userId]);

    // Realtime Score Sync
    useEffect(() => {
        if (!roomId) return;

        const channel = supabase
            .channel(`heart_catch_${roomId}`)
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` },
                (payload) => {
                    const state = payload.new.game_state;
                    const partnerId = Object.keys(state).find(id => id !== userId);
                    if (partnerId) setPartnerScore(state[partnerId]);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [roomId, userId]);

    const updateRemoteScore = useCallback(async (newScore: number) => {
        if (!roomId) return;
        const { data: room } = await supabase.from('game_rooms').select('game_state').eq('id', roomId).single();
        if (room) {
            const newState = { ...room.game_state, [userId]: newScore };
            await supabase.from('game_rooms').update({ game_state: newState }).eq('id', roomId);
        }
    }, [roomId, userId]);

    const startGame = (mode: 'partner' | 'bot') => {
        setPlayMode(mode);
        setScore(0);
        setPartnerScore(0);
        scoreRef.current = 0;
        setItems([]);
        itemsRef.current = [];
        setGameState('playing');
        lastItemTime.current = Date.now();
    };

    const endGame = () => {
        setGameState('gameover');
        if (scoreRef.current > highScore) setHighScore(scoreRef.current);
        updateRemoteScore(scoreRef.current);
    };

    // Main Game Loop
    const animate = useCallback((time: number) => {
        if (gameState !== 'playing') return;

        const now = Date.now();
        
        // Spawn new item
        if (now - lastItemTime.current > Math.max(400 - (scoreRef.current * 2), 150)) {
            const typeProb = Math.random();
            const type: FallingItem['type'] = typeProb > 0.85 ? 'bomb' : (typeProb < 0.1 ? 'gold' : 'heart');
            const newItem: FallingItem = {
                id: now,
                x: Math.random() * 90 + 5,
                y: -10,
                type,
                speed: Math.random() * 2 + 3 + (scoreRef.current / 50)
            };
            itemsRef.current.push(newItem);
            lastItemTime.current = now;
        }

        let hitBomb = false;
        const nextItems: FallingItem[] = [];

        // Move existing items and check collisions
        for (const item of itemsRef.current) {
            const newY = item.y + item.speed;
            
            // Collision check
            if (newY > 82 && newY < 92 && Math.abs(item.x - bucketXRef.current) < 12) {
                if (item.type === 'heart') scoreRef.current += 10;
                else if (item.type === 'gold') scoreRef.current += 50;
                else if (item.type === 'bomb') {
                    scoreRef.current = Math.max(0, scoreRef.current - 100);
                    hitBomb = true;
                }
                continue;
            }

            if (newY < 110) {
                nextItems.push({ ...item, y: newY });
            }
        }

        // Save back to ref and trigger render
        itemsRef.current = nextItems;
        setItems(nextItems);
        setScore(scoreRef.current);

        if (hitBomb) {
            toast.error('احذر! نبضات سلبية 💣', { id: 'bomb-toast' });
        }

        // Sync score occasionally
        if (Math.random() < 0.05) updateRemoteScore(scoreRef.current);

        requestRef.current = requestAnimationFrame(animate);
    }, [gameState, updateRemoteScore]);

    useEffect(() => {
        if (gameState === 'playing') {
            requestRef.current = requestAnimationFrame(animate);
        } else {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        }
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [gameState, animate]);

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (gameState !== 'playing' || !gameAreaRef.current) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const rect = gameAreaRef.current.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 100;
        const newX = Math.max(5, Math.min(95, x));
        setBucketX(newX);
        bucketXRef.current = newX;
    };

    return (
        <div dir="rtl" className="flex flex-col h-full bg-slate-950 text-white relative overflow-hidden select-none">
            
            {/* Background Polish */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-64 h-64 bg-rose-500/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px]" />
            </div>

            {/* Header / HUD */}
            <div className="z-10 px-8 py-5 flex justify-between items-center bg-black/50 backdrop-blur-xl border-b border-white/10 shadow-lg">
                <div className="flex flex-col">
                    <span className="text-[11px] font-black uppercase tracking-widest text-rose-400 mb-1">سكورك</span>
                    <span className="text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(244,63,94,0.5)]">{score}</span>
                </div>
                <div className="flex flex-col items-center">
                    <div className="w-14 h-14 rounded-[1.2rem] bg-gradient-to-b from-white/10 to-white/5 flex items-center justify-center border border-white/20 shadow-inner">
                        <Heart className="w-8 h-8 text-rose-500 fill-rose-500 animate-pulse drop-shadow-md" />
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[11px] font-black uppercase tracking-widest text-indigo-400 mb-1">
                        {playMode === 'bot' ? 'سكور لوفي 🤖' : 'سكور الشريك'}
                    </span>
                    <span className="text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]">{partnerScore}</span>
                </div>
            </div>

            {/* Game Area */}
            <div 
                ref={gameAreaRef}
                onMouseMove={handleMouseMove}
                onTouchMove={handleMouseMove}
                className="flex-1 relative overflow-hidden bg-gradient-to-b from-slate-900/50 to-rose-900/10 cursor-none"
            >
                {/* Visual grid effect */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

                {gameState === 'menu' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20">
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            className="w-full max-w-sm bg-zinc-950/80 backdrop-blur-2xl border border-white/10 p-8 rounded-[3rem] shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
                        >
                            <div className="w-24 h-24 bg-gradient-to-br from-rose-400 to-pink-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-rose-500/30 border border-white/20">
                                <Gamepad2 className="w-12 h-12 text-white" />
                            </div>
                            <h2 className="text-3xl font-black mb-3 text-white tracking-tight">صياد القلوب ❤️🎯</h2>
                            <p className="text-[13px] text-white/50 mb-8 font-bold leading-relaxed">
                                حرّك السلة ولُمّ القلوب من السما..<br/>وابعد عن القنابل عشان تظل "ألفة"!
                            </p>
                            <div className="flex flex-col gap-3">
                                <Button onClick={() => startGame('partner')} className="w-full h-16 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-lg font-black shadow-lg shadow-rose-500/30 border border-rose-400/50">
                                    لعب مع الشريك 👩‍❤️‍👨
                                </Button>
                                <Button onClick={() => startGame('bot')} className="w-full h-16 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-lg font-black shadow-md border border-white/5 text-white/80 transition-colors">
                                    لعب ضد لوفي 🤖
                                </Button>
                            </div>
                            <button onClick={onBack} className="mt-6 text-[12px] font-black text-white/30 hover:text-white/70 uppercase tracking-widest transition-colors">
                                عودة للقائمة
                            </button>
                        </motion.div>
                    </div>
                )}

                {gameState === 'playing' && (
                    <>
                        {items.map(item => (
                            <div 
                                key={item.id}
                                className="absolute pointer-events-none transition-all duration-75"
                                style={{ left: `${item.x}%`, top: `${item.y}%`, transform: 'translate(-50%, -50%)' }}
                            >
                                {item.type === 'heart' && <Heart className="w-8 h-8 text-rose-500 fill-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]" />}
                                {item.type === 'gold' && <Star className="w-10 h-10 text-amber-400 fill-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]" />}
                                {item.type === 'bomb' && <Bomb className="w-8 h-8 text-slate-400 drop-shadow-[0_0_8px_rgba(148,163,184,0.4)]" />}
                            </div>
                        ))}

                        {/* Player Bucket */}
                        <motion.div 
                            className="absolute bottom-10 h-6 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full shadow-[0_0_30px_rgba(244,63,94,0.4)] flex items-center justify-center border-t-2 border-white/30"
                            animate={{ left: `${bucketX}%` }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            style={{ width: '80px', transform: 'translateX(-50%)' }}
                        >
                            <div className="absolute -top-12">
                                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                                    <Sparkles className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        </motion.div>

                        {/* Top Danger Bar */}
                        <Button 
                            variant="ghost" 
                            onClick={endGame} 
                            className="absolute bottom-4 right-4 text-[10px] font-black uppercase text-white/20 hover:text-white/60"
                        >
                            إنهاء اللعب
                        </Button>
                    </>
                )}

                {gameState === 'gameover' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center z-20 bg-black/60 backdrop-blur-md">
                        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-6">
                            <div className="w-24 h-24 bg-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl rotate-12">
                                <Trophy className="w-12 h-12 text-white" />
                            </div>
                            <h2 className="text-4xl font-black text-white">جولة رهيبة! 👏</h2>
                            <p className="text-xl font-bold text-rose-400 bg-rose-500/10 px-6 py-2 rounded-full mx-auto inline-block border border-rose-500/20">جمعت {score} نقطة مودة</p>
                            {score > partnerScore ? (
                                <p className="text-[15px] font-black text-emerald-400">أنت حالياً متصدر! 🔥</p>
                            ) : (
                                <p className="text-[15px] font-black text-indigo-400">خصمك متقدم عليك.. شدّ حيلك! 💪</p>
                            )}
                            <div className="flex gap-4 pt-6">
                                <Button onClick={() => startGame(playMode)} className="flex-1 h-16 rounded-2xl bg-rose-500 hover:bg-rose-600 font-black text-lg border border-rose-400 shadow-lg shadow-rose-500/30">مرة ثانية؟</Button>
                                <Button onClick={onBack} variant="outline" className="flex-1 h-16 rounded-2xl border-white/10 bg-white/5 font-black text-lg">الرجوع</Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
    );
}
