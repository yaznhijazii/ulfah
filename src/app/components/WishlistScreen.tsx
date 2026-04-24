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
    Image as ImageIcon,
    Link as LinkIcon,
    ShoppingBag,
    Star,
    CheckCircle2
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
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newLink, setNewLink] = useState('');
    const [newImage, setNewImage] = useState('');

    useEffect(() => {
        if (partnershipId) {
            loadItems();
        }
    }, [partnershipId]);

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
                image_url: newImage,
                is_received: false
            });

            if (error) throw error;

            toast.success('تمت إضافة الأمنية بنجاح 🎁');
            setShowAddModal(false);
            resetForm();
            loadItems();
        } catch (error) {
            console.error('Error adding item:', error);
            toast.error('فشل في الإضافة');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setNewTitle('');
        setNewDesc('');
        setNewLink('');
        setNewImage('');
    };

    const toggleReceived = async (item: WishlistItem) => {
        const next = !item.is_received;
        try {
            const { error } = await supabase
                .from('gift_wishlist')
                .update({ is_received: next })
                .eq('id', item.id);
            if (error) throw error;
            setItems(items.map(i => i.id === item.id ? { ...i, is_received: next } : i));
            toast.success(next ? 'تم تمييزها كمستلمة!' : 'تم التراجع');
        } catch (error) {
            toast.error('تعذّر التحديث');
        }
    };

    const handleDeleteItem = async (id: string) => {
        try {
            const { error } = await supabase.from('gift_wishlist').delete().eq('id', id);
            if (error) throw error;
            setItems(items.filter(i => i.id !== id));
            toast.success('تم الحذف بنجاح');
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
        <div dir="rtl" lang="ar" className="flex-1 bg-background h-full overflow-hidden flex flex-col relative font-inter">
            {/* Immersive Premium Background */}
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute top-[-10%] start-[-10%] w-[60%] h-[40%] bg-rose-500/[0.08] blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] end-[-10%] w-[50%] h-[50%] bg-rose-400/[0.06] blur-[100px] rounded-full" />
            </div>

            {/* Header */}
            <header className="px-8 pt-12 pb-6 sticky top-0 bg-background/60 backdrop-blur-2xl z-40 border-b border-white/5">
                <div className="flex items-center justify-between mb-8">
                    <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={onBack}
                        className="w-11 h-11 glass rounded-2xl flex items-center justify-center text-foreground/60 border border-white/20"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </motion.button>
                    
                    <div className="text-center">
                        <h1 className="text-xl font-black text-foreground tracking-tight">قائمة الأمنيات</h1>
                        <p className="text-[9px] font-black text-rose-500/50 uppercase tracking-[0.25em]">هدايا تتمناها القلوب</p>
                    </div>

                    <div className="w-11" />
                </div>

                {/* Modern Segmented Filters */}
                <div className="flex p-1.5 bg-black/[0.03] dark:bg-white/[0.03] rounded-3xl gap-1">
                    {[
                        { id: 'all', label: 'الكل' },
                        { id: 'me', label: 'أمنياتي' },
                        { id: 'partner', label: 'أمنيات الشريك' }
                    ].map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id as any)}
                            className={`flex-1 py-3 rounded-[1.25rem] text-[11px] font-black transition-all duration-500 relative overflow-hidden ${
                                filter === f.id 
                                ? 'text-white' 
                                : 'text-foreground/40 hover:text-foreground/60'
                            }`}
                        >
                            {filter === f.id && (
                                <motion.div
                                    layoutId="wishlist-filter"
                                    className="absolute inset-0 bg-gradient-to-r from-rose-600 to-rose-400 shadow-lg shadow-rose-500/25"
                                />
                            )}
                            <span className="relative z-10">{f.label}</span>
                        </button>
                    ))}
                </div>
            </header>

            {/* Content List */}
            <main className="flex-1 overflow-y-auto px-6 py-8 scrollbar-hide pb-40">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 opacity-20">
                        <ShoppingBag className="w-16 h-16 animate-bounce text-rose-500" />
                    </div>
                ) : filteredItems.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6">
                        {filteredItems.map((item, idx) => (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ delay: idx * 0.05, type: "spring", stiffness: 100 }}
                                key={item.id}
                                className={`glass rounded-[2.5rem] p-6 border transition-all duration-300 ${
                                    item.is_received 
                                    ? 'bg-white/20 dark:bg-white/[0.01] border-white/30 dark:border-white/5 opacity-60' 
                                    : 'bg-white/60 dark:bg-white/[0.05] border-white/70 dark:border-white/10 shadow-xl shadow-black/[0.02]'
                                } group relative`}
                            >
                                <div className="flex gap-5">
                                    {/* Premium Image Container */}
                                    <div className="w-28 h-28 rounded-[2rem] bg-gradient-to-br from-rose-500/5 to-transparent border border-rose-500/10 overflow-hidden flex items-center justify-center shrink-0 relative group-hover:scale-105 transition-transform duration-500">
                                        {item.image_url ? (
                                            <img src={item.image_url} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <Gift className="w-10 h-10 text-rose-500/20" />
                                        )}
                                        {item.is_received && (
                                            <div className="absolute inset-0 bg-rose-600/20 backdrop-blur-[2px] flex items-center justify-center">
                                                <CheckCircle2 className="text-white w-8 h-8 drop-shadow-lg" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Item Details */}
                                    <div className="flex-1 flex flex-col justify-between py-1">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                                                    item.user_id === userId 
                                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' 
                                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                                }`}>
                                                    <div className={`w-1 h-1 rounded-full ${item.user_id === userId ? 'bg-rose-500' : 'bg-amber-500'}`} />
                                                    {item.user_id === userId ? 'أمنيتي' : 'أمنية الشريك'}
                                                </div>
                                                
                                                <div className="flex gap-2">
                                                    <button onClick={() => toggleReceived(item)} className={`transition-all ${item.is_received ? 'text-rose-500 scale-110' : 'text-foreground/10 hover:text-rose-500/40'}`}>
                                                        <Heart size={18} fill={item.is_received ? "currentColor" : "none"} />
                                                    </button>
                                                    {item.user_id === userId && (
                                                        <button onClick={() => handleDeleteItem(item.id)} className="text-foreground/10 hover:text-rose-500 transition-colors">
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <h3 className={`text-lg font-black text-foreground tracking-tight leading-tight ${item.is_received ? 'line-through decoration-rose-500/30' : ''}`}>
                                                {item.title}
                                            </h3>
                                            <p className="text-[11px] text-foreground/50 leading-relaxed line-clamp-2 mt-2 italic font-medium">
                                                {item.description || "لا يوجد وصف لهذه الأمنية..."}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between mt-4">
                                            {item.link_url ? (
                                                <a 
                                                    href={item.link_url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-tighter bg-rose-500/10 px-3 py-2 rounded-xl border border-rose-500/10 hover:bg-rose-500 hover:text-white transition-all"
                                                >
                                                    <ExternalLink size={12} />
                                                    رابط المنتج
                                                </a>
                                            ) : <div />}
                                            
                                            <span className="text-[8px] font-black text-foreground/20 uppercase tracking-widest">
                                                {new Date(item.created_at).toLocaleDateString('ar-EG')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 text-center space-y-8 opacity-20">
                        <div className="relative">
                            <div className="absolute inset-0 bg-rose-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
                            <div className="w-24 h-24 rounded-[2.5rem] bg-gradient-to-br from-white/80 to-white/20 dark:from-white/10 dark:to-transparent flex items-center justify-center shadow-lg border border-white/20 relative z-10">
                                <Gift size={48} className="text-rose-500/40" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-black uppercase tracking-[0.3em] text-foreground/40">القائمة بانتظار أحلامكم</p>
                            <p className="text-xs font-medium text-foreground/30">ما الذي يبهج قلبك اليوم؟</p>
                        </div>
                    </div>
                )}
            </main>

            {/* Fab Button */}
            <motion.button
                whileHover={{ scale: 1.05, rotate: 10 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowAddModal(true)}
                className="fixed bottom-12 start-10 w-18 h-18 bg-gradient-to-br from-rose-600 via-rose-500 to-rose-400 text-white rounded-[2.2rem] shadow-2xl shadow-rose-500/40 flex items-center justify-center z-50 border-[4px] border-white/30 backdrop-blur-md"
            >
                <Plus className="w-9 h-9" />
            </motion.button>

            {/* Add Item Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-[100] flex items-end justify-center">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAddModal(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ y: "100%", scale: 0.95 }}
                            animate={{ y: 0, scale: 1 }}
                            exit={{ y: "100%", scale: 0.95 }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="relative w-full max-w-lg bg-white dark:bg-[#0D0D0D] rounded-t-[3.5rem] p-10 pb-12 shadow-2xl overflow-hidden text-right border-t border-white/10"
                        >
                            {/* Decorative Elements */}
                            <div className="absolute top-0 right-0 w-full h-32 bg-gradient-to-b from-rose-500/10 to-transparent pointer-events-none" />
                            
                            <button 
                                onClick={() => setShowAddModal(false)}
                                className="absolute top-8 left-8 w-11 h-11 glass rounded-2xl flex items-center justify-center text-foreground/40 hover:text-foreground hover:bg-white/20 transition-all z-50 border border-white/10"
                            >
                                <X size={22} />
                            </button>

                            <div className="mb-10 flex items-center justify-end gap-5">
                                <div>
                                    <h2 className="text-2xl font-black text-foreground tracking-tight">أمنية جديدة</h2>
                                    <p className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mt-1">ما الذي يبهج قلبك؟</p>
                                </div>
                                <div className="w-16 h-16 rounded-[1.75rem] bg-gradient-to-br from-rose-500/20 to-rose-500/5 flex items-center justify-center text-rose-500 shadow-inner">
                                    <Star size={32} />
                                </div>
                            </div>

                            <form onSubmit={handleAddItem} className="space-y-6">
                                <div className="space-y-5">
                                    <div className="group relative">
                                        <input
                                            type="text"
                                            autoFocus
                                            value={newTitle}
                                            onChange={(e) => setNewTitle(e.target.value)}
                                            placeholder="اسم الغرض / الهدية"
                                            className="w-full bg-black/[0.03] dark:bg-white/[0.03] border-2 border-transparent focus:border-rose-500/30 rounded-[1.75rem] p-5 text-lg text-right outline-none transition-all font-black placeholder:text-muted-foreground/30 shadow-inner"
                                            required
                                        />
                                    </div>

                                    <div className="group relative">
                                        <textarea
                                            value={newDesc}
                                            onChange={(e) => setNewDesc(e.target.value)}
                                            placeholder="وصف بسيط (اختياري)"
                                            rows={2}
                                            className="w-full bg-black/[0.03] dark:bg-white/[0.03] border-2 border-transparent focus:border-rose-500/30 rounded-[1.75rem] p-5 text-sm text-right outline-none transition-all font-medium placeholder:text-muted-foreground/30 resize-none shadow-inner"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="relative group">
                                            <input
                                                type="url"
                                                value={newLink}
                                                onChange={(e) => setNewLink(e.target.value)}
                                                placeholder="رابط المنتج (Amazon, Noon, ...)"
                                                className="w-full bg-black/[0.03] dark:bg-white/[0.03] border-2 border-transparent focus:border-rose-500/30 rounded-[1.75rem] p-5 text-[12px] text-right outline-none transition-all pr-14 font-bold shadow-inner"
                                            />
                                            <div className="absolute top-1/2 -translate-y-1/2 right-5 text-muted-foreground/30 group-focus-within:text-rose-500/40 transition-colors">
                                                <LinkIcon size={20} />
                                            </div>
                                        </div>

                                        <div className="relative group">
                                            <input
                                                type="url"
                                                value={newImage}
                                                onChange={(e) => setNewImage(e.target.value)}
                                                placeholder="رابط صورة الهدية"
                                                className="w-full bg-black/[0.03] dark:bg-white/[0.03] border-2 border-transparent focus:border-rose-500/30 rounded-[1.75rem] p-5 text-[12px] text-right outline-none transition-all pr-14 font-bold shadow-inner"
                                            />
                                            <div className="absolute top-1/2 -translate-y-1/2 right-5 text-muted-foreground/30 group-focus-within:text-rose-500/40 transition-colors">
                                                <ImageIcon size={20} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02, boxShadow: "0 20px 30px -10px rgba(244, 63, 94, 0.4)" }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit"
                                    disabled={isSubmitting || !newTitle.trim()}
                                    className="w-full py-5 bg-gradient-to-r from-rose-600 to-rose-400 text-white rounded-3xl font-black text-sm uppercase tracking-[0.25em] shadow-xl shadow-rose-500/20 disabled:opacity-50 transition-all border-t border-white/20"
                                >
                                    {isSubmitting ? 'جاري الحفظ...' : 'أضف لقائمة الأمنيات'}
                                </motion.button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
