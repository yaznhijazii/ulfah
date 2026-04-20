import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Copy, Image as ImageIcon, Camera, MapPin, Sparkles, Trophy, Ghost, Compass, Heart } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface MemoryMapGameProps {
    onBack: () => void;
    userId: string;
    userName: string;
    partnershipId: string | null;
    initialCode?: string;
}

type Phase = 'picking' | 'hints' | 'round_done' | 'game_over';
type GameState = 'menu' | 'lobby' | 'playing' | 'round_done' | 'finished';

interface GamePayload {
    total_rounds: number;
    current_round: number;
    sender_id: string;
    phase: Phase;
    memory_title: string;
    closeness: 'cold' | 'warm' | 'hot' | 'burning';
    scores: Record<string, number>;
    winner?: string | null;
}

interface RoomData {
    id: string;
    room_code: string;
    host_user_id: string;
    guest_user_id: string | null;
    status: string;
    game_state: GamePayload;
}

function parseGs(raw: unknown): GamePayload {
    const o = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<GamePayload>;
    return {
        total_rounds: typeof o.total_rounds === 'number' ? o.total_rounds : 3,
        current_round: typeof o.current_round === 'number' ? o.current_round : 1,
        sender_id: o.sender_id ?? '',
        phase: (o.phase as Phase) ?? 'picking',
        memory_title: o.memory_title ?? '',
        closeness: o.closeness ?? 'cold',
        scores: o.scores ?? {},
        winner: o.winner ?? null,
    };
}

