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
}

type GameState = 'menu' | 'lobby' | 'setup' | 'playing' | 'finished';

interface RoomData {
    id: string;
    room_code: string;
    host_user_id: string;
    status: string;
    game_state: {
        memory_title: string;
        closeness: 'cold' | 'warm' | 'hot' | 'burning';
        winner: string | null;
    };
}

export function MemoryMapGame({ onBack, userId, userName, partnershipId }: MemoryMapGameProps) {
    const [gameState, setGameState] = useState<GameState>('menu');
    const [joinCode, setJoinCode] = useState('');
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(false);
    const [tempMemory, setTempMemory] = useState('');
    const [presence, setPresence] = useState<any>({});
    const [partnerInfo, setPartnerInfo] = useState<{ id: string, name: string } | null>(null);

    useEffect(() => {
        if (!roomData?.id) return;
        const channel = supabase.channel(`game_mem_${roomData.id}`, { config: { presence: { key: userId } } })
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
        const state = { memory_title: '', closeness: 'cold', winner: null };
        const { data, error } = await supabase.from('game_rooms').insert({ room_code: code, game_type: 'memory-map', host_user_id: userId, status: 'waiting', game_state: state }).select().single();
        if (error) { setLoading(false); return; }
        setRoomData({ ...data, game_state: state });
        setGameState('lobby');
        setLoading(false);
        if (partnerInfo) await supabase.from('notifications').insert({ user_id: partnerInfo.id, title: 'خريطة الذكريات! 📸', body: `${userName} ينتظرك في رحلة عبر الذكريات!`, type: 'game_invite', metadata: { room_code: code, game_type: 'memory-map' } });
    };

    const joinRoom = async () => {
        if (!joinCode) return;
        setLoading(true);
        const { data: room, error } = await supabase.from('game_rooms').select('*').eq('room_code', joinCode.toUpperCase()).eq('game_type', 'memory-map').eq('status', 'waiting').single();
        if (error || !room) { toast.error('الغرفة غير موجودة'); setLoading(false); return; }
        const { data: updated } = await supabase.from('game_rooms').update({ guest_user_id: userId, status: 'setup' }).eq('id', room.id).select().single();
        if (updated) setRoomData({ ...updated, game_state: typeof updated.game_state === 'string' ? JSON.parse(updated.game_state) : updated.game_state });
        setGameState('setup');
        setLoading(false);
    };

    const setMemory = async () => {
        if (!tempMemory.trim() || !roomData) return;
        setLoading(true);
        const state = { ...roomData.game_state, memory_title: tempMemory.trim() };
        await supabase.from('game_rooms').update({ game_state: state, status: 'playing' }).eq('id', roomData.id);
        setLoading(false);
    };

    const updateCloseness = async (val: any) => {
        if (!roomData) return;
        const state = { ...roomData.game_state, closeness: val };
        await supabase.from('game_rooms').update({ game_state: state }).eq('id', roomData.id);
    };

    const handleWin = async () => {
        if (!roomData) return;
        const state = { ...roomData.game_state, winner: userId };
        await supabase.from('game_rooms').update({ game_state: state, status: 'finished' }).eq('id', roomData.id);
        toast.success('تم استرجاع الذكرى بنجاح! ❤️');
    };

    // --- RENDERERS ---

    if (gameState === 'menu') {
        return (
            <div className="flex flex-col h-full bg-[#faf9f6] p-6">
                <div className="flex-1 flex flex-col justify-center gap-6 pb-20">
                    <motion.div initial={{ rotate: -2, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} className="bg-white rounded-[2rem] p-8 text-center shadow-xl border border-stone-200">
                        <div className="w-20 h-20 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <Camera className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-serif font-black mb-2 text-stone-800">خريطة الذكريات 📸</h2>
                        <p className="text-stone-500 font-medium text-sm mb-8 leading-relaxed">اختر ذكرى مميزة ودع شريكك يحاول حزرها عبر تلميحاتك!</p>
                        <Button onClick={createRoom} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black bg-stone-800 hover:bg-stone-900 text-white shadow-xl">
                            {loading ? 'تحميل..' : '📦 إنشاء رحلة'}
                        </Button>
                    </motion.div>
                    <div className="space-y-4">
                        <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="كود الذكرى.." className="w-full h-16 rounded-2xl bg-stone-100 border-2 border-stone-200 px-6 text-center text-xl font-black outline-none focus:border-purple-400" />
                        <Button onClick={joinRoom} disabled={!joinCode || loading} variant="secondary" className="w-full h-16 rounded-2xl text-lg font-black">انضمام</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (gameState === 'lobby') {
        const isPartnerInRoom = partnerInfo && presence[partnerInfo.id];
        return (
            <div className="flex flex-col h-full bg-[#faf9f6] p-6 pt-12 items-center text-center">
                <ImageIcon className="w-12 h-12 text-stone-300 mb-6" />
                <h2 className="text-2xl font-serif font-black mb-10 text-stone-800">رحلتنا ستبدأ قريباً..</h2>
                <div className="bg-white w-full max-w-xs rounded-3xl p-8 shadow-lg border border-stone-100 relative mb-12">
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">كود الدخول</p>
                    <p className="text-4xl font-mono font-black text-stone-800">{roomData?.room_code}</p>
                </div>
                <div className={`p-5 rounded-2xl border w-full max-w-xs transition-all ${isPartnerInRoom ? 'bg-emerald-50 border-emerald-100' : 'bg-stone-100 border-stone-200 opacity-60'}`}>
                    <p className="font-bold text-stone-700">{partnerInfo?.name || 'الشريك'}</p>
                    <span className={`text-[10px] font-black ${isPartnerInRoom ? 'text-emerald-500 uppercase' : 'text-stone-400'}`}>
                        {isPartnerInRoom ? 'جاهز للرحلة ✅' : 'قادم في الطريق..'}
                    </span>
                </div>
            </div>
        );
    }

    if (gameState === 'setup') {
        const isHost = userId === roomData?.host_user_id;
        return (
            <div className="flex flex-col h-full bg-[#faf9f6] p-6 pt-10">
                <header className="text-center mb-12">
                    <div className="w-16 h-16 bg-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-purple-600">
                        <MapPin className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-serif font-black text-stone-800">{isHost ? 'اختر ذكراكم الجميلة 🎞️' : 'الشريك يختار ذكرى..'}</h2>
                    <p className="text-stone-500 font-medium text-sm mt-3 px-6">
                        {isHost ? 'فكر في موقف، مطعم، أو لحظة مضحكة حدثت بينكما!' : 'خليك جاهز، الرحلة عم تتحدد الآن!'}
                    </p>
                </header>

                {isHost && (
                    <div className="space-y-6">
                        <textarea value={tempMemory} onChange={(e) => setTempMemory(e.target.value)} placeholder="مثلاً: يوم ما ضيعنا الطريق في عجلون.."
                            className="w-full h-32 rounded-3xl bg-white border-2 border-stone-200 p-6 text-right text-lg font-bold outline-none focus:border-stone-800 shadow-sm" />
                        <Button onClick={setMemory} disabled={!tempMemory.trim() || loading} className="w-full h-16 bg-stone-800 hover:bg-stone-900 text-white rounded-2xl text-lg font-black shadow-xl">تم، حددت الذكرى! 🚀</Button>
                    </div>
                )}
            </div>
        );
    }

    if (gameState === 'playing') {
        const isHost = userId === roomData?.host_user_id;
        const closeness = roomData?.game_state.closeness;

        return (
            <div className="flex flex-col h-full bg-[#faf9f6] p-4 relative overflow-hidden">
                <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-stone-200 mb-8 mt-4 text-right">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600"><Heart className="w-5 h-5 fill-current" /></div>
                        <h3 className="font-serif font-black text-stone-800">حزر الذكرى..</h3>
                    </div>
                    {isHost && <p className="text-sm font-bold text-purple-600">السر: {roomData.game_state.memory_title}</p>}
                </div>

                <div className="flex-1 flex flex-col items-center justify-start pt-10 gap-10">
                    <motion.div animate={{ scale: closeness === 'burning' ? [1, 1.1, 1] : 1 }} transition={{ duration: 1, repeat: Infinity }}
                        className={`w-40 h-40 rounded-[3rem] mx-auto flex items-center justify-center shadow-2xl transition-all duration-700 relative border-8 border-white ${
                            closeness === 'cold' ? 'bg-blue-500 text-white' : closeness === 'warm' ? 'bg-amber-400 text-white' : closeness === 'hot' ? 'bg-orange-500 text-white' : 'bg-red-600 text-white'
                        }`}>
                        {closeness === 'cold' ? <Ghost className="w-16 h-16" /> : closeness === 'warm' ? <Compass className="w-16 h-16" /> : <Sparkles className="w-16 h-16" />}
                    </motion.div>

                    <div className="text-center space-y-2">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">مستوى القرب من الذكرى</p>
                        <h4 className="text-3xl font-serif font-black text-stone-800">
                            {closeness === 'cold' ? 'بعيد كالثلج ❄️' : closeness === 'warm' ? 'بدأت تدفأ! 🌥️' : closeness === 'hot' ? 'قريب جداً! 🔥' : 'الذكرى تشتعل! 🌋'}
                        </h4>
                    </div>

                    {!isHost && (
                        <Button onClick={handleWin} className="w-full max-w-xs h-20 rounded-[2rem] bg-stone-800 text-white shadow-2xl text-xl font-black">حزرتها! 🎉</Button>
                    )}
                </div>

                {isHost && (
                    <div className="fixed bottom-10 left-6 right-6 bg-white p-6 rounded-[2.5rem] shadow-2xl border border-stone-200 space-y-4">
                        <p className="text-[10px] font-black text-stone-400 uppercase text-center">وجه شريكك للوصول للذكرى</p>
                        <div className="grid grid-cols-4 gap-2">
                            {[ {id:'cold', icon:Ghost, color:'bg-blue-500'}, {id:'warm', icon:Compass, color:'bg-amber-400'}, {id:'hot', icon:Heart, color:'bg-orange-500'}, {id:'burning', icon:Sparkles, color:'bg-red-600'} ].map(item => (
                                <button key={item.id} onClick={() => updateCloseness(item.id)} className={`h-14 rounded-2xl flex items-center justify-center transition-all ${closeness === item.id ? `${item.color} text-white scale-110 shadow-lg` : 'bg-stone-50 text-stone-300'}`}>
                                    <item.icon className="w-6 h-6" />
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
            <div className="flex flex-col h-full bg-[#faf9f6] items-center justify-center p-6 text-center">
                <Trophy className="w-20 h-20 text-stone-800 mb-8" />
                <h2 className="text-4xl font-serif font-black mb-4 text-stone-800">ذكرى لا تُنسى! ❤️</h2>
                <div className="bg-white p-8 rounded-3xl shadow-lg border border-stone-100 w-full max-w-xs mb-10">
                    <p className="text-[10px] font-black text-stone-400 uppercase mb-3">الذكرى التي جمعتكم</p>
                    <p className="text-2xl font-serif font-bold text-stone-700 italic leading-relaxed">"{roomData?.game_state.memory_title}"</p>
                </div>
                <Button onClick={onBack} className="w-full max-w-xs h-16 rounded-2xl bg-stone-800 text-white font-black">العودة للألعاب</Button>
            </div>
        );
    }
    return null;
}
