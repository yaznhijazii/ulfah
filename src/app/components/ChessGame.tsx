import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, CheckCircle2, RotateCcw, Users, Trophy, Copy } from 'lucide-react';
import { Button } from './ui/button';

interface ChessGameProps {
    onBack: () => void;
    userId: string;
    userName: string;
}

type GameState = 'menu' | 'lobby' | 'playing' | 'finished';

type PieceColor = 'w' | 'b';
type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
type Piece = { type: PieceType; color: PieceColor } | null;

const INITIAL_BOARD: Piece[][] = [
    [{ type: 'r', color: 'b' }, { type: 'n', color: 'b' }, { type: 'b', color: 'b' }, { type: 'q', color: 'b' }, { type: 'k', color: 'b' }, { type: 'b', color: 'b' }, { type: 'n', color: 'b' }, { type: 'r', color: 'b' }],
    [{ type: 'p', color: 'b' }, { type: 'p', color: 'b' }, { type: 'p', color: 'b' }, { type: 'p', color: 'b' }, { type: 'p', color: 'b' }, { type: 'p', color: 'b' }, { type: 'p', color: 'b' }, { type: 'p', color: 'b' }],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [{ type: 'p', color: 'w' }, { type: 'p', color: 'w' }, { type: 'p', color: 'w' }, { type: 'p', color: 'w' }, { type: 'p', color: 'w' }, { type: 'p', color: 'w' }, { type: 'p', color: 'w' }, { type: 'p', color: 'w' }],
    [{ type: 'r', color: 'w' }, { type: 'n', color: 'w' }, { type: 'b', color: 'w' }, { type: 'q', color: 'w' }, { type: 'k', color: 'w' }, { type: 'b', color: 'w' }, { type: 'n', color: 'w' }, { type: 'r', color: 'w' }],
];

const PIECE_SYMBOLS: Record<string, string> = {
    'wp': '♟', 'wr': '♜', 'wn': '♞', 'wb': '♝', 'wq': '♛', 'wk': '♚',
    'bp': '♙', 'br': '♖', 'bn': '♘', 'bb': '♗', 'bq': '♕', 'bk': '♔'
};

