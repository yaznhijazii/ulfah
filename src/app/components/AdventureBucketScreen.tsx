import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, MapPin, DollarSign, Calendar, CheckCircle2, Trash2, Camera, Globe, Compass, Sparkles, Wallet, Clock, Tag, Plane, Mountain, Edit2, X } from 'lucide-react';
import { Button } from './ui/button';
import { supabase, AdventureBucket, FinanceJar } from '../../lib/supabase';

interface AdventureBucketScreenProps {
    onNavigate: (screen: string) => void;
    userId: string;
    partnershipId: string | null;
}

export function AdventureBucketScreen({ onNavigate, userId, partnershipId }: AdventureBucketScreenProps) {
    const [adventures, setAdventures] = useState<AdventureBucket[]>([]);
    const [adventureJar, setAdventureJar] = useState<FinanceJar | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'dream' | 'planned' | 'done'>('dream');

    // UI States
    const [showAddForm, setShowAddForm] = useState(false);
    const [planningItem, setPlanningItem] = useState<AdventureBucket | null>(null);
    const [editingItem, setEditingItem] = useState<AdventureBucket | null>(null);

    // Form inputs (shared for Add and Edit)
    const [formState, setFormState] = useState({
        title: '',
        category: 'trip' as 'trip' | 'travel',
        location: '',
        budgetLevel: 'medium' as 'low' | 'medium' | 'high',
        estimatedCost: '',
        plannedAt: ''
    });

    useEffect(() => {
        if (partnershipId) {
            loadData();
            ensureAdventureJar();
        }
    }, [partnershipId]);

    // Reset form when opening modals
    useEffect(() => {
        if (!showAddForm && !editingItem && !planningItem) {
            setFormState({
                title: '',
                category: 'trip',
                location: '',
                budgetLevel: 'medium',
                estimatedCost: '',
                plannedAt: new Date().toISOString().slice(0, 16)
            });
        }
    }, [showAddForm, editingItem, planningItem]);

    // Populate form when editing
    useEffect(() => {
        if (editingItem) {
            setFormState({
                title: editingItem.title,
                category: editingItem.category,
                location: editingItem.location || '',
                budgetLevel: editingItem.budget_level,
                estimatedCost: editingItem.estimated_cost.toString(),
                plannedAt: editingItem.planned_at ? new Date(editingItem.planned_at).toISOString().slice(0, 16) : ''
            });
        }
    }, [editingItem]);

    const ensureAdventureJar = async () => {
        if (!partnershipId) return;
        const { data: jars } = await supabase.from('finance_jars').select('*').eq('partnership_id', partnershipId).eq('title', 'حصالة المغامرات');
        if (jars && jars.length > 0) {
            setAdventureJar(jars[0]);
        } else {
            const { data: newJar } = await supabase.from('finance_jars').insert({
                partnership_id: partnershipId,
                created_by_user_id: userId,
                title: 'حصالة المغامرات',
                description: 'حصالة للأشياء اللي نفسنا نعملها (طلعات وسفرات)',
                target_amount: 10000,
                current_amount: 0,
                icon: 'Compass',
                color: 'text-amber-500'
            }).select().single();
            if (newJar) setAdventureJar(newJar);
        }
    };

    const loadData = async () => {
        if (!partnershipId) return;
        setLoading(true);
        const { data } = await supabase.from('adventure_bucket').select('*').eq('partnership_id', partnershipId).order('created_at', { ascending: false });
        if (data) setAdventures(data);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!formState.title.trim() || !partnershipId) return;

        const adventureData = {
            partnership_id: partnershipId,
            title: formState.title,
            category: formState.category,
            location: formState.location,
            budget_level: formState.budgetLevel,
            estimated_cost: parseFloat(formState.estimatedCost) || 0,
        };

        if (editingItem) {
            // Update existing
            const updatePayload: any = { ...adventureData };
            // Allow updating date if editing a planned item
            if (editingItem.status === 'planned' && formState.plannedAt) {
                updatePayload.planned_at = new Date(formState.plannedAt).toISOString();
            }

            const { error } = await supabase.from('adventure_bucket').update(updatePayload).eq('id', editingItem.id);
            if (!error) {
                setAdventures(prev => prev.map(a => a.id === editingItem.id ? { ...a, ...updatePayload } : a));
                setEditingItem(null);
            }
        } else {
            // Create new
            const { data } = await supabase.from('adventure_bucket').insert({
                ...adventureData,
                created_by_user_id: userId,
                status: 'dream'
            }).select().single();
            if (data) {
                setAdventures([data, ...adventures]);
                setShowAddForm(false);
            }
        }
    };

    const confirmPlanning = async () => {
        if (!planningItem || !formState.plannedAt) return;

        const updateData = {
            status: 'planned',
            planned_at: new Date(formState.plannedAt).toISOString()
        };

        const { error } = await supabase.from('adventure_bucket').update(updateData).eq('id', planningItem.id);

        if (!error) {
            // Sync with calendar
            await supabase.from('calendar_events').insert({
                partnership_id: partnershipId,
                created_by_user_id: userId,
                title: planningItem.category === 'trip' ? `طلعة: ${planningItem.title}` : `سفرة: ${planningItem.title}`,
                event_date: formState.plannedAt.split('T')[0],
                event_time: formState.plannedAt.split('T')[1] || '12:00',
                event_type: planningItem.category === 'trip' ? 'meeting' : 'travel',
                description: `مخطط لـ ${planningItem.title}`
            });

            loadData();
            setPlanningItem(null);
            setActiveTab('planned');
        }
    };

    const updateStatus = async (id: string, newStatus: 'done', cost?: number) => {
        if (newStatus === 'done' && adventureJar && cost) {
            const newJarAmount = Math.max(0, adventureJar.current_amount - cost);
            await supabase.from('finance_jars').update({ current_amount: newJarAmount }).eq('id', adventureJar.id);
            setAdventureJar({ ...adventureJar, current_amount: newJarAmount });
        }
        const { error } = await supabase.from('adventure_bucket').update({ status: newStatus }).eq('id', id);
        if (!error) loadData();
    };

    const deleteAdventure = async (id: string) => {
        const { error } = await supabase.from('adventure_bucket').delete().eq('id', id);
        if (!error) setAdventures(adventures.filter(a => a.id !== id));
    };

    const filteredAdventures = adventures.filter(a => a.status === activeTab);

    return (
        <div className="flex-1 bg-background flex flex-col relative h-full overflow-hidden mood-adventure" dir="rtl">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute top-[-20%] right-[-10%] w-[80%] h-[60%] bg-orange-500/10 blur-[120px] rounded-full opacity-60" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[80%] h-[60%] bg-blue-500/10 blur-[120px] rounded-full opacity-40" />
            </div>

            <header className="px-6 pt-10 pb-6 sticky top-0 bg-background/60 backdrop-blur-xl z-40 border-b border-white/5">
                <div className="flex items-center justify-between mb-8">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => onNavigate('home')} className="w-12 h-12 flex items-center justify-center glass rounded-[1.4rem] border-white/60 dark:border-white/10 text-foreground/30 shadow-2xl active:scale-90 transition-all font-black"><ArrowLeft className="w-5 h-5" /></motion.button>
                    <div className="text-center">
                        <h1 className="text-xl font-black text-foreground tracking-tighter">أفق أحلامنا</h1>
                        <div className="flex items-center justify-center gap-2 mt-1.5 px-3 py-1 bg-amber-500/5 rounded-full border border-amber-500/10">
                            <Sparkles className="w-3 h-3 text-amber-500/60" />
                            <p className="text-[9px] font-black text-amber-600/60 uppercase tracking-[0.3em]">بوصلة الشغف المشترك</p>
                        </div>
                    </div>
                    <motion.button 
                        whileTap={{ scale: 0.9 }} 
                        onClick={() => setShowAddForm(true)} 
                        className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 text-white rounded-[1.4rem] flex items-center justify-center shadow-xl shadow-amber-500/20 active:scale-90 transition-all"
                    >
                        <Plus className="w-6 h-6" />
                    </motion.button>
                </div>

                {adventureJar && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full h-48 rounded-[3rem] p-8 overflow-hidden mb-10 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.15)] group bg-[#111] border border-white/5">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.08] via-transparent to-rose-500/[0.05] z-0" />
                        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/[0.05] blur-[80px] rounded-full z-0 -mr-20 -mt-20" />
                        
                        <div className="relative z-10 flex flex-col justify-between h-full text-white/90">
                            <div className="flex justify-between items-start">
                                <div className="p-3.5 bg-white/[0.03] rounded-2xl border border-white/5 backdrop-blur-3xl shadow-inner">
                                    <Wallet className="w-6 h-6 text-amber-400/80" />
                                </div>
                                <div className="text-left font-black tracking-tighter">
                                    <p className="text-[9px] font-bold opacity-30 uppercase tracking-[0.4em] mb-1.5">مخزون الرخاء</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl">{adventureJar.current_amount.toLocaleString()}</span>
                                        <span className="text-[10px] opacity-30 uppercase tracking-widest font-medium">JOD</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="flex justify-between items-end mb-1">
                                    <p className="text-[10px] font-black opacity-30 uppercase tracking-widest">اكتمال الهدف: {adventureJar.target_amount.toLocaleString()}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-amber-500/80 tracking-widest leading-none">
                                            {Math.round((adventureJar.current_amount / (adventureJar.target_amount || 1)) * 100)}%
                                        </span>
                                    </div>
                                </div>
                                <div className="h-2.5 w-full bg-white/[0.03] rounded-full overflow-hidden p-[2px] border border-white/5">
                                    <motion.div 
                                        initial={{ width: 0 }} 
                                        animate={{ width: `${Math.min(100, (adventureJar.current_amount / (adventureJar.target_amount || 1)) * 100)}%` }} 
                                        transition={{ duration: 1.5, ease: "circOut" }} 
                                        className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 rounded-full shadow-[0_0_20px_rgba(251,146,60,0.4)]" 
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                <div className="flex items-center p-1.5 bg-white/40 dark:bg-white/[0.03] rounded-[2.2rem] relative border border-white/60 dark:border-white/5 shadow-inner">
                    {[{ id: 'dream', label: 'أمنياتنا' }, { id: 'planned', label: 'خارطة الطريق' }, { id: 'done', label: 'حصاد اللحظات' }].map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 py-3.5 rounded-[1.8rem] relative z-10 text-[10px] font-black transition-all duration-500 uppercase tracking-widest ${isActive ? 'text-white' : 'text-foreground/30 hover:text-foreground/50'}`}>
                                {isActive && <motion.div layoutId="activeTabPill" className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500 rounded-[1.8rem] shadow-xl shadow-amber-500/20 z-[-1]" />}
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-6 pb-32 scrollbar-hide">
                <AnimatePresence mode="wait">
                    {filteredAdventures.length === 0 ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20 opacity-40 text-center space-y-4">
                            <div className="w-24 h-24 bg-muted/30 rounded-full flex items-center justify-center"><Mountain className="w-10 h-10 text-muted-foreground" /></div>
                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">قائمة المغامرات فارغة...</p>
                        </motion.div>
                    ) : (
                        <div className="space-y-6">
                            {filteredAdventures.map((adv, i) => (
                                <motion.div key={adv.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.05 }}>
                                    {adv.status === 'dream' && (
                                        <div className="group relative bg-white dark:bg-[#1c1c1e] rounded-[2.5rem] p-6 shadow-xl border border-black/5 dark:border-white/5 overflow-hidden transition-all hover:scale-[1.02]">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -mr-10 -mt-10" />
                                            <div className="flex justify-between items-start mb-6 relative z-10">
                                                <div className="flex items-start gap-4">
                                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${adv.category === 'travel' ? 'bg-indigo-50 text-indigo-500 dark:bg-indigo-900/20' : 'bg-orange-50 text-orange-500 dark:bg-orange-900/20'}`}>{adv.category === 'travel' ? <Plane className="w-6 h-6" /> : <Compass className="w-6 h-6" />}</div>
                                                    <div>
                                                        <h3 className="text-lg font-black tracking-tight leading-tight mb-1">{adv.title}</h3>
                                                        <div className="flex items-center gap-1 text-muted-foreground/60"><MapPin className="w-3 h-3" /><span className="text-[10px] font-bold">{adv.location || 'وجهة غير محددة'}</span></div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end"><span className="text-xl font-black text-orange-500">{adv.estimated_cost}</span><span className="text-[9px] font-bold text-muted-foreground/40 uppercase">د.أ تقريباً</span></div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Button onClick={() => setPlanningItem(adv)} className="flex-1 h-12 bg-black dark:bg-white dark:text-black text-white rounded-2xl font-black text-xs shadow-lg active:scale-95 transition-all hover:bg-black/80">بدء التخطيط</Button>
                                                <button onClick={() => setEditingItem(adv)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5 text-muted-foreground hover:bg-black/10 transition-colors"><Edit2 className="w-5 h-5" /></button>
                                                <button onClick={() => deleteAdventure(adv.id)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"><Trash2 className="w-5 h-5" /></button>
                                            </div>
                                        </div>
                                    )}

                                    {adv.status === 'planned' && (
                                        <div className="relative bg-white dark:bg-[#1c1c1e] rounded-[2rem] shadow-xl overflow-hidden border-l-4 border-l-indigo-500">
                                            <div className="flex">
                                                <div className="flex-1 p-6">
                                                    <div className="flex justify-between items-start mb-6">
                                                        <div><span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block mb-1">تذكرة العبور</span><h3 className="text-2xl font-black">{adv.title}</h3></div>
                                                        <Plane className="w-6 h-6 text-indigo-300 -rotate-45" />
                                                    </div>
                                                    <div className="flex justify-between items-center bg-muted/30 rounded-2xl p-4 mb-6">
                                                        <div><span className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">التاريخ</span><p className="font-black text-xs">{adv.planned_at ? new Date(adv.planned_at).toLocaleDateString('ar-EG') : 'قريباً'}</p></div>
                                                        <div className="w-px h-8 bg-black/5" />
                                                        <div><span className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">الميزانية</span><p className="font-black text-xs text-indigo-500">{adv.estimated_cost} JOD</p></div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button onClick={() => updateStatus(adv.id, 'done', adv.estimated_cost)} className="flex-1 h-12 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-black text-xs">إتمام الرحلة ✅</Button>
                                                        <button onClick={() => setEditingItem(adv)} className="w-12 h-12 flex items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 text-muted-foreground"><Edit2 className="w-5 h-5" /></button>
                                                    </div>
                                                </div>
                                                <div className="w-6 flex flex-col justify-between items-center py-2 border-r border-dashed border-black/10 relative">
                                                    <div className="absolute -top-3 -right-3 w-6 h-6 bg-background rounded-full" />
                                                    <div className="rotate-90 text-[8px] font-black text-muted-foreground/30 tracking-[0.3em] whitespace-nowrap">ADVENTURE TICKET</div>
                                                    <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-background rounded-full" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {adv.status === 'done' && (
                                        <div className="relative bg-[#fffbf0] dark:bg-[#2c2c2e] p-4 pb-12 rounded-[2px] shadow-lg rotate-1 hover:rotate-0 transition-transform duration-500 origin-center text-center">
                                            <div className="bg-black/5 aspect-square rounded-sm mb-4 flex items-center justify-center overflow-hidden"><Camera className="w-12 h-12 text-black/10" /></div>
                                            <h3 className="font-handwriting text-xl font-black text-gray-800 dark:text-gray-200">{adv.title}</h3>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{new Date().toLocaleDateString()}</p>
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-8 bg-white/30 backdrop-blur-sm border-l border-r border-white/40 rotate-1 shadow-sm opacity-80" />
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    )}
                </AnimatePresence>
            </div>

            {/* General Form Modal (Add/Edit) */}
            <AnimatePresence>
                {(showAddForm || editingItem) && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowAddForm(false); setEditingItem(null); }} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
                        <motion.div initial={{ scale: 0.9, y: 50, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 50, opacity: 0 }} className="bg-background w-full max-w-md rounded-[3rem] p-8 border border-white/10 shadow-2xl relative z-10">
                            <h3 className="text-2xl font-black text-center mb-8">{editingItem ? 'تعديل البيانات ✏️' : 'أمنية جديدة ✨'}</h3>
                            <div className="space-y-6">
                                <div className="flex p-1 bg-muted/40 rounded-2xl">
                                    <button onClick={() => setFormState({ ...formState, category: 'trip' })} className={`flex-1 py-4 rounded-xl font-black text-xs transition-all ${formState.category === 'trip' ? 'bg-background shadow-lg text-orange-500' : 'text-muted-foreground'}`}>رحلة قصيرة</button>
                                    <button onClick={() => setFormState({ ...formState, category: 'travel' })} className={`flex-1 py-4 rounded-xl font-black text-xs transition-all ${formState.category === 'travel' ? 'bg-background shadow-lg text-orange-500' : 'text-muted-foreground'}`}>سفر</button>
                                </div>
                                <div className="space-y-4">
                                    <input placeholder="عنوان المغامرة..." value={formState.title} onChange={e => setFormState({ ...formState, title: e.target.value })} className="w-full h-16 bg-muted/30 rounded-2xl px-6 text-right font-bold outline-none focus:ring-2 ring-orange-500/20" />
                                    <input placeholder="الوجهة (اختياري)..." value={formState.location} onChange={e => setFormState({ ...formState, location: e.target.value })} className="w-full h-16 bg-muted/30 rounded-2xl px-6 text-right font-bold outline-none focus:ring-2 ring-orange-500/20" />
                                    <div className="relative">
                                        <input type="number" placeholder="التكلفة التقديرية" value={formState.estimatedCost} onChange={e => setFormState({ ...formState, estimatedCost: e.target.value })} className="w-full h-16 bg-muted/30 rounded-2xl px-6 text-right font-bold outline-none focus:ring-2 ring-orange-500/20" />
                                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground">JOD</div>
                                    </div>
                                    {/* Show date picker if item is already planned and we are editing it */}
                                    {editingItem?.status === 'planned' && (
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-muted-foreground uppercase px-2">موعد الرحلة</p>
                                            <input type="datetime-local" value={formState.plannedAt} onChange={e => setFormState({ ...formState, plannedAt: e.target.value })} className="w-full h-16 bg-muted/30 rounded-2xl px-6 text-right font-bold outline-none focus:ring-2 ring-orange-500/20" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-4 mt-8">
                                    <button onClick={() => { setShowAddForm(false); setEditingItem(null); }} className="flex-1 h-14 rounded-2xl font-black text-xs text-muted-foreground bg-muted/50 hover:bg-muted/70">إلغاء</button>
                                    <button onClick={handleSave} disabled={!formState.title} className="flex-[2] h-14 rounded-2xl font-black text-xs bg-orange-500 text-white shadow-xl shadow-orange-500/20 hover:bg-orange-600 disabled:opacity-50 transition-all">حفظ البيانات</button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Date Selection Modal for Planning */}
            <AnimatePresence>
                {planningItem && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPlanningItem(null)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
                        <motion.div initial={{ scale: 0.9, y: 50, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 50, opacity: 0 }} className="bg-background w-full max-w-md rounded-[3rem] p-8 border border-white/10 shadow-2xl relative z-10">
                            <h3 className="text-2xl font-black text-center mb-8">متى الموعد؟ 🗓️</h3>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase px-2">تاريخ ووقت الانطلاق</p>
                                    <input type="datetime-local" value={formState.plannedAt} onChange={e => setFormState({ ...formState, plannedAt: e.target.value })} className="w-full h-16 bg-muted/30 rounded-2xl px-6 text-right font-bold outline-none focus:ring-2 ring-indigo-500/20" />
                                </div>
                                <div className="flex gap-4 mt-8">
                                    <button onClick={() => setPlanningItem(null)} className="flex-1 h-14 rounded-2xl font-black text-xs text-muted-foreground bg-muted/50 hover:bg-muted/70">تأجيل</button>
                                    <button onClick={confirmPlanning} className="flex-[2] h-14 rounded-2xl font-black text-xs bg-indigo-500 text-white shadow-xl shadow-indigo-500/20 hover:bg-indigo-600 transition-all">اعتماد الموعد ✅</button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