export function MemoryMapGame({ onBack, userId, userName, partnershipId, initialCode }: MemoryMapGameProps) {
    const [gameState, setGameState] = useState<GameState>('menu');
    const [joinCode, setJoinCode] = useState('');
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(false);
    const [tempMemory, setTempMemory] = useState('');
    const [presence, setPresence] = useState<any>({});
    const [partnerInfo, setPartnerInfo] = useState<{ id: string, name: string } | null>(null);

    // Setup Options
    const [numRounds, setNumRounds] = useState(3);

    useEffect(() => {
        if (!roomData?.id) return;
        const channel = supabase.channel(`game_mem_${roomData.id}`, { config: { presence: { key: userId } } })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomData.id}` }, (payload) => {
                const newData = payload.new as any;
                setRoomData(prev => ({ ...prev!, ...newData, game_state: parseGs(newData.game_state) }));
            })
            .on('presence', { event: 'sync' }, () => setPresence(channel.presenceState()))
            .subscribe(async (status) => { if (status === 'SUBSCRIBED') await channel.track({ user_id: userId, name: userName }); });
        return () => { supabase.removeChannel(channel); };
    }, [roomData?.id, userId, userName]);

    useEffect(() => {
        if (roomData?.id) {
            let status = (roomData.status === 'waiting' ? 'lobby' : roomData.status) as GameState;
            if (roomData.game_state.winner) status = 'finished';
            if (status !== gameState) setGameState(status);
        }
    }, [roomData?.status, roomData?.game_state.winner, gameState]);

    useEffect(() => {
        if (!partnershipId) return;
        supabase.from('partnerships').select('user1_id, user2_id, user1:user1_id(name), user2:user2_id(name)')
            .eq('id', partnershipId).single().then(({ data }) => {
                if (data) {
                    const isUser1 = data.user1_id === userId;
                    setPartnerInfo({ id: isUser1 ? data.user2_id : data.user1_id, name: (isUser1 ? (data.user2 as any)?.name : (data.user1 as any)?.name) || 'الشريك' });
                }
            });
    }, [partnershipId, userId]);

    const createRoom = async () => {
        setLoading(true);
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const state: GamePayload = {
            total_rounds: numRounds,
            current_round: 1,
            sender_id: userId,
            phase: 'picking',
            memory_title: '',
            closeness: 'cold',
            scores: { [userId]: 0 },
        };
        const { data, error } = await supabase.from('game_rooms').insert({ room_code: code, game_type: 'memory-map', host_user_id: userId, status: 'waiting', game_state: state }).select().single();
        if (error) { setLoading(false); return; }
        setRoomData({ ...data, game_state: state });
        setLoading(false);
        if (partnerInfo) await supabase.from('notifications').insert({ user_id: partnerInfo.id, title: 'خريطة الذكريات! 📸', body: `${userName} ينتظرك في رحلة عبر الذكريات!`, type: 'game_invite', metadata: { room_code: code, game_type: 'memory-map' } });
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
        const codeToUse = (joinCode || initialCode)?.trim();
        if (!codeToUse) return;
        
        setLoading(true);
        try {
            const { data: room, error } = await supabase
                .from('game_rooms')
                .select('*')
                .eq('room_code', codeToUse.toUpperCase())
                .eq('game_type', 'memory-map')
                .single();

            if (error || !room) {
                toast.error('لم نجد هذه الذكرى.. تأكد من الكود');
                setLoading(false);
                return;
            }

            if (room.status === 'finished') {
                toast.error('هذه الرحلة انتهت بالفعل');
                setLoading(false);
                return;
            }
            
            const gs = parseGs(room.game_state);
            const nextGs = { ...gs, scores: { ...gs.scores, [userId]: gs.scores[userId] || 0 } };

            const { data: updated, error: updError } = await supabase
                .from('game_rooms')
                .update({ 
                    guest_user_id: userId, 
                    status: 'playing', 
                    game_state: nextGs 
                })
                .eq('id', room.id)
                .select()
                .single();

            if (updError) {
                toast.error('عذراً، تعذر الانضمام للرحلة');
            } else if (updated) {
                setRoomData({ ...updated, game_state: parseGs(updated.game_state) });
            }
        } catch (err) {
            console.error(err);
            toast.error('خطأ غير متوقع');
        } finally {
            setLoading(false);
        }
    };

    const setMemory = async () => {
        if (!tempMemory.trim() || !roomData) return;
        setLoading(true);
        const state = { ...roomData.game_state, memory_title: tempMemory.trim(), phase: 'hints' as Phase };
        await supabase.from('game_rooms').update({ game_state: state }).eq('id', roomData.id);
        setTempMemory('');
        setLoading(false);
    };

    const updateCloseness = async (val: any) => {
        if (!roomData) return;
        const state = { ...roomData.game_state, closeness: val };
        await supabase.from('game_rooms').update({ game_state: state }).eq('id', roomData.id);
    };

    const handleWin = async () => {
        if (!roomData) return;
        const gs = roomData.game_state;
        const nextScores = { ...gs.scores };
        nextScores[userId] = (nextScores[userId] || 0) + 1;

        const state = { 
            ...gs, 
            scores: nextScores, 
            phase: 'round_done' as Phase 
        };
        await supabase.from('game_rooms').update({ game_state: state }).eq('id', roomData.id);
        toast.success('تم استرجاع الذكرى بنجاح! ❤️');
    };

    const nextRound = async () => {
        if (!roomData || !roomData.guest_user_id) return;
        const gs = roomData.game_state;
        
        if (gs.current_round >= gs.total_rounds) {
            const finalState = { ...gs, phase: 'game_over' as Phase };
            await supabase.from('game_rooms').update({ game_state: finalState }).eq('id', roomData.id);
            return;
        }

        setLoading(true);
        const host = roomData.host_user_id;
        const guest = roomData.guest_user_id;
        const newSender = gs.sender_id === host ? guest : host;
        
        const nextState: GamePayload = {
            ...gs,
            current_round: gs.current_round + 1,
            sender_id: newSender,
            phase: 'picking',
            memory_title: '',
            closeness: 'cold',
        };
        await supabase.from('game_rooms').update({ game_state: nextState }).eq('id', roomData.id);
        setLoading(false);
        toast.message(`جولة ${gs.current_round + 1} — دور ${newSender === userId ? 'ك' : 'الشريك'} يختار الذكرى`);
    };

    // --- RENDERERS ---

    if (!roomData) {
        return (
            <div className="flex flex-col h-full bg-[#faf9f6] p-6 overflow-y-auto">
                <div className="flex-1 flex flex-col justify-center gap-6 pb-20 max-w-sm mx-auto w-full">
                    <motion.div initial={{ rotate: -2, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} className="bg-white rounded-[2.5rem] p-8 text-center shadow-xl border border-stone-200">
                        <div className="w-20 h-20 bg-purple-100 text-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <Camera className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-black mb-2 text-stone-800">خريطة الذكريات 📸</h2>
                        <p className="text-stone-500 font-medium text-sm mb-8 leading-relaxed">تحدي استرجاع اللحظات الجميلة عبر التلميحات!</p>
                        
                        <div className="space-y-4 mb-8 text-start">
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">كم جولة؟</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[3, 5, 10].map(n => (
                                    <button 
                                        key={n} 
                                        onClick={() => setNumRounds(n)} 
                                        className={`h-12 rounded-2xl font-black transition-all ${numRounds === n ? 'bg-stone-800 text-white shadow-lg' : 'bg-stone-100 text-stone-400'}`}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Button onClick={createRoom} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black bg-stone-800 hover:bg-stone-900 text-white shadow-xl shadow-stone-800/10">
                            {loading ? 'تحميل..' : 'إنشاء رحلة جديدة'}
                        </Button>
                    </motion.div>
                    <div className="space-y-4">
                        <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="كود الذكرى.." className="w-full h-16 rounded-2xl bg-stone-100 border-2 border-stone-200 px-6 text-center text-xl font-black outline-none focus:border-stone-400 placeholder:text-stone-300" />
                        <Button onClick={joinRoom} disabled={!joinCode || loading} variant="secondary" className="w-full h-16 rounded-2xl text-lg font-black bg-stone-200 text-stone-700 hover:bg-stone-300">انضمام</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (roomData.status === 'waiting') {
        const isPartnerInRoom = partnerInfo && presence[partnerInfo.id];
        return (
            <div className="flex flex-col h-full bg-[#faf9f6] p-6 pt-12 items-center text-center">
                <ImageIcon className="w-12 h-12 text-stone-300 mb-6" />
                <h2 className="text-2xl font-black mb-10 text-stone-800">رحلتنا ستبدأ قريباً..</h2>
                <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 shadow-lg border border-stone-100 relative mb-12">
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">كود الدخول</p>
                    <p className="text-4xl font-mono font-black text-stone-800 tracking-wider font-sans">{roomData.room_code}</p>
                </div>
                <div className={`p-6 rounded-3xl border w-full max-w-xs transition-all ${isPartnerInRoom ? 'bg-emerald-50 border-emerald-100 shadow-sm' : 'bg-stone-100 border-stone-200 opacity-60'}`}>
                    <p className="font-bold text-stone-700 mb-1">{partnerInfo?.name || 'الشريك'}</p>
                    <span className={`text-[10px] font-black ${isPartnerInRoom ? 'text-emerald-500 uppercase tracking-widest' : 'text-stone-400'}`}>
                        {isPartnerInRoom ? 'جاهز للرحلة ✅' : 'قادم في الطريق..'}
                    </span>
                </div>
                <div className="mt-auto pb-10">
                    <p className="text-[11px] font-black text-stone-300 uppercase tracking-[0.2em]">{roomData.game_state.total_rounds} جولات مودة</p>
                </div>
            </div>
        );
    }

    const gs = roomData.game_state;
    const isSender = gs.sender_id === userId;

    return (
        <div dir="rtl" className="flex flex-col h-full bg-[#faf9f6] overflow-hidden">
            {/* Header / Stats */}
            <div className="shrink-0 px-6 pt-4 pb-3 border-b border-stone-200 bg-white shadow-sm flex items-center justify-between">
                <div>
                   <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">الجولة {gs.current_round} / {gs.total_rounds}</p>
                   <h3 className="text-sm font-black text-stone-800">
                    {gs.phase === 'picking' ? (isSender ? 'اختر ذكراكم الجميلة' : 'الشريك يختار ذكرى..') : 'رحلة الاسترجاع'}
                   </h3>
                </div>
                <div className="bg-purple-100 px-4 py-1.5 rounded-2xl flex flex-col items-center min-w-[70px]">
                    <span className="text-[9px] font-black text-purple-600 uppercase">النتيجة</span>
                    <span className="text-sm font-black text-purple-900">{gs.scores[userId] || 0} - {gs.scores[partnerInfo?.id ?? ''] || 0}</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pb-32">
                {gs.phase === 'picking' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-10 py-4">
                        <header className="text-center">
                            <div className="w-16 h-16 bg-purple-100 rounded-[2rem] flex items-center justify-center mx-auto mb-4 text-purple-600 shadow-inner">
                                <MapPin className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-black text-stone-800">{isSender ? 'ثبّت دبوس الذكرى 📍' : 'بانتظار الشريك يختار ذكرى..'}</h2>
                            <p className="text-stone-500 font-medium text-sm mt-3 leading-relaxed">
                                {isSender ? 'فكر في موقف، مطعم، أو لحظة مضحكة حدثت بينكما!' : 'خليك جاهز، الرحلة عم تتحدد الآن!'}
                            </p>
                        </header>

                        {isSender ? (
                            <div className="space-y-6">
                                <textarea 
                                    value={tempMemory} 
                                    onChange={(e) => setTempMemory(e.target.value)} 
                                    placeholder="مثلاً: يوم ما ضيعنا الطريق في عجلون.."
                                    className="w-full h-40 rounded-[2.5rem] bg-white border-2 border-stone-200 p-8 text-right text-lg font-bold outline-none focus:border-stone-800 shadow-lg placeholder:text-stone-200" 
                                />
                                <Button onClick={setMemory} disabled={!tempMemory.trim() || loading} className="w-full h-16 bg-stone-800 hover:bg-stone-900 text-white rounded-[1.8rem] text-lg font-black shadow-xl">
                                    {loading ? 'ثواني..' : 'تم، ثبّت الذكرى! 🚀'}
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center py-10 gap-4">
                                <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="text-6xl">🎞️</motion.div>
                                <p className="font-black text-stone-300">الشريك يغوص في الألبوم السري لدماغك..</p>
                            </div>
                        )}
                    </motion.div>
                )}

                {gs.phase === 'hints' && (
                    <div className="flex flex-col items-center gap-8 py-4">
                        <div className="bg-white w-full p-8 rounded-[3rem] shadow-xl border border-stone-200 text-right relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -z-0" />
                            <div className="flex items-center gap-3 mb-3 relative z-10">
                                <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600"><Heart className="w-5 h-5 fill-current" /></div>
                                <h3 className="font-black text-stone-800">حزر الذكرى..</h3>
                            </div>
                            {isSender && <p className="text-lg font-bold text-purple-600 bg-purple-50 p-4 rounded-2xl border border-purple-100">{gs.memory_title}</p>}
                            {!isSender && <p className="text-stone-400 font-bold px-4 tracking-wider">هل تستطيع استرجاع ما يلمح له شريكك؟</p>}
                        </div>

                        <div className="flex flex-col items-center justify-center gap-8 pt-6">
                            <motion.div animate={{ scale: gs.closeness === 'burning' ? [1, 1.12, 1] : 1 }} transition={{ duration: 1, repeat: Infinity }}
                                className={`w-44 h-44 rounded-[4rem] mx-auto flex items-center justify-center shadow-2xl transition-all duration-700 relative border-8 border-white ${
                                    gs.closeness === 'cold' ? 'bg-blue-500' : gs.closeness === 'warm' ? 'bg-amber-400' : gs.closeness === 'hot' ? 'bg-orange-500' : 'bg-red-600'
                                }`}>
                                <div className="text-white">
                                    {gs.closeness === 'cold' ? <Ghost size={64} /> : gs.closeness === 'warm' ? <Compass size={64} /> : <Sparkles size={64} />}
                                </div>
                            </motion.div>

                            <div className="text-center space-y-2">
                                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">بوصلة القرب</p>
                                <h4 className="text-3xl font-black text-stone-800">
                                    {gs.closeness === 'cold' ? 'بعيد كالثلج ❄️' : gs.closeness === 'warm' ? 'بدأت تدفأ! 🌥️' : gs.closeness === 'hot' ? 'قريب جداً! 🔥' : 'الذكرى تشتعل! 🌋'}
                                </h4>
                            </div>

                            {!isSender && (
                                <Button onClick={handleWin} className="w-full max-w-xs h-20 rounded-[2.5rem] bg-stone-800 text-white shadow-2xl text-xl font-black hover:bg-stone-900 transition-all">حزرتها! 🎉</Button>
                            )}
                        </div>

                        {isSender && (
                            <div className="fixed bottom-10 left-6 right-6 bg-white/90 backdrop-blur-3xl p-6 rounded-[2.8rem] shadow-2xl border border-stone-200/50 space-y-5">
                                <p className="text-[10px] font-black text-stone-400 uppercase text-center tracking-widest">وجه شريكك للوصول للذكرى</p>
                                <div className="grid grid-cols-4 gap-3">
                                    {[ 
                                        {id:'cold', icon:Ghost, color:'bg-blue-500'}, 
                                        {id:'warm', icon:Compass, color:'bg-amber-400'}, 
                                        {id:'hot', icon:Heart, color:'bg-orange-500'}, 
                                        {id:'burning', icon:Sparkles, color:'bg-red-600'} 
                                    ].map(item => (
                                        <button 
                                            key={item.id} 
                                            onClick={() => updateCloseness(item.id)} 
                                            className={`h-16 rounded-3xl flex items-center justify-center transition-all ${gs.closeness === item.id ? `${item.color} text-white scale-110 shadow-lg` : 'bg-stone-100 text-stone-300'}`}
                                        >
                                            <item.icon className="w-8 h-8" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {gs.phase === 'round_done' && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full gap-8 py-10 text-center">
                        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-[2.5rem] flex items-center justify-center shadow-inner">
                            <Trophy className="w-12 h-12" />
                        </div>
                        <div className="space-y-2">
                             <h2 className="text-4xl font-black text-stone-800">لقد تذكّرتم! ❤️</h2>
                             <p className="font-bold text-stone-400 italic">" {gs.memory_title} "</p>
                        </div>
                        <Button onClick={nextRound} disabled={loading} className="w-full max-w-xs h-16 rounded-[1.8rem] bg-stone-800 text-white font-black shadow-xl">
                            {gs.current_round >= gs.total_rounds ? 'مشاهدة النتيجة النهائية' : 'الجولة التالية'}
                        </Button>
                    </motion.div>
                )}

                {gs.phase === 'game_over' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full items-center justify-center gap-10 py-10 text-center">
                        <div className="w-28 h-28 bg-gradient-to-br from-stone-800 to-stone-900 rounded-[3rem] flex items-center justify-center shadow-2xl">
                            <Sparkles className="w-14 h-14 text-amber-400" />
                        </div>
                        <div className="space-y-3">
                            <h2 className="text-4xl font-black text-stone-800 leading-tight">رحلة ذكريات<br/>لا تُنسى</h2>
                            <p className="text-sm font-bold text-stone-400 uppercase tracking-widest">انتهت الجولات المحددة</p>
                        </div>

                        <div className="grid grid-cols-2 gap-6 w-full max-w-sm">
                            <div className="bg-white p-7 rounded-[2.5rem] border border-stone-100 shadow-xl">
                                <p className="text-[10px] font-black text-stone-400 uppercase mb-2">أنت</p>
                                <p className="text-4xl font-black text-stone-800">{gs.scores[userId] || 0}</p>
                            </div>
                            <div className="bg-white p-7 rounded-[2.5rem] border border-stone-100 shadow-xl">
                                <p className="text-[10px] font-black text-stone-400 uppercase mb-2">{partnerInfo?.name || 'الشريك'}</p>
                                <p className="text-4xl font-black text-stone-800">{gs.scores[partnerInfo?.id ?? ''] || 0}</p>
                            </div>
                        </div>

                        <Button onClick={onBack} className="w-full max-w-xs h-18 rounded-[2rem] bg-stone-800 text-white font-black shadow-xl shadow-stone-800/10 h-16">
                            العودة لمرفأ الألعاب
                        </Button>
                    </motion.div>
                )}
            </div>
        </div>
    );
    return null;
}
