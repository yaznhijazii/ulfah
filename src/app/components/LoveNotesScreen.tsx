import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Heart, Feather, PenLine, Ghost, X, Trash2 } from 'lucide-react';
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

const flowers = [
    { id: 'flower-1', url: '/assets/love_notes/flower-1.png' },
    { id: 'flower-2', url: '/assets/love_notes/flower-2.png' },
    { id: 'flower-3', url: '/assets/love_notes/flower-3.png' },
    { id: 'flower-4', url: '/assets/love_notes/flower-4.png' },
    { id: 'flower-5', url: '/assets/love_notes/flower-5.png' },
    { id: 'flower-6', url: '/assets/love_notes/flower-6.png' },
    { id: 'flower-7', url: '/assets/love_notes/flower-7.png' },
];

const NoteCard = ({ 
    note, 
    userId, 
    partnerName, 
    handleLike, 
    handleDelete 
}: { 
    note: Note; 
    userId: string; 
    partnerName: string; 
    handleLike: (id: string, current: string[]) => void; 
    handleDelete: (id: string) => void; 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [rawFont, flowersPart] = note.font_style?.includes('|') 
        ? note.font_style.split('|') 
        : [note.font_style || 'font-ruqaa', ''];
        
    const fontClass = (rawFont === 'font-cedarville') ? 'font-cedarville' : 'font-ruqaa';
    const activeFlowers = flowersPart?.split(',').filter(Boolean) || [];
    const isAuthor = note.author_id === userId;

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setIsOpen(!isOpen)}
            className="relative mb-32 cursor-pointer"
        >
            <div className="relative aspect-[272/409] w-full max-w-[340px] mx-auto group">
                <img src="/assets/love_notes/card-base.png" className="absolute inset-x-0 bottom-0 w-full h-[85%] object-cover pointer-events-none z-0" />

                <div className="absolute top-0 inset-x-0 h-[60%] z-0 pointer-events-none overflow-hidden">
                    <motion.div 
                        animate={{ y: isOpen ? -40 : 0, scale: isOpen ? 1.05 : 1 }}
                        className="absolute inset-0"
                    >
                        {activeFlowers.map((fid, idx) => {
                            const flower = flowers.find(f => f.id === fid);
                            if (!flower) return null;
                            const slots = [
                                { x: '-5%', y: '30%', rotate: 0, scale: 1.25, z: 7 },
                                { x: '-18%', y: '32%', rotate: -12, scale: 1.1, z: 6 },
                                { x: '10%', y: '35%', rotate: 10, scale: 1.15, z: 5 },
                                { x: '25%', y: '42%', rotate: 22, scale: 1.0, z: 4 },
                                { x: '-28%', y: '40%', rotate: -22, scale: 1.0, z: 3 },
                                { x: '5%', y: '45%', rotate: 5, scale: 0.95, z: 2 },
                                { x: '-8%', y: '48%', rotate: -8, scale: 0.95, z: 1 }
                            ];
                            const slot = slots[idx % slots.length];
                            return (
                                <div 
                                    key={`${note.id}-f-${idx}`}
                                    className="w-[32%] absolute"
                                    style={{ 
                                        left: '50%',
                                        top: slot.y,
                                        marginLeft: slot.x,
                                        transform: `scale(${slot.scale}) rotate(${slot.rotate}deg)`,
                                        transformOrigin: 'bottom center',
                                        zIndex: slot.z
                                    }}
                                >
                                    {flower && <img src={flower.url} className="w-full drop-shadow-md object-contain" />}
                                </div>
                            );
                        })}
                    </motion.div>
                </div>

                <motion.div 
                    initial={false}
                    animate={{ 
                        y: isOpen ? '-25%' : '0%',
                        scale: isOpen ? 1.05 : 1,
                        zIndex: isOpen ? 50 : 10
                    }}
                    transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                    className="absolute left-[12.5%] top-[34.2%] w-[75%] aspect-square shadow-xl overflow-hidden"
                >
                    <img src="/assets/love_notes/card-paper.png" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                        <div className="w-full max-h-full overflow-y-auto paper-content-scroll flex flex-col items-center">
                            <p className={`text-[1.4rem] md:text-[1.5rem] font-bold text-black/85 leading-tight whitespace-pre-wrap ${fontClass}`}>
                                {note.content}
                            </p>
                            <span className={`text-[0.65rem] text-black/40 italic mt-6 self-end shrink-0 ${fontClass}`}>
                                — {isAuthor ? partnerName : 'أنا'}
                            </span>
                        </div>
                    </div>
                </motion.div>

                <img src="/assets/love_notes/card-mask.png" className="absolute inset-x-0 bottom-0 w-full h-[85%] object-cover pointer-events-none z-30 opacity-80" />

                <div className="absolute left-[17%] bottom-[16%] z-40 px-2">
                    <p className={`text-[0.7rem] text-black/40 font-black ${fontClass} opacity-80`}>
                        {fontClass === 'font-ruqaa' ? 'إلى: ' : 'To: '} {isAuthor ? partnerName : 'أنا'}
                    </p>
                </div>

                <div className="absolute -bottom-8 right-12 z-50 flex gap-4">
                     {isAuthor && (
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }} className="w-12 h-12 rounded-full bg-white shadow-2xl flex items-center justify-center text-rose-500/30 hover:text-rose-600 transition-all border border-rose-50">
                            <Trash2 size={24} />
                        </button>
                     )}
                     <button onClick={(e) => { e.stopPropagation(); handleLike(note.id, note.likes || []); }} className={`w-12 h-12 rounded-full bg-white shadow-2xl flex items-center justify-center transition-all border border-rose-50 ${note.likes?.includes(userId) ? 'text-rose-500' : 'text-zinc-300'}`}>
                        <Heart size={24} fill={note.likes?.includes(userId) ? 'currentColor' : 'none'} />
                     </button>
                </div>
            </div>
        </motion.div>
    );
};

