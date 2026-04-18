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
            <div dir="rtl" lang="ar" className="flex-1 flex flex-col min-h-full bg-background px-6 pt-10 pb-24">
                <header className="flex items-center gap-4 mb-8">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={onBack}
                        className="w-10 h-10 glass rounded-xl flex items-center justify-center text-foreground/60"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </motion.button>
                    <div>
                        <h1 className="text-xl font-black">صندوق البيت</h1>
                        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                            اربط حسابك بشريكك من الإعدادات
                        </p>
                    </div>
                </header>
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 gap-3 py-16">
                    <Armchair className="w-14 h-14 text-teal-500/40" />
                    <p className="text-sm font-bold">تحتاج شراكة مفعّلة لاستخدام القائمة</p>
                </div>
            </div>
        );
    }

    return (
        <div dir="rtl" lang="ar" className="flex-1 bg-background h-full overflow-hidden flex flex-col relative">
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-teal-500/8 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[35%] bg-amber-500/6 blur-[100px] rounded-full" />
            </div>

            <header className="px-6 pt-10 pb-4 sticky top-0 bg-background/50 backdrop-blur-xl z-40 border-b border-white/10">
                <div className="flex items-center justify-between">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={onBack}
                        className="w-10 h-10 glass rounded-xl flex items-center justify-center text-foreground/60"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </motion.button>
                    <div className="text-center flex flex-col items-center flex-1 px-2">
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="w-4 h-4 text-teal-500" />
                            <h1 className="text-xl font-black text-foreground tracking-tight">صندوق البيت</h1>
                            <Sparkles className="w-4 h-4 text-teal-500" />
                        </div>
                        <p className="text-[9px] font-bold text-muted-foreground/45 uppercase tracking-[0.18em]">
                            تجهيز عشّنا — قائمة مشتريات وعفش
                        </p>
                    </div>
                    <div className="w-10" />
                </div>

                {stats.total > 0 && (
                    <div className="mt-5 px-1">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest">
                                التقدّم
                            </span>
                            <span className="text-[10px] font-black text-teal-600 dark:text-teal-400">
                                {stats.done} / {stats.total} تم شراؤها
                            </span>
                        </div>
                        <div className="relative h-2 rounded-full bg-white/40 dark:bg-white/10 overflow-hidden border border-white/20">
                            <motion.div
                                className="absolute inset-y-0 start-0 h-full rounded-full bg-gradient-to-l from-teal-500 to-emerald-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${stats.pct}%` }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                            />
                        </div>
                    </div>
                )}

                <div className="flex gap-2 mt-5">
                    {[
                        { id: 'all' as const, label: 'الكل' },
                        { id: 'open' as const, label: 'باقي نشتريها' },
                        { id: 'done' as const, label: 'تم الشراء' },
                    ].map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            onClick={() => setFilter(f.id)}
                            className={`flex-1 py-2.5 rounded-2xl text-[10px] font-black transition-all duration-300 border ${
                                filter === f.id
                                    ? 'bg-teal-600 text-white border-teal-600 shadow-lg shadow-teal-500/20'
                                    : 'bg-white/50 dark:bg-white/5 text-foreground/40 border-white/60 dark:border-white/10'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </header>

            <main className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide pb-32">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-25">
                        <Package className="w-12 h-12 animate-pulse" />
                    </div>
                ) : filtered.length > 0 ? (
                    <ul className="space-y-3">
                        {filtered.map((item, idx) => (
                            <motion.li
                                key={item.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.04 }}
                                className="glass rounded-[1.75rem] p-4 border border-white/60 dark:border-white/10 bg-white/45 dark:bg-white/[0.04] flex gap-3 items-start"
                            >
                                <div className="pt-0.5 shrink-0">
                                    <Checkbox
                                        checked={item.is_purchased}
                                        onCheckedChange={() => togglePurchased(item)}
                                        className="size-5 rounded-md data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
                                        aria-label={item.is_purchased ? 'إلغاء التأشير' : 'تم الشراء'}
                                    />
                                </div>
                                <div className="flex-1 min-w-0 text-start">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3
                                            className={`text-[15px] font-black leading-snug text-start flex-1 min-w-0 ${
                                                item.is_purchased
                                                    ? 'text-muted-foreground/50 line-through decoration-teal-500/40'
                                                    : 'text-foreground'
                                            }`}
                                        >
                                            {item.title}
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(item.id)}
                                            className="text-rose-500/35 hover:text-rose-500 transition-colors shrink-0 p-1"
                                            aria-label="حذف"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                    {item.notes ? (
                                        <p className="text-[11px] text-muted-foreground/70 mt-1.5 leading-relaxed text-start">
                                            {item.notes}
                                        </p>
                                    ) : null}
                                    <p className="text-[8px] font-bold text-muted-foreground/35 mt-2 uppercase tracking-wider text-start">
                                        {item.user_id === userId ? 'أضفتَها أنت' : 'من الشريك'}
                                    </p>
                                </div>
                            </motion.li>
                        ))}
                    </ul>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-35">
                        <div className="w-20 h-20 rounded-full bg-teal-500/10 flex items-center justify-center">
                            <Armchair size={40} className="text-teal-500/50" />
                        </div>
                        <p className="text-xs font-black uppercase tracking-[0.2em]">
                            {filter === 'all' ? 'القائمة فاضية — أضيفوا أول غرض' : 'لا شيء في هذا الفلتر'}
                        </p>
                    </div>
                )}
            </main>

            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAddModal(true)}
                className="fixed bottom-10 start-10 w-16 h-16 bg-gradient-to-br from-teal-600 to-teal-500 text-white rounded-[2rem] shadow-2xl shadow-teal-500/30 flex items-center justify-center z-50 border-[3px] border-white/20"
            >
                <Plus className="w-8 h-8" />
            </motion.button>

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
                            className="relative w-full max-w-md bg-background rounded-[2.5rem] p-8 shadow-2xl overflow-hidden text-start"
                        >
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="absolute top-6 end-6 w-10 h-10 glass rounded-xl flex items-center justify-center text-foreground/30 hover:text-foreground"
                            >
                                <X size={20} />
                            </button>

                            <div className="mb-8 mt-2 flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-xl font-black text-foreground">غرض جديد</h2>
                                    <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                                        مثال: ثلاجة، سجاد، طقم صحون…
                                    </p>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-teal-500/15 flex items-center justify-center text-teal-600 shrink-0">
                                    <Armchair size={24} />
                                </div>
                            </div>

                            <form onSubmit={handleAdd} className="space-y-6" dir="rtl" lang="ar">
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        placeholder="اسم الغرض"
                                        dir="rtl"
                                        className="w-full bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10 rounded-2xl p-4 text-sm text-start focus:ring-2 focus:ring-teal-500 outline-none transition-all font-bold"
                                        required
                                    />
                                    <textarea
                                        value={newNotes}
                                        onChange={(e) => setNewNotes(e.target.value)}
                                        placeholder="ملاحظة (مقاس، لون، محل مقترح…)"
                                        rows={3}
                                        dir="rtl"
                                        className="w-full bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10 rounded-2xl p-4 text-sm text-start focus:ring-2 focus:ring-teal-500 outline-none transition-all font-medium resize-none"
                                    />
                                </div>
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    type="submit"
                                    disabled={isSubmitting || !newTitle.trim()}
                                    className="w-full py-4 bg-gradient-to-start from-teal-600 to-teal-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-teal-500/20 disabled:opacity-50"
                                >
                                    {isSubmitting ? 'جاري الإضافة…' : 'أضف للقائمة'}
                                </motion.button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
