import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Chess } from 'chess.js';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, CheckCircle2, RotateCcw, Users, Trophy, Copy, Bot } from 'lucide-react';
import { Button } from './ui/button';

interface ChessGameProps {
    onBack: () => void;
    userId: string;
    userName: string;
}

type GameState = 'menu' | 'lobby' | 'playing' | 'finished';

const PIECE_SYMBOLS: Record<string, string> = {
    'wp': '♟', 'wr': '♜', 'wn': '♞', 'wb': '♝', 'wq': '♛', 'wk': '♚',
    'bp': '♙', 'br': '♖', 'bn': '♘', 'bb': '♗', 'bq': '♕', 'bk': '♔'
};

export function ChessGame({ onBack, userId, userName }: ChessGameProps) {
    const [gameState, setGameState] = useState<GameState>('menu');
    const [joinCode, setJoinCode] = useState('');
    const [roomData, setRoomData] = useState<any>(null);
    const [currentFen, setCurrentFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const [board, setBoard] = useState<any[][]>([]);
    const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
    const [validMoves, setValidMoves] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isAIMode, setIsAIMode] = useState(false);

    // Update board whenever FEN changes
    useEffect(() => {
        const chess = new Chess(currentFen);
        setBoard(chess.board());
    }, [currentFen]);

    // Presence / Realtime
    useEffect(() => {
        if (!roomData?.id) return;

        const channel = supabase
            .channel(`game_${roomData.id}`)
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomData.id}` },
                (payload) => {
                    const newData = payload.new as any;
                    const parsedState = typeof newData.game_state === 'string' ? JSON.parse(newData.game_state) : newData.game_state;

                    setRoomData(prev => ({ ...prev, ...newData, game_state: parsedState }));

                    if (parsedState.fen) {
                        chess.load(parsedState.fen);
                        setBoard(chess.board());
                    }

                    // Load AI mode from game state
                    if (parsedState.isAIMode) setIsAIMode(true);

                    // Sync Status
                    if (newData.status === 'playing') {
                        setGameState('playing');
                    } else if (newData.status === 'ready' && gameState !== 'lobby') {
                        setGameState('lobby');
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

    const createRoom = async (withAI = false) => {
        setLoading(true);
        setIsAIMode(withAI);
        const code = generateRoomCode();

        const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        const initialState = {
            fen: initialFen,
            isAIMode: withAI
        };

        const { data, error } = await supabase.from('game_rooms').insert({
            room_code: code,
            game_type: 'chess',
            host_user_id: userId,
            guest_user_id: null,
            status: withAI ? 'playing' : 'waiting',
            game_state: initialState,
            grid_size: 6
        }).select().single();

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        setRoomData({ ...data, game_state: initialState });
        setCurrentFen(initialFen);
        setGameState(withAI ? 'playing' : 'lobby');
        setLoading(false);
    };

    const joinRoom = async () => {
        if (!joinCode) return;
        setLoading(true);

        const { data: rooms, error: searchError } = await supabase
            .from('game_rooms')
            .select('*')
            .eq('room_code', joinCode.toUpperCase())
            .eq('game_type', 'chess')
            .neq('status', 'finished')
            .single();

        if (searchError || !rooms) {
            setError('الغرفة غير موجودة');
            setLoading(false);
            return;
        }

        const { data: updatedRoom, error: joinError } = await supabase
            .from('game_rooms')
            .update({ guest_user_id: userId, status: 'ready' })
            .eq('id', rooms.id)
            .select().single();

        if (joinError) {
            setError('تعذر الانضمام');
            setLoading(false);
            return;
        }

        const parsedState = typeof updatedRoom.game_state === 'string'
            ? JSON.parse(updatedRoom.game_state)
            : updatedRoom.game_state;

        setRoomData({ ...updatedRoom, game_state: parsedState });
        if (parsedState.fen) {
            chess.load(parsedState.fen);
            setBoard(chess.board());
        }
        setGameState('lobby');
        setLoading(false);
    };

    const startGame = async () => {
        if (!roomData) return;
        await supabase.from('game_rooms').update({ status: 'playing' }).eq('id', roomData.id);
    };

    const makeAIMove = async () => {
        if (!roomData || !roomData.game_state) return;

        const chess = new Chess(currentFen);
        if (chess.turn() !== 'b' || !isAIMode) return;

        const moves = chess.moves();
        if (moves.length === 0) return;

        // Random AI move
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        chess.move(randomMove);

        const newState = {
            fen: chess.fen(),
            isAIMode: true
        };

        await supabase.from('game_rooms').update({
            game_state: newState,
            status: chess.isGameOver() ? 'finished' : 'playing'
        }).eq('id', roomData.id);

        setCurrentFen(chess.fen());
    };

    // AI auto-move
    useEffect(() => {
        const chess = new Chess(currentFen);
        if (isAIMode && chess.turn() === 'b' && roomData?.status === 'playing' && !chess.isGameOver()) {
            const timer = setTimeout(() => {
                makeAIMove();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [currentFen, isAIMode, roomData?.status]);

    const handleSquareClick = async (square: string) => {
        if (roomData?.status !== 'playing') return;

        const chess = new Chess(currentFen);
        const isHost = userId === roomData.host_user_id;
        const myColor = isHost ? 'w' : 'b';

        if (chess.turn() !== myColor) return;

        // If no piece selected
        if (!selectedSquare) {
            const piece = chess.get(square as any);
            if (piece && piece.color === myColor) {
                setSelectedSquare(square);
                const moves = chess.moves({ square: square as any, verbose: true });
                setValidMoves(moves.map(m => m.to));
            }
            return;
        }

        // If clicking same square - deselect
        if (selectedSquare === square) {
            setSelectedSquare(null);
            setValidMoves([]);
            return;
        }

        // Try to make move
        try {
            const move = chess.move({
                from: selectedSquare as any,
                to: square as any,
                promotion: 'q' // Always promote to queen
            });

            if (move) {
                setSelectedSquare(null);
                setValidMoves([]);

                const newState = {
                    fen: chess.fen(),
                    isAIMode: isAIMode
                };

                await supabase.from('game_rooms').update({
                    game_state: newState,
                    status: chess.isGameOver() ? 'finished' : 'playing'
                }).eq('id', roomData.id);

                setCurrentFen(chess.fen());
            } else {
                // Invalid move - try selecting new piece
                const piece = chess.get(square as any);
                if (piece && piece.color === myColor) {
                    setSelectedSquare(square);
                    const moves = chess.moves({ square: square as any, verbose: true });
                    setValidMoves(moves.map(m => m.to));
                }
            }
        } catch (e) {
            setSelectedSquare(null);
            setValidMoves([]);
        }
    };

    const resetGame = async () => {
        const chess = new Chess();
        const newState = {
            fen: chess.fen(),
            isAIMode: isAIMode
        };

        await supabase.from('game_rooms').update({
            game_state: newState,
            status: 'playing'
        }).eq('id', roomData.id);

        setCurrentFen(chess.fen());
    };

    // Render helpers
    const chess = new Chess(currentFen);
    const isHost = roomData?.host_user_id === userId;
    const myColor = isHost ? 'w' : 'b';
    const isMyTurn = chess.turn() === myColor;

    // Flip board for black
    const renderBoard = myColor === 'w' ? board : [...board].reverse().map(row => [...row].reverse());

    const squareToCoords = (displayRow: number, displayCol: number) => {
        // For white: display matches actual board
        // For black: board is flipped, so we need to reverse the mapping
        if (myColor === 'w') {
            const file = String.fromCharCode(97 + displayCol); // a-h
            const rank = 8 - displayRow; // 8-1
            return file + rank;
        } else {
            // Black sees flipped board, so reverse both row and col
            const file = String.fromCharCode(97 + (7 - displayCol)); // h-a
            const rank = displayRow + 1; // 1-8
            return file + rank;
        }
    };

    // UI
    if (gameState === 'menu') {
        return (
            <div className="flex flex-col h-full bg-background p-6">
                <div className="flex-1 flex flex-col justify-center gap-6 pb-20">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-foreground/5 rounded-[2.5rem] p-8 text-center border-2 border-foreground/10">
                        <div className="text-6xl mb-6">♚</div>
                        <h2 className="text-2xl font-black mb-2">تحدي الملوك</h2>
                        <p className="text-sm text-muted-foreground mb-6">شطرنج حقيقي بقواعد كاملة</p>
                        <div className="space-y-3">
                            <Button onClick={() => createRoom(false)} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black shadow-lg">
                                {loading ? '...' : '🎮 لعب مع شريكي'}
                            </Button>
                            <Button onClick={() => createRoom(true)} disabled={loading} variant="secondary" className="w-full h-16 rounded-2xl text-lg font-black shadow-lg">
                                {loading ? '...' : '🤖 لعب مع الكمبيوتر'}
                            </Button>
                        </div>
                    </motion.div>
                    <div className="space-y-4">
                        <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="كود الطاولة" className="w-full h-16 rounded-2xl bg-muted/50 border-2 border-border px-6 text-center text-xl font-black tracking-widest uppercase" maxLength={6} />
                        <Button onClick={joinRoom} disabled={!joinCode || loading} variant="secondary" className="w-full h-16 rounded-2xl text-lg font-black">{loading ? '...' : 'انضمام'}</Button>
                    </div>
                    {error && <p className="text-destructive font-bold text-center">{error}</p>}
                </div>
            </div>
        );
    }

    if (gameState === 'lobby') {
        const opponentJoined = !!roomData?.guest_user_id;

        return (
            <div className="flex flex-col h-full bg-background p-6 pt-12 items-center text-center">
                <h2 className="text-2xl font-black mb-2">غرفة الانتظار ⏳</h2>
                <div className="bg-card w-full max-w-xs rounded-[2.5rem] p-8 border-2 border-dashed border-primary/30 relative mb-12">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">كود الغرفة</p>
                    <p className="text-4xl font-black tracking-widest text-foreground">{roomData?.room_code}</p>
                    <Button size="icon" variant="ghost" className="absolute bottom-4 right-4 text-primary hover:bg-primary/10" onClick={() => navigator.clipboard.writeText(roomData?.room_code || '')}>
                        <Copy className="w-5 h-5" />
                    </Button>
                </div>

                <div className="w-full max-w-xs space-y-4 mb-8">
                    <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-2xl border border-border">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-black">أنا</div>
                        <div className="text-right flex-1">
                            <p className="font-bold text-sm">المضيف (أبيض)</p>
                            <p className="text-[10px] text-emerald-500 font-black flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> موجود</p>
                        </div>
                    </div>

                    <div className={`flex items-center gap-4 p-4 rounded-2xl border ${opponentJoined ? 'bg-muted/30 border-border' : 'bg-muted/10 border-dashed border-border/50 opacity-50'}`}>
                        <div className="w-10 h-10 rounded-full bg-muted-foreground flex items-center justify-center text-white font-black">
                            {opponentJoined ? (roomData?.game_state?.isAIMode ? '🤖' : 'هو') : '?'}
                        </div>
                        <div className="text-right flex-1">
                            <p className="font-bold text-sm">{opponentJoined ? (roomData?.game_state?.isAIMode ? 'الكمبيوتر (أسود)' : 'المنافس (أسود)') : 'بانتظار المنافس...'}</p>
                            {opponentJoined && <p className="text-[10px] text-emerald-500 font-black flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {roomData?.game_state?.isAIMode ? 'جاهز' : 'انضم'}</p>}
                        </div>
                    </div>
                </div>

                {isHost ? (
                    <Button disabled={!opponentJoined} onClick={startGame} className="w-full h-16 rounded-2xl text-lg font-black shadow-lg shadow-primary/20">
                        {opponentJoined ? 'ابدأ اللعب ⚔️' : 'ننتظر الخصم...'}
                    </Button>
                ) : (
                    <div className="animate-pulse font-black text-muted-foreground">بانتظار المضيف يبدأ اللعب... ⏳</div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 bg-card p-3 rounded-2xl border border-border shadow-sm">
                <div className={`flex items-center gap-2 ${isMyTurn ? 'opacity-100' : 'opacity-40'}`}>
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-black">أنا</div>
                    {isMyTurn && <span className="text-xs font-black text-primary animate-pulse">دورك!</span>}
                </div>
                <div className="text-xl font-black opacity-20">VS</div>
                <div className={`flex items-center gap-2 flex-row-reverse ${!isMyTurn ? 'opacity-100' : 'opacity-40'}`}>
                    <div className="w-8 h-8 rounded-full bg-muted-foreground flex items-center justify-center text-white text-xs font-black">{isAIMode ? '🤖' : 'هو'}</div>
                    {!isMyTurn && <span className="text-xs font-black text-muted-foreground">يفكر...</span>}
                </div>
            </div>

            {/* Board */}
            <div className="flex-1 flex items-center justify-center">
                <div className="grid grid-cols-8 gap-0.5 bg-[#403d39] p-1 rounded-lg shadow-2xl w-full max-w-[400px] aspect-square relative">
                    {chess.isGameOver() && (
                        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white rounded-lg">
                            <Trophy className="w-16 h-16 text-yellow-400 mb-4 animate-bounce" />
                            <h2 className="text-3xl font-black mb-4">
                                {chess.isCheckmate() ? (isMyTurn ? 'خسرت! 😅' : 'كسبت! 🎉') :
                                    chess.isDraw() ? 'تعادل! 🤝' : 'انتهت اللعبة'}
                            </h2>
                            <Button onClick={resetGame} size="sm" variant="secondary" className="font-black"><RotateCcw className="w-4 h-4 mr-2" /> لعب مجدداً</Button>
                        </div>
                    )}

                    {renderBoard.map((row, r) =>
                        row.map((piece, c) => {
                            const square = squareToCoords(r, c);
                            const isSelected = selectedSquare === square;
                            const isValidMove = validMoves.includes(square);
                            const isBlackSquare = (r + c) % 2 === 1;

                            return (
                                <div
                                    key={`${r}-${c}`}
                                    onClick={() => handleSquareClick(square)}
                                    className={`
                                        w-full h-full flex items-center justify-center text-3xl sm:text-4xl select-none cursor-pointer transition-colors relative
                                        ${isBlackSquare ? 'bg-[#b58863]' : 'bg-[#f0d9b5]'}
                                        ${isSelected ? 'ring-4 ring-inset ring-blue-500/50 bg-blue-400/30' : ''}
                                        ${isValidMove ? 'ring-2 ring-inset ring-green-500/50' : ''}
                                    `}
                                >
                                    {c === 0 && <span className={`absolute top-0.5 left-0.5 text-[8px] font-bold opacity-50 ${isBlackSquare ? 'text-[#f0d9b5]' : 'text-[#b58863]'}`}>{8 - r}</span>}
                                    {r === 7 && <span className={`absolute bottom-0 right-0.5 text-[8px] font-bold opacity-50 ${isBlackSquare ? 'text-[#f0d9b5]' : 'text-[#b58863]'}`}>{String.fromCharCode(97 + c)}</span>}

                                    {piece && (
                                        <motion.span
                                            initial={{ scale: 0.8 }}
                                            animate={{ scale: 1 }}
                                            className={`relative z-10 drop-shadow-sm ${piece.color === 'w' ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]' : 'text-black drop-shadow-[0_1px_0px_rgba(255,255,255,0.5)]'}`}
                                        >
                                            {PIECE_SYMBOLS[`${piece.color}${piece.type}`]}
                                        </motion.span>
                                    )}
                                    {isValidMove && !piece && <div className="w-3 h-3 rounded-full bg-green-500/50" />}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <div className="mt-4 flex justify-between">
                <Button variant="ghost" className="text-destructive font-bold text-xs" onClick={onBack}>خروج</Button>
                {isHost && <Button variant="ghost" className="text-muted-foreground font-bold text-xs" onClick={resetGame}><RotateCcw className="w-3 h-3 mr-1" /> إعادة اللوحة</Button>}
            </div>
        </div>
    );
}
