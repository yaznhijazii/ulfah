
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Send, Type, Image as ImageIcon, Heart, MessageCircle, Repeat, Share2, MoreHorizontal } from 'lucide-react';
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
    author?: {
        name: string;
        avatar_url: string;
    };
}

export function LoveNotesScreen({ onNavigate, userId, partnershipId, isDarkMode }: LoveNotesScreenProps) {
    const [notes, setNotes] = useState<Note[]>([]);
    const [newNote, setNewNote] = useState('');
    const [selectedFont, setSelectedFont] = useState('lateef-regular');
    const [isWriting, setIsWriting] = useState(false);
    const [loading, setLoading] = useState(false);

    const fonts = [
        { name: 'Lateef Light', value: 'lateef-light' },
        { name: 'Lateef Regular', value: 'lateef-regular' },
        { name: 'Lateef Bold', value: 'lateef-bold' },
        { name: 'Aref Ruqaa', value: 'aref-regular' },
        { name: 'Aref Ruqaa Bold', value: 'aref-bold' },
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
        let newLikes;

        if (isLiked) {
            newLikes = likes.filter(id => id !== userId);
        } else {
            newLikes = [...likes, userId];
        }

        // Optimistic update
        setNotes(notes.map(n => n.id === noteId ? { ...n, likes: newLikes } : n));

        const { error } = await supabase
            .from('love_notes')
            .update({ likes: newLikes })
            .eq('id', noteId);

        if (error) {
            console.error('Error updating likes:', error);
            // Revert if error
            fetchNotes();
        }
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

    const NoteCard = ({ note }: { note: Note }) => {
        const isLiked = note.likes?.includes(userId);

        return (
            <div className="bg-white rounded-lg shadow-sm border border-black/5 overflow-hidden mb-6 max-w-md mx-auto w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-black/5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-muted overflow-hidden">
                            {note.author?.avatar_url ? (
                                <img src={note.author.avatar_url} alt={note.author.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center text-primary font-bold">
                                    {note.author?.name?.[0] || '?'}
                                </div>
                            )}
                        </div>
                        <div>
                            <span className="fill-current text-sm font-bold text-foreground block">{note.author?.name || 'مجهول'}</span>
                            <span className="text-xs text-muted-foreground block">ulfah notes</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary/40 tracking-widest uppercase">tumblr</span>
                    </div>
                </div>

                {/* Content */}
                <div className={`p-6 text-right ${note.font_style} text-2xl leading-relaxed text-foreground whitespace-pre-wrap`}>
                    {note.content}
                </div>

                {/* Footer / Actions */}
                <div className="px-4 py-3 bg-muted/30 flex items-center justify-between border-t border-border">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => handleLike(note.id, note.likes)}
                            className={`flex items-center gap-1.5 transition-colors ${isLiked ? 'text-rose-500' : 'text-gray-400 hover:text-rose-400'}`}
                        >
                            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                            {note.likes && note.likes.length > 0 && <span className="text-xs font-bold">{note.likes.length}</span>}
                        </button>

                        <button className="text-gray-400 hover:text-indigo-500 transition-colors">
                            <Repeat className="w-5 h-5" />
                        </button>

                        <button className="text-gray-400 hover:text-indigo-500 transition-colors">
                            <MessageCircle className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="text-xs text-black/30 font-bold">
                        {new Date(note.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 bg-background flex flex-col relative h-screen">
            <header className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-30">
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => onNavigate('home')} className="w-10 h-10 flex items-center justify-center bg-muted rounded-full shadow-sm text-foreground">
                    <ArrowLeft className="w-5 h-5" />
                </motion.button>
                <span className="text-lg font-bold text-foreground">خواطر</span>
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsWriting(!isWriting)}
                    className={`w-10 h-10 flex items-center justify-center rounded-full shadow-sm transition-colors ${isWriting ? 'bg-primary text-white' : 'bg-muted text-foreground'}`}
                >
                    {isWriting ? <ArrowLeft className="w-5 h-5 rotate-90" /> : <Type className="w-5 h-5" />}
                </motion.button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 pb-32 pt-2">
                <AnimatePresence mode="wait">
                    {isWriting ? (
                        <motion.div
                            key="composer"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-card rounded-3xl p-6 shadow-sm border border-border"
                        >
                            <textarea
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                placeholder="اكتب ما في قلبك..."
                                className={`w-full min-h-[200px] bg-transparent border-none outline-none text-2xl text-foreground placeholder:text-muted-foreground resize-none mb-6 ${selectedFont}`}
                            />

                            <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide mb-4">
                                {fonts.map(font => (
                                    <button
                                        key={font.value}
                                        onClick={() => setSelectedFont(font.value)}
                                        className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all ${selectedFont === font.value ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}
                                    >
                                        {font.name}
                                    </button>
                                ))}
                            </div>

                            <Button
                                onClick={handleSaveNote}
                                disabled={loading || !newNote.trim()}
                                className="w-full h-12 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200"
                            >
                                {loading ? 'جاري النشر...' : 'نشر الخاطرة'}
                            </Button>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="feed"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-4"
                        >
                            {notes.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-center opacity-40">
                                    <Type className="w-12 h-12 mb-4" />
                                    <p className="font-bold">لا توجد خواطر بعد</p>
                                    <p className="text-sm">ابدأ بكتابة أول رسالة حب</p>
                                </div>
                            ) : (
                                notes.map(note => <NoteCard key={note.id} note={note} />)
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
