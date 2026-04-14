import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Gift, 
    Plus, 
    X, 
    ExternalLink, 
    Trash2, 
    Heart, 
    ChevronRight,
    Search,
    Image as ImageIcon,
    Link as LinkIcon,
    Sparkles,
    User
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface WishlistItem {
    id: string;
    user_id: string;
    title: string;
    description: string;
    image_url: string;
    link_url: string;
    is_received: boolean;
    created_at: string;
}

interface WishlistScreenProps {
    onBack: () => void;
    userId: string;
    partnershipId: string | null;
}

export function WishlistScreen({ onBack, userId, partnershipId }: WishlistScreenProps) {
    const [items, setItems] = useState<WishlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [filter, setFilter] = useState<'all' | 'me' | 'partner'>('all');
    const [partnerId, setPartnerId] = useState<string | null>(null);

    // Form state
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newLink, setNewLink] = useState('');
    const [newImage, setNewImage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (partnershipId) {
            loadItems();
            loadPartnerInfo();
        }
    }, [partnershipId]);

    const loadPartnerInfo = async () => {
        if (!partnershipId) return;
        const { data } = await supabase.from('partnerships').select('user1_id, user2_id').eq('id', partnershipId).single();
        if (data) {
            setPartnerId(data.user1_id === userId ? data.user2_id : data.user1_id);
        }
    };

    const loadItems = async () => {
        if (!partnershipId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('gift_wishlist')
                .select('*')
                .eq('partnership_id', partnershipId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setItems(data || []);
        } catch (error) {
            console.error('Error loading wishlist:', error);
            toast.error('فشل تحميل قائمة الأمنيات');
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim() || !partnershipId) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('gift_wishlist').insert({
                partnership_id: partnershipId,
                user_id: userId,
                title: newTitle,
                description: newDesc,
                link_url: newLink,
                image_url: newImage
            });

            if (error) throw error;

            toast.success('تمت إضافة الأمنية بنجاح ✨');
            setShowAddModal(false);
            setNewTitle('');
            setNewDesc('');
            setNewLink('');
            setNewImage('');
            loadItems();
        } catch (error) {
            console.error('Error adding item:', error);
            toast.error('فشل في الإضافة');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteItem = async (id: string) => {
        try {
            const { error } = await supabase.from('gift_wishlist').delete().eq('id', id);
            if (error) throw error;
            setItems(items.filter(i => i.id !== id));
            toast.success('تم الحذف');
        } catch (error) {
            toast.error('فشل الحذف');
        }
    };

    const filteredItems = items.filter(item => {
        if (filter === 'me') return item.user_id === userId;
        if (filter === 'partner') return item.user_id !== userId;
        return true;
    });

    return (
        <div className="flex-1 bg-background h-full overflow-hidden flex flex-col relative">
            {/* Background Decorations */}
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[40%] bg-rose-500/5 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-5%] left-[-5%] w-[40%] h-[40%] bg-amber-500/5 blur-[100px] rounded-full" />
            </div>

            {/* Header */}
            <header className="px-8 pt-10 pb-6 sticky top-0 bg-background/40 backdrop-blur-xl z-40 border-b border-white/10">
                <div className="flex items-center justify-between">
                    <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={onBack}
                        className="w-10 h-10 glass rounded-xl flex items-center justify-center text-foreground/60"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </motion.button>
                    
                    <div className="text-center flex flex-col items-center">
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            <h1 className="text-xl font-black text-foreground tracking-tight">قائمة الأمنيات</h1>
                            <Sparkles className="w-4 h-4 text-amber-500" />
                        </div>
                        <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">هدايا تتمناها القلوب</p>
                    </div>

                    <div className="w-10" />
                </div>

                {/* Filters */}
                <div className="flex gap-2 mt-6">
                    {[
                        { id: 'all', label: 'الكل' },
                        { id: 'me', label: 'أمنياتي' },
                        { id: 'partner', label: 'أمنيات الشريك' }
                    ].map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id as any)}
                            className={`flex-1 py-2.5 rounded-2xl text-[10px] font-black transition-all duration-300 border ${
                                filter === f.id 
                                ? 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/20' 
                                : 'bg-white/50 dark:bg-white/5 text-foreground/40 border-white/60 dark:border-white/10'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto px-6 py-8 scrollbar-hide pb-32">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-20">
                        <Gift className="w-12 h-12 animate-bounce" />
                    </div>
                ) : filteredItems.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6">
                        {filteredItems.map((item, idx) => (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                key={item.id}
                                className="glass rounded-[2.5rem] p-5 border-white/60 dark:border-white/10 shadow-xl bg-white/40 dark:bg-white/5 relative overflow-hidden group"
                            >
                                <div className="flex gap-4">
                                    {/* Image or Icon */}
                                    <div className="w-24 h-24 rounded-3xl bg-rose-500/5 border border-rose-500/10 overflow-hidden flex items-center justify-center shrink-0">
                                        {item.image_url ? (
                                            <img src={item.image_url} className="w-full h-full object-cover" />
                                        ) : (
                                            <Gift className="w-8 h-8 text-rose-500/30" />
                                        )}
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 flex flex-col justify-between py-1 text-right">
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-1.5 bg-white/60 dark:bg-white/5 px-2 py-0.5 rounded-full border border-white/40">
                                                    <span className="text-[7px] font-black text-foreground/40 uppercase tracking-widest">
                                                        {item.user_id === userId ? 'لي' : 'للشريك'}
                                                    </span>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${item.user_id === userId ? 'bg-rose-500' : 'bg-amber-500'}`} />
                                                </div>
                                                {item.user_id === userId && (
                                                    <button onClick={() => handleDeleteItem(item.id)} className="text-rose-500/30 hover:text-rose-500 transition-colors">
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                            <h3 className="text-base font-black text-foreground tracking-tight">{item.title}</h3>
                                            <p className="text-[10px] text-foreground/60 leading-relaxed line-clamp-2 mt-1">{item.description}</p>
                                        </div>

                                        <div className="flex items-center justify-between mt-3">
                                            {item.link_url && (
                                                <a 
                                                    href={item.link_url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1.5 text-rose-500 text-[9px] font-black uppercase tracking-tighter"
                                                >
                                                    <ExternalLink size={12} />
                                                    رابط المنتج
                                                </a>
                                            )}
                                            <div className="flex -space-x-1">
                                                <Heart className={`w-4 h-4 ${item.is_received ? 'fill-rose-500 text-rose-500' : 'text-rose-500/20'}`} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-30">
                        <div className="w-20 h-20 rounded-full bg-rose-500/5 flex items-center justify-center">
                            <Gift size={40} />
                        </div>
                        <p className="text-xs font-black uppercase tracking-[0.2em]">لا توجد أمنيات حتى الآن</p>
                    </div>
                )}
            </main>

            {/* Fab Add Button */}
            <motion.button
                whileHover={{ scale: 1.05, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAddModal(true)}
                className="fixed bottom-10 left-10 w-16 h-16 bg-gradient-to-br from-rose-500 to-rose-400 text-white rounded-[2rem] shadow-2xl shadow-rose-500/30 flex items-center justify-center z-50 border-[3px] border-white/20"
            >
                <Plus className="w-8 h-8" />
            </motion.button>

            {/* Add Item Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAddModal(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            className="relative w-full max-w-md bg-background rounded-[2.5rem] p-8 shadow-2xl overflow-hidden text-right"
                        >
                            <button 
                                onClick={() => setShowAddModal(false)}
                                className="absolute top-6 left-6 w-10 h-10 glass rounded-xl flex items-center justify-center text-foreground/30 hover:text-foreground"
                            >
                                <X size={20} />
                            </button>

                            <div className="mb-8 mt-2 flex items-center justify-end gap-3">
                                <div>
                                    <h2 className="text-xl font-black text-foreground">أمنية جديدة</h2>
                                    <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">ما الذي يبهج قلبك؟</p>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                                    <Gift size={24} />
                                </div>
                            </div>

                            <form onSubmit={handleAddItem} className="space-y-6">
                                <div className="space-y-4">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={newTitle}
                                            onChange={(e) => setNewTitle(e.target.value)}
                                            placeholder="اسم الهدية / الأمنية"
                                            className="w-full bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10 rounded-2xl p-4 text-sm text-right focus:ring-2 focus:ring-rose-500 outline-none transition-all pr-12 font-bold"
                                            required
                                        />
                                        <Sparkles className="absolute top-4 right-4 text-rose-500/40 w-5 h-5" />
                                    </div>

                                    <div className="relative">
                                        <textarea
                                            value={newDesc}
                                            onChange={(e) => setNewDesc(e.target.value)}
                                            placeholder="وصف بسيط (اختياري)"
                                            rows={2}
                                            className="w-full bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10 rounded-2xl p-4 text-sm text-right focus:ring-2 focus:ring-rose-500 outline-none transition-all font-medium"
                                        />
                                    </div>

                                    <div className="relative">
                                        <input
                                            type="url"
                                            value={newLink}
                                            onChange={(e) => setNewLink(e.target.value)}
                                            placeholder="رابط المنتج (Amazon, Noon, الخ)"
                                            className="w-full bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10 rounded-2xl p-4 text-sm text-right focus:ring-2 focus:ring-rose-500 outline-none transition-all pr-12 font-medium"
                                        />
                                        <LinkIcon className="absolute top-4 right-4 text-foreground/20 w-5 h-5" />
                                    </div>

                                    <div className="relative">
                                        <input
                                            type="url"
                                            value={newImage}
                                            onChange={(e) => setNewImage(e.target.value)}
                                            placeholder="رابط صورة الهدية"
                                            className="w-full bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10 rounded-2xl p-4 text-sm text-right focus:ring-2 focus:ring-rose-500 outline-none transition-all pr-12 font-medium"
                                        />
                                        <ImageIcon className="absolute top-4 right-4 text-foreground/20 w-5 h-5" />
                                    </div>
                                </div>

                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    type="submit"
                                    disabled={isSubmitting || !newTitle}
                                    className="w-full py-4 bg-gradient-to-r from-rose-500 to-rose-400 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-500/20 disabled:opacity-50"
                                >
                                    {isSubmitting ? 'جاري الإضافة...' : 'أضف لقائمة الأمنيات'}
                                </motion.button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
