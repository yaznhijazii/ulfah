import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Send, Type, Heart, MessageCircle, Repeat, Share2, Sparkles, Feather, PenLine } from 'lucide-react';
import { Button } from './ui/button';
import { supabase } from '../../lib/supabase';

interface LoveNotesScreenProps {
    onNavigate: (screen: string) => void;
    userId: string;
    partnershipId: string | null;
    isDarkMode: boolean;
}

interface Note {
    id: string;
    content: string;
    font_style: string;
    created_at: string;
    author_id: string;
    likes?: string[];
    author?: {
        name: string;
        avatar_url: string;
    };
}

export function LoveNotesScreen({ onNavigate, userId, partnershipId, isDarkMode }: LoveNotesScreenProps) {
    const [notes, setNotes] = useState<Note[]>([]);
    const [newNote, setNewNote] = useState('');
    const [selectedFont, setSelectedFont] = useState('font-normal');
    const [isWriting, setIsWriting] = useState(false);
    const [loading, setLoading] = useState(false);

    const weights = [
        { name: 'خفيف', value: 'font-light' },
        { name: 'عادي', value: 'font-normal' },
        { name: 'متوسط', value: 'font-medium' },
        { name: 'عريض', value: 'font-bold' },
        { name: 'داكن', value: 'font-black' },
    ];

    useEffect(() => {
        if (partnershipId) {
            fetchNotes();
        }
    }, [partnershipId]);

    const fetchNotes = async () => {
        if (!partnershipId) return;
        const { data, error } = await supabase
            .from('love_notes')
            .select(`
                *,
                author:author_id(name, avatar_url)
            `)
            .eq('partnership_id', partnershipId)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setNotes(data);
        }
    };

    const handleLike = async (noteId: string, currentLikes: string[] | null) => {
        const likes = currentLikes || [];
        const isLiked = likes.includes(userId);
        let newLikes = isLiked ? likes.filter(id => id !== userId) : [...likes, userId];

        setNotes(notes.map(n => n.id === noteId ? { ...n, likes: newLikes } : n));

        await supabase.from('love_notes').update({ likes: newLikes }).eq('id', noteId);
    };

    const handleSaveNote = async () => {
        if (!newNote.trim() || !partnershipId) return;
        setLoading(true);

        const { error } = await supabase.from('love_notes').insert({
            partnership_id: partnershipId,
            author_id: userId,
            content: newNote,
            font_style: selectedFont
        });

        if (!error) {
            setNewNote('');
            setIsWriting(false);
            fetchNotes();
        }
        setLoading(false);
    };

    const NoteCard = ({ note, index }: { note: Note, index: number }) => {
        const isLiked = note.likes?.includes(userId);
        const isAuthor = note.author_id === userId;

        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: index * 0.1, type: "spring", stiffness: 100 }}
                className="glass rounded-[3rem] p-8 border-white/50 mb-8 max-w-md mx-auto w-full relative group bg-white/40 overflow-hidden"
            >
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />

                <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className="flex items-center gap-4 text-right">
                        <div className="w-12 h-12 rounded-xl bg-secondary border border-white/20 overflow-hidden shadow-2xl">
                            {note.author?.avatar_url ? (
                                <img src={note.author.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-black text-lg">
                                    {note.author?.name?.[0]}
                                </div>
                            )}
                        </div>
                        <div>
                            <span className="text-sm font-black text-foreground block">{isAuthor ? 'أنا' : note.author?.name}</span>
                            <span className="text-[9px] font-black text-primary/40 tracking-[0.3em] uppercase">سليل المودة</span>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl glass border-white/40 flex items-center justify-center text-primary/20">
                        <Sparkles className="w-5 h-5" />
                    </div>
                </div>

                <div className={`text-right ${note.font_style} text-3xl leading-[1.5] text-foreground tracking-tight whitespace-pre-wrap mb-12 relative z-10 px-2`}>
                    {note.content}
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-primary/5 relative z-10">
                    <div className="flex items-center gap-8">
                        <motion.button
                            whileTap={{ scale: 0.8 }}
                            onClick={() => handleLike(note.id, note.likes || [])}
                            className={`flex items-center gap-3 transition-all ${isLiked ? 'text-primary' : 'text-muted-foreground/30 hover:text-primary/60'}`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isLiked ? 'bg-primary/10 shadow-lg shadow-primary/5' : 'glass border-white/20'}`}>
                                <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} strokeWidth={2.5} />
                            </div>
                            {note.likes && note.likes.length > 0 && <span className="text-[10px] font-black">{note.likes.length}</span>}
                        </motion.button>
                        <button className="w-10 h-10 rounded-xl glass border-white/20 flex items-center justify-center text-muted-foreground/30 hover:text-foreground/40 transition-all">
                            <MessageCircle className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="text-[9px] font-black text-muted-foreground/20 uppercase tracking-widest bg-black/[0.02] px-4 py-2 rounded-full border border-white/5">
                        {new Date(note.created_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'long' })}
                    </div>
                </div>
            </motion.div>
        );
    };

    return (
        <div className="flex-1 bg-background flex flex-col relative h-full overflow-hidden mood-love">
            {/* Romantic Red Atmospheric Aura */}
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute top-[-20%] left-[-10%] w-[100%] h-[70%] bg-rose-500/10 blur-[180px] rounded-full opacity-60" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[50%] bg-rose-500/5 blur-[120px] rounded-full opacity-40" />
            </div>

            <header className="px-8 pt-10 pb-6 flex items-center justify-between sticky top-0 bg-background/40 backdrop-blur-3xl z-30">
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onNavigate('home')}
                    className="w-12 h-12 flex items-center justify-center glass rounded-2xl border-white/60 shadow-xl text-foreground/40"
                >
                    <ArrowLeft className="w-5 h-5" />
                </motion.button>
                <div className="text-center">
                    <h1 className="text-xl font-black text-foreground tracking-tighter">خاطرات الألفة</h1>
                    <p className="text-[9px] font-black text-rose-600/40 uppercase tracking-[0.4em]">كلمات تخلد في الوجدان</p>
                </div>
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsWriting(!isWriting)}
                    className={`w-12 h-12 flex items-center justify-center rounded-2xl glass border shadow-2xl transition-all duration-500 ${isWriting ? 'bg-rose-500 text-white border-rose-500 shadow-rose-500/20' : 'border-white/60 text-rose-500'}`}
                >
                    {isWriting ? <ArrowLeft className="w-5 h-5 rotate-90" /> : <PenLine className="w-5 h-5" />}
                </motion.button>
            </header>

            <div className="flex-1 overflow-y-auto px-8 pb-40 pt-6 scrollbar-hide">
                <AnimatePresence mode="wait">
                    {isWriting ? (
                        <motion.div
                            key="composer"
                            initial={{ opacity: 0, scale: 0.95, y: 50 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 30 }}
                            className="glass rounded-[3.5rem] p-10 border-white/80 shadow-[0_40px_100px_rgba(0,0,0,0.1)] bg-white/40 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
                                <Feather className="w-40 h-40 text-primary" />
                            </div>

                            <div className="mb-8 flex items-center gap-3 text-primary relative z-10">
                                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <PenLine className="w-5 h-5" />
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-[0.5em]">بوح القلم</span>
                            </div>

                            <textarea
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                placeholder="صف شعورك الآن..."
                                className={`w-full min-h-[250px] bg-transparent border-none outline-none text-3xl text-foreground placeholder:text-primary/10 resize-none mb-10 relative z-10 leading-snug ${selectedFont} text-right`}
                                autoFocus
                            />

                            <div className="flex items-center gap-3 overflow-x-auto pb-6 scrollbar-hide mb-10 border-b border-primary/5 relative z-10">
                                {weights.map(weight => (
                                    <button
                                        key={weight.value}
                                        onClick={() => setSelectedFont(weight.value)}
                                        className={`px-7 py-3 rounded-2xl text-[10px] font-black whitespace-nowrap transition-all duration-500 border-2 ${selectedFont === weight.value ? 'bg-primary text-white border-primary shadow-2xl shadow-primary/30 scale-105' : 'glass border-white/40 text-primary/40'}`}
                                    >
                                        {weight.name}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={handleSaveNote}
                                disabled={loading || !newNote.trim()}
                                className="w-full h-18 bg-primary text-white rounded-[2.2rem] text-lg font-black shadow-[0_20px_60px_rgba(var(--primary-rgb),0.3)] hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-30 relative z-10 border-t border-white/20"
                            >
                                {loading ? 'جاري تخليد الكلمات...' : 'تسجيل في خلدنا'}
                            </button>
                        </motion.div>
                    ) : (
                        <div className="space-y-4">
                            {notes.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-96 text-center opacity-20">
                                    <Feather className="w-16 h-16 mb-6" />
                                    <p className="font-black text-xl">لا رسائل بعد</p>
                                    <p className="text-[10px] font-bold uppercase tracking-widest mt-2">كن أنت من يبدأ بالكلمة الطيبة</p>
                                </div>
                            ) : (
                                notes.map((note, i) => <NoteCard key={note.id} note={note} index={i} />)
                            )}
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
