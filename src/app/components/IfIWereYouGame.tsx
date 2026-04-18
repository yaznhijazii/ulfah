import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { UserCircle, Send, Heart, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface IfIWereYouGameProps {
    onBack: () => void;
    userId: string;
    userName: string;
    partnershipId: string | null;
}

interface RoomData {
    id: string;
    room_code: string;
    host_user_id: string;
    guest_user_id: string | null;
    status: string;
    game_state: {
        scenario_text: string;
        answer_text: string | null;
    };
}

function parseState(raw: unknown): RoomData['game_state'] {
    if (typeof raw === 'string') return JSON.parse(raw);
    return raw as RoomData['game_state'];
}

export function IfIWereYouGame({ onBack, userId, userName, partnershipId }: IfIWereYouGameProps) {
    const [joinCode, setJoinCode] = useState('');
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(false);
    const [scenarioDraft, setScenarioDraft] = useState('');
    const [answerDraft, setAnswerDraft] = useState('');
    const [presence, setPresence] = useState<Record<string, unknown>>({});
    const [partnerInfo, setPartnerInfo] = useState<{ id: string; name: string } | null>(null);

    useEffect(() => {
        if (!roomData?.id) return;
        const channel = supabase.channel(`game_iwy_${roomData.id}`, { config: { presence: { key: userId } } })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomData.id}` }, (payload) => {
                const newData = payload.new as Record<string, unknown>;
                setRoomData({
                    ...newData,
                    game_state: parseState(newData.game_state),
                } as RoomData);
            })
            .on('presence', { event: 'sync' }, () => setPresence(channel.presenceState()))
            .subscribe(async (status) => { if (status === 'SUBSCRIBED') await channel.track({ user_id: userId, name: userName }); });
        return () => { supabase.removeChannel(channel); };
    }, [roomData?.id, userId, userName]);

    useEffect(() => {
        if (!partnershipId) return;
        supabase.from('partnerships').select('user1_id, user2_id, user1:user1_id(name), user2:user2_id(name)')
            .eq('id', partnershipId).single().then(({ data }) => {
                if (data) {
                    const isUser1 = data.user1_id === userId;
                    setPartnerInfo({ id: isUser1 ? data.user2_id : data.user1_id, name: isUser1 ? (data.user2 as { name?: string })?.name : (data.user1 as { name?: string })?.name || 'الشريك' });
                }
            });
    }, [partnershipId, userId]);

    const createRoom = async () => {
        setLoading(true);
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const state = { scenario_text: '', answer_text: null as string | null };
        const { data, error } = await supabase.from('game_rooms').insert({
            room_code: code,
            game_type: 'if-i-were-you',
            host_user_id: userId,
            status: 'waiting',
            game_state: state
        }).select().single();
        if (error) { toast.error('تعذّر إنشاء الغرفة'); setLoading(false); return; }
        setRoomData({ ...data, game_state: state } as RoomData);
        setLoading(false);
        if (partnerInfo) {
            await supabase.from('notifications').insert({
                user_id: partnerInfo.id,
                title: 'لو كنت مكاني 💬',
                body: `${userName} عنده موقف ويبغى رأيك: شو بتسوي لو كنت مكانه؟`,
                type: 'game_invite',
                metadata: { room_code: code, game_type: 'if-i-were-you' }
            });
        }
    };

    const joinRoom = async () => {
        if (!joinCode) return;
        setLoading(true);
        const { data: room, error } = await supabase.from('game_rooms').select('*').eq('room_code', joinCode.toUpperCase()).eq('game_type', 'if-i-were-you').eq('status', 'waiting').single();
        if (error || !room) { toast.error('الغرفة غير موجودة'); setLoading(false); return; }
        const { data: updated, error: upErr } = await supabase.from('game_rooms').update({ guest_user_id: userId, status: 'setup' }).eq('id', room.id).select().single();
        if (upErr || !updated) { toast.error('تعذّر الانضمام'); setLoading(false); return; }
        setRoomData({ ...updated, game_state: parseState(updated.game_state) });
        setLoading(false);
    };

    const submitScenario = async () => {
        if (!roomData || !scenarioDraft.trim()) return;
        setLoading(true);
        const newState = { ...roomData.game_state, scenario_text: scenarioDraft.trim() };
        await supabase.from('game_rooms').update({ game_state: newState, status: 'playing' }).eq('id', roomData.id);
        setLoading(false);
        toast.success('تم إرسال الموقف للشريك');
    };

    const submitAnswer = async () => {
        if (!roomData || !answerDraft.trim()) return;
        setLoading(true);
        const newState = { ...roomData.game_state, answer_text: answerDraft.trim() };
        await supabase.from('game_rooms').update({ game_state: newState, status: 'finished' }).eq('id', roomData.id);
        setLoading(false);
        toast.success('تم إرسال ردك 💌');
    };

    const isHost = roomData ? userId === roomData.host_user_id : false;
    const gs = roomData?.game_state;
    const isPartnerInLobby = !!(partnerInfo && presence[partnerInfo.id]);

    if (!roomData) {
        return (
            <div dir="rtl" className="flex flex-col h-full bg-gradient-to-b from-sky-50 to-white dark:from-sky-950/40 dark:to-[#0c0a12] p-6">
                <div className="flex-1 flex flex-col justify-center gap-6 pb-20">
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white dark:bg-white/5 rounded-[2.5rem] p-10 text-center shadow-xl border border-sky-100 dark:border-white/10">
                        <div className="w-20 h-20 bg-sky-500 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg">
                            <UserCircle className="w-11 h-11" />
                        </div>
                        <h2 className="text-2xl font-black mb-3 text-sky-950 dark:text-white">لو كنت مكاني…</h2>
                        <p className="text-sky-800/70 dark:text-sky-200/80 font-bold text-sm mb-10 leading-relaxed">
                            اكتب موقفاً واحداً لشريكك، واسأله: <span className="text-sky-600 dark:text-sky-400">وش رح تسوي لو كنت مكاني؟</span> وهو يرد بصراحة.
                        </p>
                        <Button onClick={createRoom} disabled={loading} className="w-full h-16 rounded-2xl text-lg font-black bg-sky-600 hover:bg-sky-700 text-white shadow-xl">
                            {loading ? 'ثوانِ..' : '🚀 إنشاء جلسة'}
                        </Button>
                    </motion.div>
                    <div className="space-y-4">
                        <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="كود الجلسة.." className="w-full h-16 rounded-2xl bg-white/80 dark:bg-white/5 border-2 border-sky-100 dark:border-white/10 px-6 text-center text-xl font-black outline-none focus:border-sky-400" />
                        <Button onClick={joinRoom} disabled={!joinCode || loading} variant="secondary" className="w-full h-16 rounded-2xl text-lg font-black">دخول كشريك</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (roomData.status === 'waiting') {
        return (
            <div dir="rtl" className="flex flex-col h-full bg-gradient-to-b from-sky-50 to-white dark:from-sky-950/40 dark:to-[#0c0a12] p-6 pt-12 items-center text-center">
                <h2 className="text-2xl font-black mb-8 text-sky-950 dark:text-white">بانتظار الشريك…</h2>
                <div className="bg-white dark:bg-white/5 w-full max-w-xs rounded-[2.5rem] p-8 shadow-xl border-2 border-dashed border-sky-200 dark:border-sky-500/30 mb-8">
                    <p className="text-[10px] font-black text-sky-400 uppercase mb-2">الكود</p>
                    <p className="text-4xl font-black text-sky-600 dark:text-sky-400 tracking-widest">{roomData.room_code}</p>
                </div>
                <div className={`p-5 rounded-2xl border w-full max-w-xs ${isPartnerInLobby ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200' : 'bg-white/50 dark:bg-white/5 opacity-70'}`}>
                    <p className="font-black text-sky-950 dark:text-white">{partnerInfo?.name || 'الشريك'}</p>
                    <span className={`text-[10px] font-black ${isPartnerInLobby ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {isPartnerInLobby ? 'متصل ✅' : 'بانتظار الدخول…'}
                    </span>
                </div>
            </div>
        );
    }

    if (roomData.status === 'setup') {
        if (!isHost) {
            return (
                <div dir="rtl" className="flex flex-col h-full items-center justify-center p-8 text-center bg-sky-50/50 dark:bg-[#0c0a12]">
                    <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="text-5xl mb-6">✍️</motion.div>
                    <p className="text-lg font-black text-sky-950 dark:text-white mb-2">شريكك يكتب الموقف…</p>
                    <p className="text-sm text-muted-foreground font-bold">خلّيه يخلص ويوصلك السؤال</p>
                </div>
            );
        }
        return (
            <div dir="rtl" className="flex flex-col h-full bg-sky-50/30 dark:bg-[#0c0a12] p-6 pt-8">
                <h2 className="text-xl font-black text-sky-950 dark:text-white mb-2">صف الموقف</h2>
                <p className="text-sm text-muted-foreground font-bold mb-6">اكتب موقفاً واحداً، ثم اسأل بالصمت: لو كنت مكاني، وش بتسوي؟</p>
                <textarea
                    value={scenarioDraft}
                    onChange={(e) => setScenarioDraft(e.target.value)}
                    placeholder="مثال: موقف في الشغل أو العائلة يزعجك…"
                    rows={8}
                    dir="rtl"
                    className="w-full rounded-3xl border-2 border-sky-100 dark:border-white/10 bg-white dark:bg-white/5 p-5 text-base font-bold resize-none focus:ring-2 focus:ring-sky-400 mb-6"
                />
                <Button onClick={submitScenario} disabled={loading || !scenarioDraft.trim()} className="w-full h-14 rounded-2xl font-black bg-sky-600 text-lg">
                    <Send className="w-5 h-5 ms-2" /> إرسال للشريك
                </Button>
            </div>
        );
    }

    if (roomData.status === 'playing' && gs?.scenario_text?.trim()) {
        if (!gs.answer_text) {
            if (isHost) {
                return (
                    <div dir="rtl" className="flex flex-col h-full p-6 pt-10 bg-sky-50/30 dark:bg-[#0c0a12]">
                        <p className="text-[10px] font-black text-sky-500 uppercase mb-4">الموقف اللي كتبته</p>
                        <div className="bg-white dark:bg-white/5 rounded-3xl p-6 border mb-8 text-start">
                            <p className="text-base font-bold leading-relaxed text-foreground">{gs.scenario_text}</p>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-90">
                            <Heart className="w-12 h-12 text-sky-400 animate-pulse" />
                            <p className="font-black text-sky-900 dark:text-white">بانتظار رد {partnerInfo?.name}…</p>
                        </div>
                    </div>
                );
            }
            return (
                <div dir="rtl" className="flex flex-col h-full bg-sky-50/30 dark:bg-[#0c0a12] p-6 pt-8">
                    <p className="text-[10px] font-black text-sky-500 uppercase mb-4">موقف من شريكك</p>
                    <div className="bg-white dark:bg-white/5 rounded-3xl p-6 border mb-6">
                        <p className="text-lg font-black leading-relaxed text-start">{gs.scenario_text}</p>
                    </div>
                    <h3 className="text-sm font-black text-sky-800 dark:text-sky-200 mb-3">لو كنت مكانه… وش رح تسوي؟</h3>
                    <textarea
                        value={answerDraft}
                        onChange={(e) => setAnswerDraft(e.target.value)}
                        placeholder="اكتب ردك بصراحة 💙"
                        rows={6}
                        dir="rtl"
                        className="w-full rounded-3xl border-2 border-sky-100 dark:border-white/10 bg-white dark:bg-white/5 p-5 font-bold resize-none mb-6 min-h-[140px]"
                    />
                    <Button onClick={submitAnswer} disabled={loading || !answerDraft.trim()} className="w-full h-14 rounded-2xl font-black bg-sky-600 text-lg">
                        إرسال الرد
                    </Button>
                </div>
            );
        }
    }

    if (roomData.status === 'finished' && gs?.scenario_text && gs?.answer_text) {
        return (
            <div dir="rtl" className="flex flex-col h-full items-center justify-center p-6 bg-gradient-to-b from-sky-50 to-white dark:from-sky-950/30 dark:to-[#0c0a12] overflow-y-auto">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-6 shrink-0" />
                <h2 className="text-2xl font-black text-sky-950 dark:text-white mb-6">جلسة مكتملة</h2>
                <div className="w-full max-w-md space-y-4 mb-10">
                    <div className="bg-white dark:bg-white/5 rounded-3xl p-6 border text-start">
                        <p className="text-[10px] font-black text-sky-400 uppercase mb-2">الموقف</p>
                        <p className="font-bold leading-relaxed">{gs.scenario_text}</p>
                    </div>
                    <div className="bg-sky-500/10 rounded-3xl p-6 border border-sky-200/50 text-start">
                        <p className="text-[10px] font-black text-sky-600 uppercase mb-2">الرد</p>
                        <p className="font-bold leading-relaxed">{gs.answer_text}</p>
                    </div>
                </div>
                <Button onClick={onBack} className="w-full max-w-xs h-14 rounded-2xl font-black bg-sky-700">العودة للألعاب</Button>
            </div>
        );
    }

    return (
        <div dir="rtl" className="flex h-full items-center justify-center p-6">
            <p className="text-muted-foreground font-bold">جاري التحميل…</p>
        </div>
    );
}
