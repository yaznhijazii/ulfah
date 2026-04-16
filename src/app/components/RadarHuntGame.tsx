import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Copy, Radio, Target, Search, Sparkles, Trophy, Ghost, Navigation, Zap, Locate } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface RadarHuntGameProps {
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
    status: string;
    game_state: {
        target: string;
        signal: 'off' | 'weak' | 'moderate' | 'strong' | 'burst';
        winner: string | null;
    };
}

export function RadarHuntGame({ onBack, userId, userName, partnershipId }: RadarHuntGameProps) {
    const [gameState, setGameState] = useState<GameState>('menu');
    const [joinCode, setJoinCode] = useState('');
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(false);
    const [tempTarget, setTempTarget] = useState('');
    const [presence, setPresence] = useState<any>({});
    const [partnerInfo, setPartnerInfo] = useState<{ id: string, name: string } | null>(null);

    useEffect(() => {
        if (!roomData?.id) return;
        const channel = supabase.channel(`game_rad_${roomData.id}`, { config: { presence: { key: userId } } })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomData.id}` }, (payload) => {
                const newData = payload.new as any;
                const state = typeof newData.game_state === 'string' ? JSON.parse(newData.game_state) : newData.game_state;
                setRoomData(prev => ({ ...prev!, ...newData, game_state: state }));
            })
            .on('presence', { event: 'sync' }, () => setPresence(channel.presenceState()))
            .subscribe(async (status) => { if (status === 'SUBSCRIBED') await channel.track({ user_id: userId, name: userName }); });
        return () => { supabase.removeChannel(channel); };
    }, [roomData?.id, userId, userName]);

    useEffect(() => {
        if (roomData?.id) {
            let status = roomData.status as GameState;
            if (status === 'waiting') status = 'lobby';
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
                    setPartnerInfo({ id: isUser1 ? data.user2_id : data.user1_id, name: isUser1 ? (data.user2 as any)?.name : (data.user1 as any)?.name || 'الشريك' });
                }
            });
    }, [partnershipId, userId]);

    const createRoom = async () => {
        setLoading(true);
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const state = { target: '', signal: 'off', winner: null };
        const { data, error } = await supabase.from('game_rooms').insert({ room_code: code, game_type: 'radar-hunt', host_user_id: userId, status: 'waiting', game_state: state }).select().single();
        if (error) { setLoading(false); return; }
        setRoomData({ ...data, game_state: state });
        setGameState('lobby');
        setLoading(false);
        if (partnerInfo) await supabase.from('notifications').insert({ user_id: partnerInfo.id, title: 'الرادار بدأ! 🛰️', body: `${userName} يطلب منك البحث عن هدف سري!`, type: 'game_invite', metadata: { room_code: code, game_type: 'radar-hunt' } });
    };

    const joinRoom = async () => {
        if (!joinCode) return;
        setLoading(true);
        const { data: room, error } = await supabase.from('game_rooms').select('*').eq('room_code', joinCode.toUpperCase()).eq('game_type', 'radar-hunt').eq('status', 'waiting').single();
        if (error || !room) { toast.error('الغرفة غير موجودة'); setLoading(false); return; }
        const { data: updated } = await supabase.from('game_rooms').update({ guest_user_id: userId, status: 'setup' }).eq('id', room.id).select().single();
        if (updated) setRoomData({ ...updated, game_state: typeof updated.game_state === 'string' ? JSON.parse(updated.game_state) : updated.game_state });
        setGameState('setup');
        setLoading(false);
    };

    const setTarget = async () => {
        if (!tempTarget.trim() || !roomData) return;
        setLoading(true);
        const state = { ...roomData.game_state, target: tempTarget.trim() };
        await supabase.from('game_rooms').update({ game_state: state, status: 'playing' }).eq('id', roomData.id);
        setLoading(false);
    };

    const updateSignal = async (val: any) => {
        if (!roomData) return;
        const state = { ...roomData.game_state, signal: val };
        await supabase.from('game_rooms').update({ game_state: state }).eq('id', roomData.id);
    };

    const handleWin = async () => {
        if (!roomData) return;
        const state = { ...roomData.game_state, winner: userId };
        await supabase.from('game_rooms').update({ game_state: state, status: 'finished' }).eq('id', roomData.id);
        toast.success('تم تحديد الهدف بنجاح! 🎯');
    };

    // --- RENDERERS ---

    if (gameState === 'menu') {
        return (
            <div className="flex flex-col h-full bg-[#0a0a0a] p-6">
                <div className="flex-1 flex flex-col justify-center gap-6 pb-20">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-emerald-500/5 rounded-[2.5rem] p-10 text-center border-2 border-emerald-500/20">
                        <motion.button 
                            whileTap={{ scale: 0.9 }}
                            onClick={createRoom}
                            disabled={loading}
                            className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-pulse"
                        >
                            <Radio className="w-10 h-10" />
                        </motion.button>
                        <h2 className="text-2xl font-black mb-3 text-white">الرادار 🛰️</h2>
                        <p className="text-emerald-500/40 font-bold text-sm mb-10 leading-relaxed">حدد هدفاً في الغرفة ودع شريكك يتتبعه عبر إشارات الرادار التي ترسلها!</p>
                        <Button onClick={createRoom} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg">
                            {loading ? 'ثوانِ..' : '🛰️ تفعيل الرادار'}
                        </Button>
                    </motion.div>
                    <div className="space-y-4">
                        <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="كود الإشارة.." className="w-full h-16 rounded-2xl bg-white/5 border-2 border-white/10 px-6 text-center text-xl font-black text-white outline-none focus:border-emerald-500" />
                        <Button onClick={joinRoom} disabled={!joinCode || loading} variant="secondary" className="w-full h-16 rounded-2xl text-lg font-black text-emerald-700">اتصال</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (gameState === 'lobby') {
        const isPartnerInRoom = partnerInfo && presence[partnerInfo.id];
        return (
            <div className="flex flex-col h-full bg-[#0a0a0a] p-6 pt-12 items-center text-center">
                <h2 className="text-2xl font-black mb-10 text-white">البحث عن إشارة..</h2>
                <div className="bg-emerald-500/5 w-full max-w-xs rounded-[2.5rem] p-10 border-4 border-dashed border-emerald-500/20 relative mb-12">
                    <p className="text-[10px] font-black text-emerald-500/40 uppercase tracking-widest mb-2">تردد القناة</p>
                    <p className="text-5xl font-mono font-black text-emerald-500 tracking-tighter">{roomData?.room_code}</p>
                </div>
                <div className={`p-6 rounded-3xl border w-full max-w-xs transition-all ${isPartnerInRoom ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-white/5 border-white/10 text-white/40 opacity-60'}`}>
                    <p className="font-black underline decoration-emerald-500/40 underline-offset-4">{partnerInfo?.name || 'الشريك'}</p>
                    <span className="text-[10px] font-black uppercase tracking-tighter">
                        {isPartnerInRoom ? 'متصل بالرادار ✅' : 'جاري البحث عن اتصاله..'}
                    </span>
                </div>
            </div>
        );
    }

    if (gameState === 'setup') {
        const isHost = userId === roomData?.host_user_id;
        return (
            <div className="flex flex-col h-full bg-[#0a0a0a] p-6 pt-10">
                <header className="text-center mb-12">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                        <Target className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-black text-white">{isHost ? 'حدد الهدف السري 🎯' : 'جاري اختيار الهدف..'}</h2>
                    <p className="text-emerald-500/40 font-bold text-sm mt-3 px-10">
                        {isHost ? 'اختر شيء مخبأ في الغرفة أو حتى شخص!' : 'خليك بمكانك، الرادار عم يتبرمج الآن!'}
                    </p>
                </header>

                {isHost && (
                    <div className="space-y-6">
                        <input value={tempTarget} onChange={(e) => setTempTarget(e.target.value)} placeholder="مثلاً: الخاتم تحت المخدة.."
                            className="w-full h-16 rounded-2xl bg-white/5 border-2 border-white/10 px-6 text-center text-lg font-bold text-white outline-none focus:border-emerald-500" />
                        <Button onClick={setTarget} disabled={!tempTarget.trim() || loading} className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-lg font-black shadow-xl">تثبيت الهدف 📡</Button>
                    </div>
                )}
            </div>
        );
    }

    if (gameState === 'playing') {
        const isHost = userId === roomData?.host_user_id;
        const signal = roomData?.game_state.signal;

        return (
            <div className="flex flex-col h-full bg-[#0a0a0a] p-4 relative overflow-hidden">
                <div className="relative w-full aspect-square max-w-[320px] mx-auto mt-10">
                    {/* Radar Circles */}
                    <div className="absolute inset-0 border-2 border-emerald-500/20 rounded-full" />
                    <div className="absolute inset-8 border-2 border-emerald-500/15 rounded-full" />
                    <div className="absolute inset-16 border-2 border-emerald-500/10 rounded-full" />
                    <div className="absolute inset-24 border-2 border-emerald-500/5 rounded-full" />
                    
                    {/* Scanning Line */}
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 origin-center bg-gradient-to-r from-emerald-500/20 to-transparent rounded-full" />
                    
                    {/* Center Point */}
                    <div className="absolute inset-[48%] bg-emerald-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.8)]" />

                    {/* Proximity Pulsing */}
                    <AnimatePresence>
                        {signal !== 'off' && (
                            <motion.div initial={{ scale: 0.1, opacity: 0 }} animate={{ scale: signal === 'weak' ? 0.3 : signal === 'moderate' ? 0.6 : signal === 'strong' ? 0.9 : 1.2, opacity: [0.2, 0.4, 0.2] }} transition={{ duration: signal === 'burst' ? 0.5 : 2, repeat: Infinity }}
                                className={`absolute inset-0 rounded-full shadow-[inset_0_0_50px_rgba(16,185,129,0.5)] bg-emerald-500/10`} />
                        )}
                    </AnimatePresence>
                </div>

                <div className="flex-1 flex flex-col items-center justify-start pt-12 gap-8 z-10">
                    <div className="text-center space-y-2">
                        <p className="text-[10px] font-black text-emerald-500/40 uppercase tracking-widest">ق قوة الإشارة</p>
                        <h4 className="text-4xl font-black text-white tracking-widest">
                            {signal === 'off' ? 'لا توجد إشارة' : signal === 'weak' ? 'إشارة ضعيفة' : signal === 'moderate' ? 'إشارة متوسطة' : signal === 'strong' ? 'إشارة قوية!' : 'انفجار إشارة!'}
                        </h4>
                        {isHost && <p className="text-xs text-stone-500 mt-2 font-bold">الهدف: {roomData.game_state.target}</p>}
                    </div>

                    {!isHost && (
                        <Button onClick={handleWin} className="w-full max-w-xs h-20 rounded-[2.5rem] bg-emerald-500 text-white shadow-[0_0_30px_rgba(16,185,129,0.4)] text-2xl font-black">وصلت للهدف! 🎯</Button>
                    )}
                </div>

                {isHost && (
                    <div className="fixed bottom-10 left-6 right-6 bg-white/5 backdrop-blur-3xl p-6 rounded-[2.5rem] border border-white/10 shadow-2xl space-y-4">
                        <p className="text-[10px] font-black text-emerald-500/40 uppercase text-center tracking-widest">تحكم في قوة الإشارة المرسلة</p>
                        <div className="grid grid-cols-5 gap-2">
                            {[ {id:'off', label:'0'}, {id:'weak', label:'1'}, {id:'moderate', label:'2'}, {id:'strong', label:'3'}, {id:'burst', label:'MAX'} ].map(item => (
                                <button key={item.id} onClick={() => updateSignal(item.id)} className={`h-14 rounded-2xl flex items-center justify-center font-black transition-all ${signal === item.id ? `bg-emerald-500 text-white scale-110 shadow-lg` : 'bg-white/5 text-stone-500'}`}>
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (gameState === 'finished') {
        return (
            <div className="flex flex-col h-full bg-[#0a0a0a] items-center justify-center p-6 text-center">
                <div className="w-32 h-32 bg-emerald-500/10 rounded-full flex items-center justify-center mb-8 border-4 border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
                    <Trophy className="w-16 h-16 text-emerald-500" />
                </div>
                <h2 className="text-4xl font-black mb-4 text-white">تم الإمساك بالهدف!</h2>
                <div className="bg-white/5 p-8 rounded-[2rem] border border-emerald-500/20 w-full max-w-xs mb-10">
                    <p className="text-[10px] font-black text-emerald-500/40 uppercase mb-3">الهدف الذي وجدته</p>
                    <p className="text-2xl font-bold text-white tracking-tight">"{roomData?.game_state.target}"</p>
                </div>
                <Button onClick={onBack} className="w-full max-w-xs h-16 rounded-2xl bg-emerald-500 text-white font-black shadow-lg">إغلاق الرادار</Button>
            </div>
        );
    }
    return null;
}