export function LoveNotesScreen({ onNavigate, userId, partnershipId, isDarkMode }: LoveNotesScreenProps) {
    const [notes, setNotes] = useState<Note[]>([]);
    const [newNote, setNewNote] = useState('');
    const [selectedFlowers, setSelectedFlowers] = useState<string[]>([]);
    const [selectedFont, setSelectedFont] = useState('font-ruqaa');
    const [loading, setLoading] = useState(false);
    const [isWriting, setIsWriting] = useState(false);
    const [partnerName, setPartnerName] = useState('Habibi');

    const handwritingFonts = [
        { name: 'رقعة (عربي)', value: 'font-ruqaa', fontSize: 'text-2xl' },
        { name: 'Handwriting', value: 'font-cedarville', fontSize: 'text-xl' },
    ];

    useEffect(() => {
        if (partnershipId) {
            fetchNotes();
            fetchPartnerInfo();
        }
    }, [partnershipId]);

    const fetchPartnerInfo = async () => {
        if (!partnershipId) return;
        const { data } = await supabase.from('partnerships').select('user1:user1_id(name), user2:user2_id(name), user1_id').eq('id', partnershipId).single();
        if (data) {
            const name = data.user1_id === userId ? (data as any).user2?.name : (data as any).user1?.name;
            setPartnerName(name || 'Habibi');
        }
    };

    const fetchNotes = async () => {
        if (!partnershipId) return;
        const { data, error } = await supabase
            .from('love_notes')
            .select('*, author:users!author_id(name, avatar_url)')
            .eq('partnership_id', partnershipId)
            .order('created_at', { ascending: false });

        if (error) console.error('Error fetching notes:', error);
        else setNotes(data || []);
    };

    const handleSaveNote = async () => {
        if (!newNote.trim() || !partnershipId) return;
        setLoading(true);

        const flowerString = selectedFlowers.join(',');
        const fontStyle = `${selectedFont}|${flowerString}`;

        try {
            const { error } = await supabase
                .from('love_notes')
                .insert({
                    content: newNote.trim(),
                    font_style: fontStyle,
                    partnership_id: partnershipId,
                    author_id: userId
                });

            if (error) throw error;
            setNewNote('');
            setSelectedFlowers([]);
            setIsWriting(false);
            fetchNotes();
        } catch (error) {
            console.error('Error saving note:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async (noteId: string, currentLikes: string[] | null) => {
        const likes = currentLikes || [];
        const isLiked = likes.includes(userId);
        let newLikes = isLiked ? likes.filter(id => id !== userId) : [...likes, userId];

        setNotes(prev => prev.map(n => n.id === noteId ? { ...n, likes: newLikes } : n));
        try {
            await supabase.from('love_notes').update({ likes: newLikes }).eq('id', noteId);
        } catch (err) {
            console.error('Like error:', err);
        }
    };

    const handleDelete = async (noteId: string) => {
        if (!confirm('هل أنت متأكد من مسح هذه الخاطرة؟')) return;
        try {
            await supabase.from('love_notes').delete().eq('id', noteId);
            setNotes(prev => prev.filter(n => n.id !== noteId));
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const toggleFlower = (id: string) => {
        setSelectedFlowers(prev => 
            prev.includes(id) 
                ? prev.filter(f => f !== id) 
                : (prev.length < 7 ? [...prev, id] : prev)
        );
    };

    return (
        <div className={`flex flex-col h-full ${isDarkMode ? 'dark bg-zinc-950' : 'bg-rose-50/20'}`}>
            <header className="px-8 pt-12 pb-6 flex items-center justify-between sticky top-0 z-50 glass border-b border-white/40">
                <div className="flex items-center gap-4">
                    <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onNavigate('home')}
                        className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800"
                    >
                        <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                    </motion.button>
                    <div>
                        <h1 className="text-xl font-black text-rose-500">أفق الكلمات</h1>
                        <p className="text-[10px] font-bold text-black/20 dark:text-white/20 uppercase tracking-widest">همسات من الروح</p>
                    </div>
                </div>
                
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsWriting(!isWriting)}
                    className={`w-12 h-12 flex items-center justify-center rounded-3xl transition-all duration-500 shadow-2xl ${isWriting ? 'bg-rose-500 text-white border-rose-500 shadow-rose-500/20' : 'bg-white/40 border border-white/60 text-rose-500'}`}
                >
                    {isWriting ? <X className="w-5 h-5" /> : <PenLine className="w-5 h-5" />}
                </motion.button>
            </header>

            <div className="flex-1 overflow-y-auto px-8 pb-32 pt-10 scrollbar-hide">
                <AnimatePresence mode="wait">
                    {isWriting ? (
                        <motion.div
                            key="composer"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="space-y-12"
                        >
                            <div className="relative aspect-[272/409] w-full max-w-[300px] mx-auto">
                                <img src="/assets/love_notes/card-base.png" className="absolute inset-x-0 bottom-0 w-full h-[85%] object-cover z-0" />
                                <div className="absolute top-0 inset-x-0 h-[60%] z-0 pointer-events-none">
                                    {selectedFlowers.map((fid, idx) => {
                                        const flower = flowers.find(f => f.id === fid);
                                        const slots = [
                                            { x: '-2%', y: '35%', rotate: 0, scale: 1.2 },
                                            { x: '-15%', y: '40%', rotate: -15, scale: 1.0 },
                                            { x: '12%', y: '40%', rotate: 15, scale: 1.05 },
                                            { x: '22%', y: '45%', rotate: 25, scale: 0.95 },
                                            { x: '-25%', y: '45%', rotate: -25, scale: 0.95 }
                                        ];
                                        const slot = slots[idx % slots.length];
                                        return (
                                            <div 
                                                key={`sel-f-${idx}`}
                                                className="w-[32%] absolute"
                                                style={{ left: '50%', top: slot.y, marginLeft: slot.x, transform: `scale(${slot.scale}) rotate(${slot.rotate}deg)`, transformOrigin: 'bottom center' }}
                                            >
                                                <img src={flower?.url} className="w-full drop-shadow-md" />
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="absolute left-[12.5%] top-[34.2%] w-[75%] aspect-square z-10 shadow-lg overflow-hidden">
                                    <img src="/assets/love_notes/card-paper.png" className="w-full h-full object-cover" />
                                </div>
                                <div className="absolute left-[18.2%] top-[38%] w-[63.5%] h-[40%] z-20 flex flex-col items-center justify-center p-3 text-center overflow-hidden">
                                    <div className="w-full max-h-full overflow-y-auto paper-content-scroll flex flex-col items-center">
                                        <p className={`text-[1.2rem] text-black/85 leading-tight whitespace-pre-wrap ${selectedFont}`}>
                                            {newNote || 'اكتب همستك...'}
                                        </p>
                                    </div>
                                </div>
                                <img src="/assets/love_notes/card-mask.png" className="absolute inset-x-0 bottom-0 w-full h-[85%] object-cover z-30 opacity-80" />
                                <div className="absolute left-[17%] bottom-[16%] z-40 px-2">
                                    <p className={`text-[0.65rem] text-black/40 font-black ${selectedFont} opacity-80`}>
                                        {selectedFont === 'font-ruqaa' ? 'إلى: ' : 'To: '} {partnerName}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-10 glass rounded-[3.5rem] p-8 border-white/60 bg-white/20">
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-right pr-2">اكتب همستك</h4>
                                    <textarea
                                        value={newNote}
                                        onChange={(e) => setNewNote(e.target.value)}
                                        placeholder="ماذا تود أن تقول لروحك..."
                                        className="w-full h-32 glass border-white/60 rounded-[2rem] p-6 text-right text-xl outline-none focus:ring-4 ring-rose-500/5 transition-all font-ruqaa"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {handwritingFonts.map(font => (
                                        <button
                                            key={font.value}
                                            onClick={() => setSelectedFont(font.value)}
                                            className={`py-5 rounded-2xl glass border-2 transition-all flex flex-col items-center gap-1 ${selectedFont === font.value ? 'border-rose-500 text-rose-500 bg-rose-500/5 shadow-inner' : 'border-white/40 text-black/30'}`}
                                        >
                                            <span className={`${font.value} text-3xl font-bold`}>Abc</span>
                                            <span className="text-[9px] font-black uppercase tracking-tighter opacity-40">{font.name}</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-2">
                                        <span className="text-[10px] font-black text-rose-500/30 uppercase">{selectedFlowers.length} / 7</span>
                                        <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-right">أضف زهرة</h4>
                                    </div>
                                    <div className="grid grid-cols-4 gap-3">
                                        {flowers.map(flower => (
                                            <button
                                                key={flower.id}
                                                onClick={() => toggleFlower(flower.id)}
                                                className={`aspect-square rounded-2xl glass border-2 flex items-center justify-center transition-all ${selectedFlowers.includes(flower.id) ? 'border-rose-500 bg-rose-500/10 scale-110 shadow-xl' : 'border-white/40 opacity-50 hover:opacity-100'}`}
                                            >
                                                <img src={flower.url} className="w-10 h-10 object-contain" />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveNote}
                                    disabled={loading || !newNote.trim()}
                                    className="w-full h-20 bg-rose-500 text-white rounded-[2.5rem] font-black text-xl shadow-2xl shadow-rose-500/30 disabled:opacity-20 active:scale-95 transition-all"
                                >
                                    {loading ? 'جاري تخليد الكلمات...' : 'إرسال الهمسة'}
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="flex flex-col gap-20">
                            {notes.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-32 text-center opacity-30">
                                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-rose-500 flex items-center justify-center mb-6">
                                        <Ghost size={32} />
                                    </div>
                                    <p className="text-xl font-black text-rose-400">لا توجد همسات بعد...</p>
                                </div>
                            ) : (
                                notes.map(note => (
                                    <NoteCard 
                                        key={note.id} 
                                        note={note} 
                                        userId={userId}
                                        partnerName={partnerName}
                                        handleLike={handleLike}
                                        handleDelete={handleDelete}
                                    />
                                ))
                            )}
                        </div>
                    )}
                </AnimatePresence>
            </div>

            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute top-[-10%] right-[-15%] w-[100%] h-[70%] bg-rose-500/[0.05] blur-[150px] rounded-full" />
                <div className="absolute bottom-[-15%] left-[-10%] w-[90%] h-[60%] bg-orange-400/[0.03] blur-[120px] rounded-full" />
            </div>
        </div>
    );
}
