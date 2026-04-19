import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Armchair, Plus, X, Trash2, ChevronRight, Sparkles, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Checkbox } from './ui/checkbox';

interface HomeBoxItem {
    id: string;
    user_id: string;
    title: string;
    notes: string | null;
    is_purchased: boolean;
    created_at: string;
}

interface HomeBoxScreenProps {
    onBack: () => void;
    userId: string;
    partnershipId: string | null;
}

export function HomeBoxScreen({ onBack, userId, partnershipId }: HomeBoxScreenProps) {
    const [items, setItems] = useState<HomeBoxItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all');

    useEffect(() => {
        if (partnershipId) loadItems();
        else setLoading(false);
    }, [partnershipId]);

    const loadItems = async () => {
        if (!partnershipId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('home_box_items')
                .select('*')
                .eq('partnership_id', partnershipId)
                .order('is_purchased', { ascending: true })
                .order('created_at', { ascending: false });

            if (error) throw error;
            setItems(data || []);
        } catch (e) {
            console.error(e);
            toast.error('تعذّر تحميل صندوق البيت');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim() || !partnershipId) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('home_box_items').insert({
                partnership_id: partnershipId,
                user_id: userId,
                title: newTitle.trim(),
                notes: newNotes.trim() || null,
            });
            if (error) throw error;
            toast.success('تمت الإضافة');
            setShowAddModal(false);
            setNewTitle('');
            setNewNotes('');
            loadItems();
        } catch (e) {
            console.error(e);
            toast.error('فشلت الإضافة');
        } finally {
            setIsSubmitting(false);
        }
    };

    const togglePurchased = async (item: HomeBoxItem) => {
        const next = !item.is_purchased;
        try {
            const { error } = await supabase
                .from('home_box_items')
                .update({ is_purchased: next, updated_at: new Date().toISOString() })
                .eq('id', item.id);
            if (error) throw error;
            setItems((prev) =>
                prev.map((i) => (i.id === item.id ? { ...i, is_purchased: next } : i))
            );
        } catch (e) {
            toast.error('تعذّر التحديث');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase.from('home_box_items').delete().eq('id', id);
            if (error) throw error;
            setItems((prev) => prev.filter((i) => i.id !== id));
            toast.success('تم الحذف');
        } catch (e) {
            toast.error('فشل الحذف');
        }
    };

    const filtered = useMemo(() => {
        return items.filter((i) => {
            if (filter === 'open') return !i.is_purchased;
            if (filter === 'done') return i.is_purchased;
            return true;
        });
    }, [items, filter]);

    const stats = useMemo(() => {
        const total = items.length;
        const done = items.filter((i) => i.is_purchased).length;
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);
        return { total, done, pct };
    }, [items]);

    if (!partnershipId) {
        return (
            <div dir="rtl" lang="ar" className="flex-1 flex flex-col min-h-full bg-background px-6 pt-10 pb-24 relative overflow-hidden">
                {/* Background decorative elements */}
                <div className="absolute top-[-20%] right-[-20%] w-[80%] h-[60%] bg-teal-500/5 blur-[120px] rounded-full rotate-12" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[40%] bg-amber-500/5 blur-[100px] rounded-full -rotate-12" />
                
                <header className="flex items-center gap-4 mb-12 relative z-10">
                    <motion.button
                        whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
                        whileTap={{ scale: 0.9 }}
                        onClick={onBack}
                        className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-foreground/60 border border-white/20 shadow-sm"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </motion.button>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">صندوق البيت</h1>
                        <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mt-1">
                            اربط حسابك بشريكك من الإعدادات
                        </p>
                    </div>
                </header>
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 py-16 relative z-10">
                    <div className="relative">
                        <div className="absolute inset-0 bg-teal-500/20 blur-2xl rounded-full" />
                        <Armchair className="w-20 h-20 text-teal-500/40 relative z-10 animate-pulse" />
                    </div>
                    <div className="space-y-2 max-w-[200px]">
                        <p className="text-lg font-black text-foreground/80">المكان لسه فاضي</p>
                        <p className="text-sm font-medium text-muted-foreground/60 leading-relaxed">
                            تحتاج شراكة مفعّلة لتبدأ في تجهيز قائمة أغراض بيتكم
                        </p>
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div dir="rtl" lang="ar" className="flex-1 bg-background h-full overflow-hidden flex flex-col relative font-inter">
            {/* Immersive Background */}
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute top-[-15%] start-[-10%] w-[70%] h-[50%] bg-teal-500/[0.08] blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] end-[-10%] w-[60%] h-[40%] bg-amber-500/[0.06] blur-[100px] rounded-full" />
                <div className="absolute top-[30%] end-[-20%] w-[50%] h-[50%] bg-rose-500/[0.03] blur-[140px] rounded-full" />
            </div>

            <header className="px-6 pt-12 pb-6 sticky top-0 bg-background/60 backdrop-blur-2xl z-40 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <motion.button
                        whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
                        whileTap={{ scale: 0.9 }}
                        onClick={onBack}
                        className="w-11 h-11 glass rounded-2xl flex items-center justify-center text-foreground/60 border border-white/20"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </motion.button>
                    <div className="text-center flex flex-col items-center flex-1 px-4">
                        <div className="flex items-center gap-2 mb-1.5">
                            <Sparkles className="w-4 h-4 text-teal-500 animate-spin-slow" />
                            <h1 className="text-2xl font-black text-foreground tracking-tight">صندوق البيت</h1>
                            <Sparkles className="w-4 h-4 text-teal-500 animate-pulse" />
                        </div>
                        <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.25em]">
                            تجهيز عشّنا السعيد
                        </p>
                    </div>
                    <div className="w-11" />
                </div>


                {stats.total > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8 px-2"
                    >
                        <div className="flex items-center justify-between mb-2.5">
                            <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">
                                رحلة التأثيث
                            </span>
                            <span className="text-[10px] font-black text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full">
                                {stats.done} من {stats.total} أغراض
                            </span>
                        </div>
                        <div className="relative h-2.5 rounded-full bg-white/40 dark:bg-white/5 overflow-hidden border border-white/10 p-[1px]">
                            <motion.div
                                className="absolute inset-y-0 start-0 h-full rounded-full bg-gradient-to-l from-teal-500 via-emerald-400 to-teal-500 bg-[length:200%_100%]"
                                initial={{ width: 0 }}
                                animate={{ width: `${stats.pct}%`, backgroundPosition: ['0% 0%', '100% 0%'] }}
                                transition={{ 
                                    width: { duration: 0.8, ease: 'easeOut' },
                                    backgroundPosition: { duration: 3, repeat: Infinity, ease: 'linear' }
                                }}
                            />
                        </div>
                    </motion.div>
                )}


                <div className="flex gap-2.5 mt-7">
                    {[
                        { id: 'all' as const, label: 'الكل' },
                        { id: 'open' as const, label: 'قيد الانتظار' },
                        { id: 'done' as const, label: 'تم الحفظ' },
                    ].map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            onClick={() => setFilter(f.id)}
                            className={`flex-1 py-3 rounded-2xl text-[11px] font-black transition-all duration-500 border relative overflow-hidden ${
                                filter === f.id
                                    ? 'text-white border-transparent'
                                    : 'bg-white/40 dark:bg-white/[0.03] text-foreground/40 border-white/50 dark:border-white/10 hover:bg-white/60'
                            }`}
                        >
                            {filter === f.id && (
                                <motion.div
                                    layoutId="filter-bg"
                                    className="absolute inset-0 bg-gradient-to-r from-teal-600 to-emerald-500 shadow-lg shadow-teal-500/25"
                                />
                            )}
                            <span className="relative z-10">{f.label}</span>
                        </button>
                    ))}
                </div>
            </header>


            <main className="flex-1 overflow-y-auto px-6 py-8 scrollbar-hide pb-40">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 opacity-30">
                        <Package className="w-16 h-16 animate-bounce" />
                    </div>
                ) : filtered.length > 0 ? (
                    <ul className="space-y-4">
                        {filtered.map((item, idx) => (
                            <motion.li
                                key={item.id}
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ 
                                    delay: idx * 0.05,
                                    type: "spring",
                                    stiffness: 100,
                                    damping: 15
                                }}
                                whileHover={{ y: -2 }}
                                className={`group relative glass rounded-[2rem] p-5 border transition-all duration-300 ${
                                    item.is_purchased 
                                    ? 'bg-white/20 dark:bg-white/[0.02] border-white/30 dark:border-white/5 opacity-70' 
                                    : 'bg-white/60 dark:bg-white/[0.05] border-white/70 dark:border-white/10 shadow-xl shadow-black/2'
                                } flex gap-4 items-start`}
                            >
                                <div className="pt-0.5 shrink-0">
                                    <div className="relative">
                                        <Checkbox
                                            checked={item.is_purchased}
                                            onCheckedChange={() => togglePurchased(item)}
                                            className="size-6 rounded-lg data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600 border-2 transition-all duration-300"
                                            aria-label={item.is_purchased ? 'إلغاء التأشير' : 'تم الشراء'}
                                        />
                                        {item.is_purchased && (
                                            <motion.div 
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background"
                                            />
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0 text-start">
                                    <div className="flex items-start justify-between gap-3">
                                        <h3
                                            className={`text-[16px] font-bold leading-tight transition-all duration-500 ${
                                                item.is_purchased
                                                    ? 'text-muted-foreground/40 line-through decoration-teal-500/30 font-medium'
                                                    : 'text-foreground font-black'
                                            }`}
                                        >
                                            {item.title}
                                        </h3>
                                        <motion.button
                                            whileHover={{ scale: 1.2, color: '#ef4444' }}
                                            whileTap={{ scale: 0.8 }}
                                            type="button"
                                            onClick={() => handleDelete(item.id)}
                                            className="text-rose-500/20 group-hover:text-rose-500/60 transition-all shrink-0 p-1 mb-1"
                                            aria-label="حذف"
                                        >
                                            <Trash2 size={16} />
                                        </motion.button>
                                    </div>
                                    {item.notes ? (
                                        <div className="relative mt-2 p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                                            <p className="text-[12px] text-muted-foreground/80 leading-relaxed text-start italic">
                                                {item.notes}
                                            </p>
                                        </div>
                                    ) : null}
                                    <div className="flex items-center gap-2 mt-3">
                                        <div className={`w-1.5 h-1.5 rounded-full ${item.user_id === userId ? 'bg-teal-500' : 'bg-amber-500'}`} />
                                        <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest text-start">
                                            {item.user_id === userId ? 'بواسطتك' : 'بواسطة الشريك'}
                                        </p>
                                    </div>
                                </div>
                            </motion.li>
                        ))}
                    </ul>
                ) : (
                    <div className="flex flex-col items-center justify-center py-28 text-center space-y-6">
                        <div className="relative">
                            <div className="absolute inset-0 bg-teal-500/10 blur-3xl rounded-full scale-150 animate-pulse" />
                            <div className="w-24 h-24 rounded-[2.5rem] bg-gradient-to-br from-white/80 to-white/20 dark:from-white/10 dark:to-transparent flex items-center justify-center shadow-lg border border-white/20 backdrop-blur-xl relative z-10">
                                <Armchair size={48} className="text-teal-500/40" />
                            </div>
                        </div>
                        <div className="space-y-2 relative z-10">
                            <p className="text-sm font-black uppercase tracking-[0.3em] text-foreground/30">
                                {filter === 'all' ? 'القائمة تنتظر لمساتكم' : 'لا توجد أغراض مطابقة'}
                            </p>
                            <p className="text-xs font-medium text-muted-foreground/40">
                                {filter === 'all' ? 'ابدأوا بإضافة أول غرض لمنزلكم المستقبلي' : 'جربوا فلتر آخر أو أضيفوا جديداً'}
                            </p>
                        </div>
                    </div>
                )}
            </main>

            <motion.button
                whileHover={{ scale: 1.05, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowAddModal(true)}
                className="fixed bottom-12 start-10 w-18 h-18 bg-gradient-to-br from-teal-600 via-teal-500 to-emerald-500 text-white rounded-[2.2rem] shadow-2xl shadow-teal-500/40 flex items-center justify-center z-50 border-[4px] border-white/30 backdrop-blur-md"
            >
                <Plus className="w-9 h-9" />
            </motion.button>

            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAddModal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ y: "100%", scale: 0.95 }}
                            animate={{ y: 0, scale: 1 }}
                            exit={{ y: "100%", scale: 0.95 }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="relative w-full max-w-lg bg-white dark:bg-[#0D0D0D] rounded-t-[3.5rem] sm:rounded-[3.5rem] p-10 pt-12 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] overflow-hidden text-start border-t sm:border border-white/10"
                        >
                            {/* Premium background mesh for modal */}
                            <div className="absolute top-0 right-0 w-full h-32 bg-gradient-to-b from-teal-500/10 to-transparent pointer-events-none" />
                            <div className="absolute -top-24 -left-24 w-48 h-48 bg-teal-500/10 blur-[60px] rounded-full pointer-events-none" />
                            
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="absolute top-8 end-8 w-11 h-11 glass rounded-2xl flex items-center justify-center text-foreground/40 hover:text-foreground hover:bg-white/20 transition-all z-50 border border-white/10"
                            >
                                <X size={22} />
                            </button>

                            <div className="mb-10 relative z-10">
                                <div className="flex items-center gap-5 mb-3">
                                    <div className="w-16 h-16 rounded-[1.75rem] bg-gradient-to-br from-teal-500/20 to-emerald-500/10 flex items-center justify-center text-teal-600 shadow-inner">
                                        <Armchair size={32} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-foreground tracking-tight">إضافة غرض</h2>
                                        <p className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mt-1">
                                            بناء عش الزوجية خطوة بخطوة
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <form onSubmit={handleAdd} className="space-y-8 relative z-10" dir="rtl" lang="ar">
                                <div className="space-y-5">
                                    <div className="group relative">
                                        <input
                                            type="text"
                                            autoFocus
                                            value={newTitle}
                                            onChange={(e) => setNewTitle(e.target.value)}
                                            placeholder="ماذا نحتاج؟"
                                            dir="rtl"
                                            className="w-full bg-black/[0.03] dark:bg-white/[0.03] border-2 border-transparent focus:border-teal-500/30 rounded-[1.75rem] p-5 text-lg text-start outline-none transition-all font-black placeholder:text-muted-foreground/30 shadow-inner"
                                            required
                                        />
                                        <div className="absolute bottom-4 end-5 pointer-events-none">
                                            <Package size={20} className="text-muted-foreground/20 group-focus-within:text-teal-500/40 transition-colors" />
                                        </div>
                                    </div>
                                    
                                    <div className="group relative">
                                        <textarea
                                            value={newNotes}
                                            onChange={(e) => setNewNotes(e.target.value)}
                                            placeholder="ملاحظات (اللون، المحل، السعر التقريبي...)"
                                            rows={4}
                                            dir="rtl"
                                            className="w-full bg-black/[0.03] dark:bg-white/[0.03] border-2 border-transparent focus:border-teal-500/30 rounded-[1.75rem] p-5 text-sm text-start outline-none transition-all font-medium placeholder:text-muted-foreground/30 resize-none shadow-inner"
                                        />
                                    </div>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02, boxShadow: "0 20px 30px -10px rgba(20, 184, 166, 0.4)" }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit"
                                    disabled={isSubmitting || !newTitle.trim()}
                                    className="w-full py-5 bg-gradient-to-r from-teal-600 to-emerald-500 text-white rounded-3xl font-black text-sm uppercase tracking-[0.25em] shadow-xl shadow-teal-500/20 disabled:opacity-50 transition-all border-t border-white/20"
                                >
                                    {isSubmitting ? (
                                        <div className="flex items-center justify-center gap-3">
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>جاري الحفظ...</span>
                                        </div>
                                    ) : (
                                        'أضف للقائمة'
                                    )}
                                </motion.button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
}
