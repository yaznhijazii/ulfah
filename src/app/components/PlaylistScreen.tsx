import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Music, Plus, Heart, Trash2, X, ExternalLink, Play, Radio, Pause } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface Song {
    id: string;
    title: string;
    artist: string;
    note: string;
    url?: string;
    added_by: string;
    created_at: string;
    likes?: string[];
}

interface PlaylistScreenProps {
    onNavigate: (screen: string) => void;
    userId: string;
    partnershipId: string | null;
    isDarkMode: boolean;
}

const MUSIC_COLORS = [
    'from-rose-500 to-pink-600',
    'from-violet-500 to-purple-600',
    'from-amber-500 to-orange-600',
    'from-teal-500 to-cyan-600',
    'from-blue-500 to-indigo-600',
];

const PROGRESS = 33; // mock progress % shown on each card

export function PlaylistScreen({ onNavigate, userId, partnershipId, isDarkMode }: PlaylistScreenProps) {
    const [songs, setSongs] = useState<Song[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [playingSong, setPlayingSong] = useState<Song | null>(null);
    const [isRadioPlaying, setIsRadioPlaying] = useState(false);
    const [partnerName, setPartnerName] = useState('شريك');
    const [newSong, setNewSong] = useState({ title: '', artist: '', note: '', url: '' });

    useEffect(() => {
        if (partnershipId) {
            fetchSongs();
            fetchPartnerName();
        } else {
            setLoading(false);
        }
        const audioEl = document.getElementById('global-radio-ulfah') as HTMLAudioElement;
        if (audioEl) {
            setIsRadioPlaying(!audioEl.paused);
            const onPlay = () => setIsRadioPlaying(true);
            const onPause = () => setIsRadioPlaying(false);
            audioEl.addEventListener('play', onPlay);
            audioEl.addEventListener('pause', onPause);
            return () => {
                audioEl.removeEventListener('play', onPlay);
                audioEl.removeEventListener('pause', onPause);
            };
        }
    }, [partnershipId]);

    const getYoutubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const handlePlay = (song: Song) => {
        if (!song.url) {
            toast.error('رابط الموسيقى غير متوفر');
            return;
        }
        const ytId = getYoutubeId(song.url);
        if (ytId) {
            setPlayingSong(song);
        } else {
            window.open(song.url, '_blank');
        }
    };

    const toggleRadio = () => {
        const audioEl = document.getElementById('global-radio-ulfah') as HTMLAudioElement;
        if (!audioEl) return;
        if (isRadioPlaying) {
            audioEl.pause();
            setIsRadioPlaying(false);
            toast.info('تم إيقاف الراديو');
        } else {
            toast.loading('جاري تشغيل الراديو...', { id: 'radio-play' });
            
            // Re-assign src to ensure browser recognizes it as a fresh user-initiated request if needed
            if (!audioEl.src || audioEl.src.includes('undefined') || !audioEl.src.includes('radio.co')) {
                audioEl.src = "https://streamer.radio.co/sf2fa6ce9d/listen";
            }

            const playPromise = audioEl.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        setIsRadioPlaying(true);
                        toast.success('البث المباشر يعمل الآن 🎶', { id: 'radio-play' });
                    })
                    .catch(e => {
                        console.error('Audio play failed:', e);
                        setIsRadioPlaying(false);
                        toast.error('فشل تشغيل البث. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.', { id: 'radio-play' });
                    });
            }
        }
    };

    const fetchPartnerName = async () => {
        if (!partnershipId) return;
        const { data } = await supabase
            .from('partnerships')
            .select('user1:user1_id(name), user2:user2_id(name), user1_id')
            .eq('id', partnershipId)
            .single();
        if (data) {
            const name = data.user1_id === userId ? (data as any).user2?.name : (data as any).user1?.name;
            setPartnerName(name || 'شريك');
        }
    };

    const fetchSongs = async () => {
        if (!partnershipId) { setLoading(false); return; }
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('playlist_songs')
                .select('*')
                .eq('partnership_id', partnershipId)
                .order('created_at', { ascending: false });
            if (error) { console.error('Error fetching songs:', error); return; }
            setSongs(data || []);
        } catch (e) {
            console.error('Fetch catch error:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newSong.title.trim()) return;
        if (!partnershipId) { alert('خطأ: لم يتم العثور على اشتراك نشط.'); return; }

        const songData = {
            partnership_id: partnershipId,
            added_by: userId,
            title: newSong.title.trim(),
            artist: newSong.artist.trim(),
            note: newSong.note.trim(),
            url: newSong.url.trim() || null,
        };

        const { error } = await supabase.from('playlist_songs').insert(songData);
        if (error) { console.error('Error adding song:', error); alert(`فشل: ${error.message}`); return; }

        setNewSong({ title: '', artist: '', note: '', url: '' });
        setIsAdding(false);
        fetchSongs();
    };

    const handleLike = async (song: Song) => {
        const likes = song.likes || [];
        const isLiked = likes.includes(userId);
        const newLikes = isLiked ? likes.filter(id => id !== userId) : [...likes, userId];
        setSongs(prev => prev.map(s => s.id === song.id ? { ...s, likes: newLikes } : s));
        await supabase.from('playlist_songs').update({ likes: newLikes }).eq('id', song.id);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('حذف هذه الأغنية؟')) return;
        await supabase.from('playlist_songs').delete().eq('id', id);
        setSongs(prev => prev.filter(s => s.id !== id));
    };

    return (
        <div className={`flex flex-col h-full ${isDarkMode ? 'dark' : ''} bg-background`}>
            <style>{`
                @keyframes bar-grow {
                    0%, 100% { height: 4px; }
                    50% { height: 12px; }
                }
                .bar-anim { animation: bar-grow 1s infinite ease-in-out; }
            `}</style>

            {/* Background */}
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute top-[-15%] right-[-10%] w-[80%] h-[60%] bg-violet-500/8 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[70%] h-[50%] bg-rose-500/6 blur-[120px] rounded-full" />
            </div>

            {/* Header */}
            <header className="px-6 pt-12 pb-5 sticky top-0 z-40 bg-background/60 backdrop-blur-3xl" dir="rtl">
                <div className="flex items-center justify-between">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onNavigate('home')}
                        className="w-11 h-11 flex items-center justify-center glass rounded-2xl border-white/60 shadow-xl text-foreground/40"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </motion.button>
                    <div className="text-center">
                        <h1 className="text-xl font-black text-foreground tracking-tighter">بلايليستنا</h1>
                        <p className="text-[8px] font-black text-violet-600/40 uppercase tracking-[0.5em]">أغاني تجمعنا</p>
                    </div>
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsAdding(true)}
                        className="w-11 h-11 flex items-center justify-center bg-violet-600 rounded-2xl shadow-xl shadow-violet-500/20 text-white"
                    >
                        <Plus className="w-5 h-5" />
                    </motion.button>
                </div>
            </header>

            {/* Header */}
            <div className="flex-1 overflow-y-auto px-5 pb-32 pt-4 scrollbar-hide" dir="rtl">

                {/* ── LIVE RADIO CARD ── */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={toggleRadio}
                    className="mb-6 relative overflow-hidden rounded-[2rem] p-5 border border-rose-500/20 bg-rose-500/[0.03] backdrop-blur-3xl cursor-pointer transition-all active:brightness-95"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-rose-500/[0.05] to-violet-500/[0.05] pointer-events-none" />
                    <div className="relative z-10 flex items-center justify-between pointer-events-none">
                        <div className="flex items-center gap-4 pointer-events-auto">
                            <div
                                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${isRadioPlaying ? 'bg-rose-500 text-white animate-pulse' : 'bg-white dark:bg-white/10 text-rose-500 shadow-rose-500/10'}`}
                            >
                                {isRadioPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                            </div>
                            <div className="text-right">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="relative flex h-2 w-2">
                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isRadioPlaying ? 'bg-rose-500' : 'bg-zinc-400'}`} />
                                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isRadioPlaying ? 'bg-rose-500' : 'bg-zinc-400'}`} />
                                    </span>
                                    <h3 className="text-sm font-black text-foreground tracking-tighter">راديو ألفة المباشر ✨</h3>
                                </div>
                                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">موسيقى تجمع قلوبكم الآن</p>
                            </div>
                        </div>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all pointer-events-auto ${isRadioPlaying ? 'bg-rose-500/20 text-rose-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            <Radio size={20} className={isRadioPlaying ? 'animate-bounce' : ''} />
                        </div>
                    </div>

                    {isRadioPlaying && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-4 flex items-center justify-center gap-1.5 h-6"
                        >
                            {[...Array(12)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    animate={{ height: [4, 16, 8, 20, 4] }}
                                    transition={{ repeat: Infinity, duration: 1 + Math.random(), ease: 'easeInOut' }}
                                    className="w-[3px] bg-rose-500/40 rounded-full"
                                />
                            ))}
                        </motion.div>
                    )}
                </motion.div>

                {/* ── SONGS LIST ── */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-40">
                        <div className="w-10 h-10 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] font-black text-violet-500 uppercase tracking-widest">جاري تحميل الأغاني...</span>
                    </div>
                ) : songs.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center justify-center py-32 text-center"
                    >
                        <div className="w-24 h-24 rounded-[2rem] bg-violet-500/10 flex items-center justify-center mb-6 border border-violet-500/20">
                            <Music className="w-10 h-10 text-violet-400/50" />
                        </div>
                        <h3 className="text-xl font-black mb-2 tracking-tight">البلايليست فارغة</h3>
                        <p className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-widest mb-8">ابدأوا بإضافة أول أغنية</p>
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsAdding(true)}
                            className="px-8 py-4 bg-violet-600 text-white rounded-2xl font-black text-sm shadow-2xl shadow-violet-500/20"
                        >
                            + أضف أغنية
                        </motion.button>
                    </motion.div>
                ) : (
                    <div className="space-y-5">
                        {songs.map((song, idx) => {
                            const isMe = song.added_by === userId;
                            const isLiked = song.likes?.includes(userId);
                            const colorClass = MUSIC_COLORS[idx % MUSIC_COLORS.length];
                            const dateStr = new Date(song.created_at).toLocaleDateString('ar-JO', { day: 'numeric', month: 'long' });

                            return (
                                <motion.div
                                    key={song.id}
                                    initial={{ opacity: 0, y: 24 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.06, ease: [0.22, 1, 0.36, 1] }}
                                >
                                    {/* ── Song Card ── */}
                                    <div className="bg-white/80 dark:bg-white/[0.05] backdrop-blur-3xl border border-white/70 dark:border-white/10 rounded-[2rem] overflow-hidden shadow-xl shadow-black/[0.04]">

                                        {/* Gradient Banner with song info + play */}
                                        <div className={`relative h-20 bg-gradient-to-r ${colorClass} flex items-center justify-between px-5`}>
                                            <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
                                            <div className="absolute -right-2 -bottom-4 w-16 h-16 rounded-full bg-white/10" />

                                            <div className="relative z-10 flex-1 min-w-0 pr-2">
                                                <h3 className="text-lg font-black text-white leading-tight tracking-tighter truncate text-right">{song.title}</h3>
                                                <p className="text-[11px] font-bold text-white/70 truncate text-right mt-1">{song.artist || 'فنان غير معروف'}</p>
                                            </div>

                                            <motion.button
                                                whileHover={{ scale: 1.08 }}
                                                whileTap={{ scale: 0.92 }}
                                                onClick={(e) => { e.stopPropagation(); handlePlay(song); }}
                                                className="relative z-10 w-12 h-12 rounded-full bg-white/30 backdrop-blur-md border border-white/50 flex items-center justify-center shadow-lg shrink-0 ml-3 group/playbtn"
                                            >
                                                <Play className="w-5 h-5 fill-white text-white ml-0.5 transition-transform group-hover/playbtn:scale-110" />
                                            </motion.button>
                                        </div>

                                        {/* Progress Bar — LTR so dot sits at right end of filled track */}
                                        <div className="px-5 pt-3 pb-1" dir="ltr">
                                            <div className="relative h-[5px] bg-zinc-100 dark:bg-white/10 rounded-full">
                                                {/* Filled track */}
                                                <div
                                                    className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${colorClass} opacity-70`}
                                                    style={{ width: `${PROGRESS}%` }}
                                                />
                                                {/* Thumb dot: centered vertically, horizontally offset by -50% so it sits exactly at the end */}
                                                <div
                                                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[14px] h-[14px] rounded-full bg-rose-500 border-2 border-white shadow-[0_0_10px_rgba(244,63,94,0.7)] z-10"
                                                    style={{ left: `${PROGRESS}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between mt-1.5 text-[10px] font-bold text-muted-foreground/40">
                                                <span>0:00</span>
                                                <span>3:45</span>
                                            </div>
                                        </div>

                                        {/* Note */}
                                        {song.note && (
                                            <div className="mx-5 mb-2 mt-1" dir="rtl">
                                                <div className="relative p-4 bg-zinc-50/80 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/5 rounded-2xl">
                                                    <span className="absolute right-3 top-1 text-2xl font-serif text-rose-400/20">"</span>
                                                    <p className="text-[12px] font-semibold text-foreground/60 leading-relaxed italic text-center">
                                                        "{song.note}"
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Actions Row */}
                                        <div className="flex items-center justify-between px-5 py-3 border-t border-black/[0.04] dark:border-white/[0.05]" dir="rtl">
                                            <span className="text-[10px] font-bold text-muted-foreground/35">{dateStr}</span>

                                            <div className="flex items-center gap-2">
                                                {/* Added-by badge */}
                                                <div className={`px-2.5 py-0.5 rounded-full text-[9px] font-black ${isMe ? 'bg-indigo-500/10 text-indigo-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                    {isMe ? 'أنا' : partnerName}
                                                </div>

                                                {/* Like */}
                                                <motion.button
                                                    whileTap={{ scale: 0.75 }}
                                                    onClick={() => handleLike(song)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black transition-all ${isLiked ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30' : 'text-rose-400 bg-rose-50 dark:bg-rose-500/10'}`}
                                                >
                                                    <Heart className="w-3.5 h-3.5" fill={isLiked ? 'currentColor' : 'none'} />
                                                    {song.likes?.length || 0}
                                                </motion.button>

                                                {/* Open link */}
                                                {song.url && (
                                                    <motion.button
                                                        whileTap={{ scale: 0.8 }}
                                                        onClick={() => handlePlay(song)}
                                                        className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-400"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </motion.button>
                                                )}

                                                {/* Delete */}
                                                {isMe && (
                                                    <motion.button
                                                        whileTap={{ scale: 0.8 }}
                                                        onClick={() => handleDelete(song.id)}
                                                        className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-300 hover:text-rose-500 transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </motion.button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── ADD MODAL ── */}
            <AnimatePresence>
                {isAdding && (
                    <div className="fixed inset-0 z-[100] flex items-end justify-center">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsAdding(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="w-full max-w-lg glass border-white/30 p-8 rounded-t-[2.5rem] relative z-10 pb-10"
                            dir="rtl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-black tracking-tighter">أضف أغنية 🎵</h3>
                                <button onClick={() => setIsAdding(false)} className="w-10 h-10 glass border-white/20 rounded-2xl flex items-center justify-center text-foreground/40 hover:text-rose-500 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-muted-foreground/40 mr-1 uppercase tracking-[0.2em]">اسم الأغنية *</label>
                                    <input
                                        type="text" placeholder="مثلاً: Lover..."
                                        className="w-full h-12 px-4 glass border-white/10 rounded-xl text-sm font-bold focus:border-violet-500 transition-all outline-none"
                                        value={newSong.title}
                                        onChange={e => setNewSong({ ...newSong, title: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-muted-foreground/40 mr-1 uppercase tracking-[0.2em]">الفنان</label>
                                    <input
                                        type="text" placeholder="اسم المغني أو الفرقة"
                                        className="w-full h-12 px-4 glass border-white/10 rounded-xl text-sm font-bold focus:border-violet-500 transition-all outline-none"
                                        value={newSong.artist}
                                        onChange={e => setNewSong({ ...newSong, artist: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-muted-foreground/40 mr-1 uppercase tracking-[0.2em]">لماذا هذه الأغنية؟</label>
                                    <textarea
                                        placeholder="ما الذي تُذكّرك به..."
                                        rows={3}
                                        className="w-full px-4 py-3 glass border-white/10 rounded-xl text-sm font-bold focus:border-violet-500 transition-all outline-none resize-none"
                                        value={newSong.note}
                                        onChange={e => setNewSong({ ...newSong, note: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-muted-foreground/40 mr-1 uppercase tracking-[0.2em]">رابط (اختياري)</label>
                                    <input
                                        type="url" placeholder="رابط Spotify أو YouTube..."
                                        className="w-full h-12 px-4 glass border-white/10 rounded-xl text-sm font-bold focus:border-violet-500 transition-all outline-none"
                                        value={newSong.url}
                                        onChange={e => setNewSong({ ...newSong, url: e.target.value })}
                                    />
                                </div>
                                <button
                                    onClick={handleAdd}
                                    disabled={!newSong.title.trim()}
                                    className="w-full h-14 bg-violet-600 text-white rounded-2xl font-black text-sm shadow-2xl shadow-violet-500/20 disabled:opacity-40 transition-all active:scale-95"
                                >
                                    إضافة للبلايليست
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── YOUTUBE PLAY MODAL ── */}
            <AnimatePresence>
                {playingSong && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setPlayingSong(null)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="w-full max-w-2xl bg-zinc-900 rounded-[2.5rem] overflow-hidden relative z-10 shadow-2xl"
                        >
                            <div className="p-6 flex items-center justify-between border-b border-white/10" dir="rtl">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400">
                                        <Music size={20} />
                                    </div>
                                    <div className="text-right">
                                        <h3 className="text-white font-black text-sm leading-none mb-1">{playingSong.title}</h3>
                                        <p className="text-zinc-500 text-[10px] font-bold">{playingSong.artist}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setPlayingSong(null)}
                                    className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-zinc-400 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="aspect-video w-full">
                                <iframe
                                    width="100%" height="100%"
                                    src={`https://www.youtube.com/embed/${getYoutubeId(playingSong.url!)}?autoplay=1`}
                                    title="YouTube video player"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            </div>
                            {playingSong.note && (
                                <div className="p-6 bg-zinc-800/50" dir="rtl">
                                    <p className="text-zinc-400 text-xs italic leading-relaxed font-bold">"{playingSong.note}"</p>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
