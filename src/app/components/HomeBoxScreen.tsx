import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Armchair, Plus, X, Trash2, ChevronRight, Package, Wallet, CheckCircle2, Circle, Clock, Edit2, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

type ItemStatus = 'needed' | 'bought';

interface HomeBoxItem {
    id: string;
    user_id: string;
    title: string;
    notes: string | null;
    price: number;
    status: ItemStatus;
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
    const [showModal, setShowModal] = useState<'add' | 'edit' | null>(null);
    const [editingItem, setEditingItem] = useState<HomeBoxItem | null>(null);
    
    // Form state
    const [title, setTitle] = useState('');
    const [price, setPrice] = useState('');
    const [notes, setNotes] = useState('');
    const [status, setStatus] = useState<ItemStatus>('needed');
    const [isSubmitting, setIsSubmitting] = useState(false);

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
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            const mappedItems = (data || []).map(item => ({
                ...item,
                price: item.price || 0,
                status: item.status === 'bought' || item.is_purchased ? 'bought' : 'needed',
            }));
            
            setItems(mappedItems);
        } catch (e) {
            console.error(e);
            toast.error('تعذّر تحميل صندوق البيت');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAdd = () => {
        setEditingItem(null);
        setTitle('');
        setPrice('');
        setNotes('');
        setStatus('needed');
        setShowModal('add');
    };

    const handleOpenEdit = (item: HomeBoxItem) => {
        setEditingItem(item);
        setTitle(item.title);
        setPrice(item.price.toString());
        setNotes(item.notes || '');
        setStatus(item.status);
        setShowModal('edit');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !partnershipId) return;
        setIsSubmitting(true);
        
        const payload = {
            partnership_id: partnershipId,
            user_id: userId,
            title: title.trim(),
            price: parseFloat(price) || 0,
            status: status,
            is_purchased: status === 'bought',
            notes: notes.trim() || null,
        };

        try {
            let error;
            if (showModal === 'edit' && editingItem) {
                const { error: err } = await supabase
                    .from('home_box_items')
                    .update(payload)
                    .eq('id', editingItem.id);
                error = err;
            } else {
                const { error: err } = await supabase
                    .from('home_box_items')
                    .insert(payload);
                error = err;
            }

            if (error) throw error;
            
            toast.success(showModal === 'edit' ? 'تم التحديث' : 'تمت الإضافة');
            setShowModal(null);
            loadItems();
        } catch (e) {
            console.error(e);
            toast.error('فشلت العملية. تأكد من تحديث قاعدة البيانات.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleStatus = async (item: HomeBoxItem) => {
        const nextStatus = item.status === 'bought' ? 'needed' : 'bought';
        try {
            const { error } = await supabase
                .from('home_box_items')
                .update({ 
                    status: nextStatus, 
                    is_purchased: nextStatus === 'bought',
                    updated_at: new Date().toISOString() 
                })
                .eq('id', item.id);
            if (error) throw error;
            setItems((prev) =>
                prev.map((i) => (i.id === item.id ? { ...i, status: nextStatus, is_purchased: nextStatus === 'bought' } : i))
            );
        } catch (e) {
            toast.error('تعذّر تحديث الحالة');
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

    const totals = useMemo(() => {
        const total = items.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
        const bought = items
            .filter(i => i.status === 'bought')
            .reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
        const remaining = total - bought;
        return { total, bought, remaining };
    }, [items]);

    const groups = useMemo(() => ({
        needed: items.filter(i => i.status === 'needed'),
        bought: items.filter(i => i.status === 'bought'),
    }), [items]);

    if (!partnershipId) {
        return (
            <div dir="rtl" lang="ar" className="flex-1 flex flex-col bg-background px-6 pt-10">
                <header className="flex items-center gap-4 mb-12">
                    <button onClick={onBack} className="w-12 h-12 glass rounded-2xl flex items-center justify-center border border-white/20"><ChevronRight size={24} /></button>
                    <h1 className="text-2xl font-black">صندوق البيت</h1>
                </header>
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <Armchair className="w-20 h-20 text-teal-500/20" />
                    <p className="text-lg font-black opacity-60">اربط حسابك لتفعيل الصندوق</p>
                </div>
            </div>
        );
    }

    return (
        <div dir="rtl" lang="ar" className="flex-1 bg-background h-full overflow-hidden flex flex-col relative">
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute top-[-15%] start-[-10%] w-[70%] h-[50%] bg-teal-500/[0.08] blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] end-[-10%] w-[60%] h-[40%] bg-amber-500/[0.06] blur-[100px] rounded-full" />
            </div>

            <header className="px-6 pt-12 pb-6 sticky top-0 bg-background/60 backdrop-blur-2xl z-40 border-b border-white/5">
                <div className="flex items-center justify-between mb-8">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="w-11 h-11 glass rounded-2xl flex items-center justify-center text-foreground/60 border border-white/20">
                        <ChevronRight className="w-6 h-6" />
                    </motion.button>
                    <div className="text-center">
                        <h1 className="text-xl font-black text-foreground">تجهيزات البيت</h1>
                        <p className="text-[9px] font-black text-teal-600/50 uppercase tracking-[0.2em]">قائمة المشتريات والميزانية</p>
                    </div>
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={handleOpenAdd}
                        className="w-11 h-11 bg-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-teal-500/20"
                    >
                        <Plus className="w-6 h-6" />
                    </motion.button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/40 dark:bg-white/[0.03] rounded-2xl p-4 border border-white/60 dark:border-white/5">
                        <span className="text-[9px] font-black uppercase opacity-50 block mb-1">الميزانية</span>
                        <div className="text-sm font-black text-foreground">{totals.total.toLocaleString()} <span className="text-[10px] opacity-40 font-bold">د.أ</span></div>
                    </div>
                    <div className="bg-emerald-500/10 rounded-2xl p-4 border border-emerald-500/20">
                        <span className="text-[9px] font-black uppercase text-emerald-600/70 block mb-1">تم شراؤه</span>
                        <div className="text-sm font-black text-emerald-600">{totals.bought.toLocaleString()} <span className="text-[10px] opacity-40 font-bold">د.أ</span></div>
                    </div>
                    <div className="bg-amber-500/10 rounded-2xl p-4 border border-amber-500/20">
                        <span className="text-[9px] font-black uppercase text-amber-600/70 block mb-1">المتبقي</span>
                        <div className="text-sm font-black text-amber-600">{totals.remaining.toLocaleString()} <span className="text-[10px] opacity-40 font-bold">د.أ</span></div>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto px-6 py-8 pb-32 scrollbar-hide">
                {loading ? (
                    <div className="flex items-center justify-center py-24 opacity-30"><Package className="w-16 h-16 animate-bounce" /></div>
                ) : (
                    <div className="space-y-12">
                        {/* Section: Need */}
                        <section>
                            <div className="flex items-center justify-between px-2 mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                                    <h3 className="text-sm font-black text-foreground/80 uppercase tracking-widest">نحتاجه ({groups.needed.length})</h3>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {groups.needed.map((item) => (
                                    <ItemCard key={item.id} item={item} onToggle={() => toggleStatus(item)} onDelete={() => handleDelete(item.id)} onEdit={() => handleOpenEdit(item)} />
                                ))}
                                {groups.needed.length === 0 && <EmptyState text="لا توجد أغراض في هذه القائمة" />}
                            </div>
                        </section>

                        {/* Section: Bought */}
                        <section>
                            <div className="flex items-center justify-between px-2 mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                    <h3 className="text-sm font-black text-foreground/80 uppercase tracking-widest">تم الشراء ({groups.bought.length})</h3>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {groups.bought.map((item) => (
                                    <ItemCard key={item.id} item={item} onToggle={() => toggleStatus(item)} onDelete={() => handleDelete(item.id)} onEdit={() => handleOpenEdit(item)} />
                                ))}
                                {groups.bought.length === 0 && <EmptyState text="لم يتم شراء أي شيء بعد" />}
                            </div>
                        </section>
                    </div>
                )}
            </main>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-end justify-center">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(null)} className="absolute inset-0 bg-black/40 backdrop-blur-md" />
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative w-full max-w-lg bg-white dark:bg-[#0D0D0D] rounded-t-[3rem] p-8 pb-12 shadow-2xl z-10">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-xl font-black">{showModal === 'edit' ? 'تعديل الغرض' : 'إضافة غرض جديد'}</h2>
                                <button onClick={() => setShowModal(null)} className="w-10 h-10 glass rounded-xl flex items-center justify-center text-foreground/40"><X size={20} /></button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <input
                                    type="text" value={title} onChange={e => setTitle(e.target.value)}
                                    placeholder="اسم الغرض"
                                    className="w-full h-14 px-6 bg-black/[0.03] dark:bg-white/[0.03] rounded-2xl font-black text-sm outline-none focus:ring-2 ring-teal-500/20"
                                    required
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="relative">
                                        <input
                                            type="number" value={price} onChange={e => setPrice(e.target.value)}
                                            placeholder="السعر"
                                            className="w-full h-14 px-6 bg-black/[0.03] dark:bg-white/[0.03] rounded-2xl font-black text-sm outline-none pr-12"
                                        />
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black opacity-30">د.أ</span>
                                    </div>
                                    <select value={status} onChange={e => setStatus(e.target.value as ItemStatus)} className="w-full h-14 px-4 bg-black/[0.03] dark:bg-white/[0.03] rounded-2xl font-black text-[11px] outline-none">
                                        <option value="needed">لم يتم الشراء</option>
                                        <option value="bought">تم الشراء</option>
                                    </select>
                                </div>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات..." rows={3} className="w-full p-6 bg-black/[0.03] dark:bg-white/[0.03] rounded-2xl font-medium text-sm outline-none resize-none" />
                                <motion.button whileTap={{ scale: 0.98 }} disabled={isSubmitting} className="w-full h-16 bg-teal-600 text-white rounded-2xl font-black shadow-xl shadow-teal-500/20">
                                    {isSubmitting ? 'جاري الحفظ...' : showModal === 'edit' ? 'تحديث التعديلات' : 'إضافة للقائمة'}
                                </motion.button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ItemCard({ item, onToggle, onDelete, onEdit }: { item: HomeBoxItem; onToggle: () => void; onDelete: () => void; onEdit: () => void }) {
    return (
        <motion.div layout className={`glass rounded-3xl p-5 border-white/60 dark:border-white/5 shadow-xl shadow-black/[0.02] group relative transition-all ${item.status === 'bought' ? 'opacity-70' : ''}`}>
            <div className="flex justify-between items-start mb-2">
                <h4 className={`text-[15px] font-black text-foreground flex-1 pr-2 ${item.status === 'bought' ? 'line-through text-muted-foreground' : ''}`}>{item.title}</h4>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={onEdit} className="text-teal-500/60 hover:text-teal-500"><Edit2 size={14} /></button>
                    <button onClick={onDelete} className="text-rose-500/60 hover:text-rose-500"><Trash2 size={14} /></button>
                </div>
            </div>
            {item.notes && <p className="text-[11px] text-muted-foreground/50 mb-4 italic line-clamp-1">"{item.notes}"</p>}
            <div className="flex items-center justify-between">
                <div className="text-xs font-black text-teal-600 dark:text-teal-400 bg-teal-500/10 px-3 py-1.5 rounded-xl">
                    {item.price.toLocaleString()} د.أ
                </div>
                <button onClick={onToggle} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${item.status === 'bought' ? 'bg-emerald-500 text-white' : 'bg-black/5 dark:bg-white/5 text-foreground/20'}`}>
                    {item.status === 'bought' ? <Check size={18} /> : <Circle size={18} />}
                </button>
            </div>
        </motion.div>
    );
}

function EmptyState({ text }: { text: string }) {
    return <div className="py-8 text-center text-[10px] font-black text-foreground/20 uppercase tracking-widest border-2 border-dashed border-foreground/5 rounded-3xl">{text}</div>;
}