export function ChessGame({ onBack, userId, userName }: ChessGameProps) {
    const [gameState, setGameState] = useState<GameState>('menu');
    const [joinCode, setJoinCode] = useState('');
    const [roomData, setRoomData] = useState<any>(null);
    const [selectedSquare, setSelectedSquare] = useState<{ r: number, c: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Initial Board
    const [board, setBoard] = useState<Piece[][]>(INITIAL_BOARD);

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

                    setRoomData(prev => ({ ...prev, ...newData, ...parsedState }));

                    if (parsedState.board) setBoard(parsedState.board);

                    // Sync Status
                    if (newData.status === 'playing' && (gameState === 'lobby' || gameState === 'menu')) setGameState('playing');
                    if (newData.status === 'ready' && gameState === 'menu') setGameState('lobby');
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

        const initialState = {
            board: INITIAL_BOARD,
            turn: 'w', // White starts
            lastMove: null,
            winner: null
        };

        const { data, error } = await supabase.from('game_rooms').insert({
            room_code: code,
            game_type: 'chess',
            host_user_id: userId,
            status: 'waiting',
            game_state: initialState,
            grid_size: 6 // Not used for chess but column is required
        }).select().single();

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        setRoomData({ ...data, ...initialState });
        setGameState('lobby');
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
            .neq('status', 'finished') // Allow joining if waiting or ready
            .single();

        if (searchError || !rooms) {
            setError('الغرفة غير موجودة');
            setLoading(false);
            return;
        }

        // Join as guest
        const { data: updatedRoom, error: joinError } = await supabase
            .from('game_rooms')
            .update({ guest_user_id: userId, status: 'ready' }) // Set to ready
            .eq('id', rooms.id)
            .select().single();

        if (joinError) {
            setError('تعذر الانضمام');
            setLoading(false);
            return;
        }

        const parsedState = updatedRoom.game_state;
        setRoomData({ ...updatedRoom, ...parsedState });
        setBoard(parsedState.board || INITIAL_BOARD);
        setGameState('lobby'); // Go to lobby first
        setLoading(false);
    };

    const startGame = async () => {
        if (!roomData) return;
        await supabase.from('game_rooms').update({ status: 'playing' }).eq('id', roomData.id);
    };

    const handleSquareClick = async (r: number, c: number) => {
        if (roomData?.status !== 'playing') return;

        // Determine player color
        const isHost = userId === roomData.host_user_id;
        const myColor = isHost ? 'w' : 'b';

        // Turn Enforcement
        if (roomData.turn !== myColor) return;

        // 1. Select Piece
        if (!selectedSquare) {
            const piece = board[r][c];
            if (piece && piece.color === myColor) {
                setSelectedSquare({ r, c });
            }
            return;
        }

        // 2. Move Piece (Sandbox Logic)
        // If clicking same square -> Deselect
        if (selectedSquare.r === r && selectedSquare.c === c) {
            setSelectedSquare(null);
            return;
        }

        const targetPiece = board[r][c];
        // If clicking own piece -> Switch selection
        if (targetPiece && targetPiece.color === myColor) {
            setSelectedSquare({ r, c });
            return;
        }

        // Execute Move
        const newBoard = JSON.parse(JSON.stringify(board));
        const movingPiece = newBoard[selectedSquare.r][selectedSquare.c];
        newBoard[r][c] = movingPiece;
        newBoard[selectedSquare.r][selectedSquare.c] = null;

        // Check for King Capture (Win Condition in Sandbox)
        let winner = null;
        if (targetPiece && targetPiece.type === 'k') {
            winner = myColor;
        }

        const nextTurn = roomData.turn === 'w' ? 'b' : 'w';

        setBoard(newBoard);
        setSelectedSquare(null);

        // Sync
        await supabase.from('game_rooms').update({
            game_state: {
                ...roomData,
                board: newBoard,
                turn: nextTurn,
                lastMove: { from: selectedSquare, to: { r, c } },
                winner: winner
            },
            status: winner ? 'finished' : 'playing'
        }).eq('id', roomData.id);
    };

    const resetGame = async () => {
        // Reset board but keep players
        const initialState = {
            board: INITIAL_BOARD,
            turn: 'w',
            lastMove: null,
            winner: null
        };

        await supabase.from('game_rooms').update({
            game_state: initialState,
            status: 'playing'
        }).eq('id', roomData.id);
    };

    // --- Render Helpers ---
    const isHost = roomData?.host_user_id === userId;
    const myColor = isHost ? 'w' : 'b';
    const isMyTurn = roomData?.turn === myColor;

    // Flip board for black
    const renderBoard = myColor === 'w' ? board : [...board].reverse().map(row => [...row].reverse());

    // Adjusted coords for click
    const getRealCoords = (displayRow: number, displayCol: number) => {
        if (myColor === 'w') return { r: displayRow, c: displayCol };
        return { r: 7 - displayRow, c: 7 - displayCol };
    };

    // --- UI ---
    if (gameState === 'menu') {
        return (
            <div className="flex flex-col h-full bg-background p-6">
                <div className="flex items-center gap-4 mb-10">
                    <Button variant="ghost" className="w-12 h-12 rounded-full p-0" onClick={onBack}><ArrowLeft className="w-6 h-6" /></Button>
                    <h1 className="text-3xl font-black">الشطرنج ♟️</h1>
                </div>
                <div className="flex-1 flex flex-col justify-center gap-6">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-foreground/5 rounded-[2.5rem] p-8 text-center border-2 border-foreground/10">
                        <div className="text-6xl mb-6">♚</div>
                        <h2 className="text-2xl font-black mb-2">تحدي الملوك</h2>
                        <Button onClick={createRoom} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black shadow-lg mb-4">{loading ? '...' : 'إنشاء طاولة اللعب'}</Button>
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
                    <Button
                        size="icon"
                        variant="ghost"
                        className="absolute bottom-4 right-4 text-primary hover:bg-primary/10"
                        onClick={() => navigator.clipboard.writeText(roomData?.room_code || '')}
                    >
                        <Copy className="w-5 h-5" />
                    </Button>
                </div>

                <div className="w-full max-w-xs space-y-4 mb-8">
                    {/* Host */}
                    <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-2xl border border-border">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-black">أنا</div>
                        <div className="text-right flex-1">
                            <p className="font-bold text-sm">المضيف (أبيض)</p>
                            <p className="text-[10px] text-emerald-500 font-black flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> موجود</p>
                        </div>
                    </div>

                    {/* Guest */}
                    <div className={`flex items-center gap-4 p-4 rounded-2xl border ${opponentJoined ? 'bg-muted/30 border-border' : 'bg-muted/10 border-dashed border-border/50 opacity-50'}`}>
                        <div className="w-10 h-10 rounded-full bg-muted-foreground flex items-center justify-center text-white font-black">
                            {opponentJoined ? 'هو' : '?'}
                        </div>
                        <div className="text-right flex-1">
                            <p className="font-bold text-sm">{opponentJoined ? 'المنافس (أسود)' : 'بانتظار المنافس...'}</p>
                            {opponentJoined && <p className="text-[10px] text-emerald-500 font-black flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> انضم</p>}
                        </div>
                    </div>
                </div>

                {isHost ? (
                    <Button
                        disabled={!opponentJoined}
                        onClick={startGame}
                        className="w-full h-16 rounded-2xl text-lg font-black shadow-lg shadow-primary/20"
                    >
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
                    <div className="w-8 h-8 rounded-full bg-muted-foreground flex items-center justify-center text-white text-xs font-black">هو</div>
                    {!isMyTurn && <span className="text-xs font-black text-muted-foreground">يفكر...</span>}
                </div>
            </div>

            {/* Board */}
            <div className="flex-1 flex items-center justify-center">
                <div className="grid grid-cols-8 gap-0.5 bg-[#403d39] p-1 rounded-lg shadow-2xl w-full max-w-[400px] aspect-square relative">
                    {roomData?.game_state?.winner && (
                        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white rounded-lg">
                            <Trophy className="w-16 h-16 text-yellow-400 mb-4 animate-bounce" />
                            <h2 className="text-3xl font-black mb-4">{roomData.game_state.winner === myColor ? 'خلاص كسبت! 🎉' : 'خسرت يا بطل 😅'}</h2>
                            <Button onClick={resetGame} size="sm" variant="secondary" className="font-black"><RotateCcw className="w-4 h-4 mr-2" /> لعب مجدداً</Button>
                        </div>
                    )}

                    {renderBoard.map((row, r) =>
                        row.map((piece, c) => {
                            const realCoords = getRealCoords(r, c);
                            const isSelected = selectedSquare?.r === realCoords.r && selectedSquare?.c === realCoords.c;
                            const isBlackSquare = (r + c) % 2 === 1;

                            // Highlight last move
                            const lastMove = roomData?.game_state?.lastMove;
                            const isLastMoveSrc = lastMove?.from.r === realCoords.r && lastMove?.from.c === realCoords.c;
                            const isLastMoveDst = lastMove?.to.r === realCoords.r && lastMove?.to.c === realCoords.c;

                            return (
                                <div
                                    key={`${r}-${c}`}
                                    onClick={() => handleSquareClick(realCoords.r, realCoords.c)}
                                    className={`
                                        w-full h-full flex items-center justify-center text-3xl sm:text-4xl select-none cursor-pointer transition-colors relative
                                        ${isBlackSquare ? 'bg-[#b58863]' : 'bg-[#f0d9b5]'}
                                        ${isSelected ? 'ring-4 ring-inset ring-blue-500/50 bg-blue-400/30' : ''}
                                        ${(isLastMoveSrc || isLastMoveDst) && !isSelected ? 'bg-yellow-200/50' : ''}
                                    `}
                                >
                                    {c === 0 && <span className={`absolute top-0.5 left-0.5 text-[8px] font-bold opacity-50 ${isBlackSquare ? 'text-[#f0d9b5]' : 'text-[#b58863]'}`}>{8 - r}</span>}
                                    {r === 7 && <span className={`absolute bottom-0 right-0.5 text-[8px] font-bold opacity-50 ${isBlackSquare ? 'text-[#f0d9b5]' : 'text-[#b58863]'}`}>{String.fromCharCode(97 + c)}</span>}

                                    {piece && (
                                        <motion.span
                                            initial={{ scale: 0.8 }}
                                            animate={{ scale: 1 }}
                                            className={`
                                                relative z-10 drop-shadow-sm
                                                ${piece.color === 'w' ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]' : 'text-black drop-shadow-[0_1px_0px_rgba(255,255,255,0.5)]'}
                                            `}
                                        >
                                            {PIECE_SYMBOLS[`${piece.color}${piece.type}`]}
                                        </motion.span>
                                    )}
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
