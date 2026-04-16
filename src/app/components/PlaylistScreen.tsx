import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Music, Plus, Heart, Trash2, X, ExternalLink, Play, Radio, Volume2, Pause } from 'lucide-react';
import { supabase } from '../../lib/supabase';

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

export function PlaylistScreen({ onNavigate, userId, partnershipId, isDarkMode }: PlaylistScreenProps) {
    const [songs, setSongs] = useState<Song[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [playingSong, setPlayingSong] = useState<Song | null>(null);
    const [isRadioPlaying, setIsRadioPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [partnerName, setPartnerName] = useState('شريك');
    const [newSong, setNewSong] = useState({ title: '', artist: '', note: '', url: '' });

    useEffect(() => {
        if (partnershipId) {
            fetchSongs();
            fetchPartnerName();
        } else {
            setLoading(false);
        }
    }, [partnershipId]);

    const getYoutubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const handlePlay = (song: Song) => {
        if (!song.url) return;
        const ytId = getYoutubeId(song.url);
        if (ytId) {
            setPlayingSong(song);
        } else {
            window.open(song.url, '_blank');
        }
    };

    const toggleRadio = () => {
        if (!audioRef.current) return;
        if (isRadioPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(e => console.error("Audio play failed:", e));
        }
        setIsRadioPlaying(!isRadioPlaying);
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
        if (!partnershipId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('playlist_songs')
                .select('*')
                .eq('partnership_id', partnershipId)
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error("Error fetching songs:", error);
                return;
            }
            setSongs(data || []);
        } catch (e) {
            console.error("Fetch catch error:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newSong.title.trim()) return;
        if (!partnershipId) {
            alert("خطأ: لم يتم العثور على اشتراك نشط. يرجى إعادة تحميل التطبيق.");
            return;
        }

        const songData = {
            partnership_id: partnershipId,
            added_by: userId,
            title: newSong.title.trim(),
            artist: newSong.artist.trim(),
            note: newSong.note.trim(),
            url: newSong.url.trim() || null,
        };

        const { error } = await supabase.from('playlist_songs').insert(songData);
        
        if (error) {
            console.error("Error adding song:", error);
            alert(`فشل في إضافة الأغنية: ${error.message}`);
            return;
        }

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

    const myCount = songs.filter(s => s.added_by === userId).length;
    const partnerCount = songs.length - myCount;

    return (
        <div className={`flex flex-col h-full ${isDarkMode ? 'dark' : ''} bg-background`}>
            <style>{`
                @keyframes bar-grow {
                    0%, 100% { height: 4px; }
                    50% { height: 12px; }
                }
                .bar-anim { animation: bar-grow 1s infinite ease-in-out; }
                
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 8s linear infinite;
                }
            `}</style>
            
            {/* Background */}
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute top-[-15%] right-[-10%] w-[80%] h-[60%] bg-violet-500/8 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[70%] h-[50%] bg-rose-500/6 blur-[120px] rounded-full" />
            </div>

            {/* Header */}
            <header className="px-8 pt-12 pb-6 sticky top-0 z-40 bg-background/60 backdrop-blur-3xl" dir="rtl">
                <div className="flex items-center justify-between mb-6">
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

            {/* Radio Player (Hidden Audio) */}
            <audio ref={audioRef} src="http://andromeda.shoutca.st:8192/;" crossOrigin="anonymous" />

            {/* Songs list */}
            <div className="flex-1 overflow-y-auto px-8 pb-32 pt-4 scrollbar-hide" dir="rtl">
                {/* ── LIVE RADIO CARD ── */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 relative overflow-hidden rounded-[2.8rem] p-6 border border-rose-500/20 bg-rose-500/[0.03] backdrop-blur-3xl group"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-rose-500/[0.05] to-violet-500/[0.05] opacity-50" />
                    <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={toggleRadio}
                                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg ${isRadioPlaying ? 'bg-rose-500 text-white animate-pulse' : 'bg-white/80 dark:bg-white/10 text-rose-500'}`}
                            >
                                {isRadioPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                            </motion.button>
                            <div className="text-right">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="relative flex h-2 w-2">
                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isRadioPlaying ? 'bg-rose-500' : 'bg-zinc-400'}`}></span>
                                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isRadioPlaying ? 'bg-rose-500' : 'bg-zinc-400'}`}></span>
                                    </span>
                                    <h3 className="text-sm font-black text-foreground tracking-tighter">راديو ألفة المباشر ✨</h3>
                                </div>
                                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">موسيقى تجمع قلوبكم الآن</p>
                            </div>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
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
                                    transition={{ repeat: Infinity, duration: 1 + Math.random(), ease: "easeInOut" }}
                                    className="w-[3px] bg-rose-500/40 rounded-full"
                                />
                            ))}
                        </motion.div>
                    )}
                </motion.div>
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
                    <div className="space-y-8">
                        {songs.map((song, idx) => {
                            const isMe = song.added_by === userId;
                            const isLiked = song.likes?.includes(userId);
                            const colorClass = MUSIC_COLORS[idx % MUSIC_COLORS.length];
                            const dateStr = new Date(song.created_at).toLocaleDateString('ar-JO', { day: 'numeric', month: 'long' });

                            return (
                                <motion.div
                                    key={song.id}
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="group relative"
                                >
                                    {/* The Music Identity Card */}
                                    <div className="relative z-10 bg-white/70 dark:bg-white/[0.04] backdrop-blur-3xl border border-white/60 dark:border-white/[0.08] rounded-[2.8rem] p-6 shadow-2xl shadow-black/[0.03] transition-all hover:shadow-black/[0.06] overflow-hidden flex flex-col">
                                        
                                        {/* Top Header */}
                                        <div className="flex items-center justify-between mb-5">
                                            <span className="text-[11px] font-bold text-muted-foreground/40">{dateStr}</span>
                                            <div className="flex items-center gap-2">
                                                <div className="flex gap-0.5 items-end h-3 pr-2 border-r border-black/5 dark:border-white/10">
                                                    {[0.7, 0.4, 0.8, 0.5].map((s, i) => (
                                                        <div key={i} className="w-[3px] bg-rose-500/40 rounded-full bar-anim" style={{ animationDelay: `${i * 0.2}s`, height: `${s * 100}%` }} />
                                                    ))}
                                                </div>
                                                <div className={`px-3 py-1 rounded-full text-[10px] font-black tracking-tight ${isMe ? 'bg-indigo-500/10 text-indigo-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                    {isMe ? 'أنا' : partnerName}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Main Song Section */}
                                        <div className="flex items-center justify-between mb-6 gap-4">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-xl font-black text-foreground leading-tight tracking-tighter mb-1.5 truncate">{song.title}</h3>
                                                <div className="flex items-center gap-1.5 text-muted-foreground/50">
                                                    <Music size={12} strokeWidth={3} />
                                                    <p className="text-sm font-bold truncate">{song.artist || 'فنان غير معروف'}</p>
                                                </div>
                                            </div>
                                            <motion.button
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => handlePlay(song)}
                                                className={`w-[4.5rem] h-[4.5rem] shrink-0 rounded-[1.8rem] bg-gradient-to-br ${colorClass} flex items-center justify-center shadow-xl text-white relative overflow-hidden group/play`}
                                            >
                                                <Play className="w-8 h-8 fill-current ml-1 relative z-10 transition-transform group-hover/play:scale-110" />
                                                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover/play:opacity-100 transition-opacity" />
                                            </motion.button>
                                        </div>

                                        {/* Mock Playback Progress */}
                                        <div className="mb-6 relative w-full px-1">
                                            <div className="h-1.5 bg-zinc-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-rose-500/40 w-1/3 rounded-full relative" />
                                            </div>
                                            <div className="absolute left-[33%] top-[-3px] w-3 h-3 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                                            <div className="flex justify-between mt-2 opacity-40 text-[9px] font-black" dir="ltr">
                                                <span>0:00</span>
                                                <span>3:45</span>
                                            </div>
                                        </div>

                                        {/* Centered Note */}
                                        {song.note && (
                                            <div className="mb-6 mx-1">
                                                <div className="relative p-5 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04] rounded-3xl">
                                                    <div className="absolute right-3 top-2 text-[32px] font-serif text-rose-500/10">“</div>
                                                    <p className="text-[13px] font-bold text-foreground/70 leading-relaxed italic text-center relative z-10">
                                                        "{song.note}"
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Bottom Actions Bar */}
                                        <div className="flex items-center justify-between pt-4 border-t border-black/5 dark:border-white/[0.05]">
                                            <div className="flex gap-4">
                                                <motion.button
                                                    whileTap={{ scale: 0.8 }}
                                                    onClick={() => handleLike(song)}
                                                    className={`group/heart flex items-center gap-2 px-4 py-2 rounded-full transition-all ${isLiked ? 'bg-rose-500 text-white' : 'glass border-white/20 text-rose-400'}`}
                                                >
                                                    <Heart className="w-4 h-4" fill={isLiked ? 'currentColor' : 'none'} />
                                                    <span className="text-[11px] font-black">{song.likes?.length || 0}</span>
                                                </motion.button>
                                                
                                                {song.url && (
                                                    <motion.button
                                                        whileTap={{ scale: 0.8 }}
                                                        onClick={() => handlePlay(song)}
                                                        className="w-10 h-10 rounded-full glass border-white/20 flex items-center justify-center text-indigo-500"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </motion.button>
                                                )}
                                            </div>

                                            {isMe && (
                                                <motion.button
                                                    whileTap={{ scale: 0.8 }}
                                                    onClick={() => handleDelete(song.id)}
                                                    className="text-rose-400/30 hover:text-rose-500 transition-colors p-2"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </motion.button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add modal */}
            <AnimatePresence>
                {isAdding && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsAdding(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ scale: 0.9, y: 30 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 30 }}
                            className="w-full max-w-md glass border-white/30 p-8 rounded-[3rem] relative z-10"
                            dir="rtl"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-xl font-black tracking-tighter">أضف أغنية 🎵</h3>
                                <button onClick={() => setIsAdding(false)} className="w-10 h-10 glass border-white/20 rounded-2xl flex items-center justify-center text-foreground/40 hover:text-rose-500 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-muted-foreground/40 mr-1 uppercase tracking-[0.2em]">اسم الأغنية *</label>
                                    <input
                                        type="text"
                                        placeholder="مثلاً: Lover..."
                                        className="w-full h-12 px-4 glass border-white/10 rounded-xl text-sm font-bold focus:border-violet-500 transition-all outline-none"
                                        value={newSong.title}
                                        onChange={e => setNewSong({ ...newSong, title: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-muted-foreground/40 mr-1 uppercase tracking-[0.2em]">الفنان</label>
                                    <input
                                        type="text"
                                        placeholder="اسم المغني أو الفرقة"
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
                                        type="url"
                                        placeholder="رابط Spotify أو YouTube..."
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

            {/* Play Modal */}
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
                                    width="100%"
                                    height="100%"
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
