import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, MapPin, DollarSign, Calendar, CheckCircle2, Trash2, Camera, Globe, Compass, Sparkles, Wallet, Clock, Tag } from 'lucide-react';
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
    const [showAddForm, setShowAddForm] = useState(false);
    const [activeTab, setActiveTab] = useState<'dream' | 'planned' | 'done'>('dream');

    // Form states
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<'trip' | 'travel'>('trip');
    const [location, setLocation] = useState('');
    const [budgetLevel, setBudgetLevel] = useState<'low' | 'medium' | 'high'>('medium');
    const [estimatedCost, setEstimatedCost] = useState('');
    const [plannedAt, setPlannedAt] = useState('');

    useEffect(() => {
        if (partnershipId) {
            loadData();
            ensureAdventureJar();
        }
    }, [partnershipId]);

    const ensureAdventureJar = async () => {
        if (!partnershipId) return;

        // Find existing jar named "حصالة المغامرات"
        const { data: jars } = await supabase
            .from('finance_jars')
            .select('*')
            .eq('partnership_id', partnershipId)
            .eq('title', 'حصالة المغامرات');

        if (jars && jars.length > 0) {
            setAdventureJar(jars[0]);
        } else {
            // Create one
            const { data: newJar, error } = await supabase
                .from('finance_jars')
                .insert({
                    partnership_id: partnershipId,
                    created_by_user_id: userId,
                    title: 'حصالة المغامرات',
                    description: 'حصالة للأشياء اللي نفسنا نعملها (طلعات وسفرات)',
                    target_amount: 10000,
                    current_amount: 0,
                    icon: 'Compass',
                    color: 'text-amber-500'
                })
                .select()
                .single();

            if (newJar) setAdventureJar(newJar);
        }
    };

    const loadData = async () => {
        if (!partnershipId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('adventure_bucket')
            .select('*')
            .eq('partnership_id', partnershipId)
            .order('created_at', { ascending: false });

        if (data) setAdventures(data);
        setLoading(false);
    };

    const handleAddAdventure = async () => {
        if (!title.trim() || !partnershipId) return;

        const { data, error } = await supabase
            .from('adventure_bucket')
            .insert({
                partnership_id: partnershipId,
                created_by_user_id: userId,
                title,
                category,
                location,
                budget_level: budgetLevel,
                estimated_cost: parseFloat(estimatedCost) || 0,
                status: 'dream'
            })
            .select()
            .single();

        if (data) {
            setAdventures([data, ...adventures]);
            setShowAddForm(false);
            resetForm();
        }
    };

    const resetForm = () => {
        setTitle('');
        setCategory('trip');
        setLocation('');
        setBudgetLevel('medium');
        setEstimatedCost('');
        setPlannedAt('');
    };

    const updateStatus = async (id: string, newStatus: 'planned' | 'done', cost?: number) => {
        const updateData: any = { status: newStatus };

        if (newStatus === 'planned') {
            updateData.planned_at = plannedAt || new Date().toISOString();

            // Sync with calendar
            await supabase.from('calendar_events').insert({
                partnership_id: partnershipId,
                created_by_user_id: userId,
                title: category === 'trip' ? `طلعة: ${title}` : `سفرة: ${title}`,
                event_date: plannedAt.split('T')[0],
                event_time: plannedAt.split('T')[1] || '12:00',
                event_type: category === 'trip' ? 'meeting' : 'travel',
                description: `مخطط لـ ${title} بميزانية حوالي ${cost}`
            });
        }

        if (newStatus === 'done' && adventureJar && cost) {
            // Deduct from jar
            const newJarAmount = Math.max(0, adventureJar.current_amount - cost);
            await supabase.from('finance_jars').update({ current_amount: newJarAmount }).eq('id', adventureJar.id);
            setAdventureJar({ ...adventureJar, current_amount: newJarAmount });
        }

        const { error } = await supabase.from('adventure_bucket').update(updateData).eq('id', id);
        if (!error) loadData();
    };

    const deleteAdventure = async (id: string) => {
        const { error } = await supabase.from('adventure_bucket').delete().eq('id', id);
        if (!error) setAdventures(adventures.filter(a => a.id !== id));
    };

    const getBudgetIcons = (level: string) => {
        const count = level === 'low' ? 1 : level === 'medium' ? 2 : 3;
        return Array(count).fill(0).map((_, i) => <DollarSign key={i} className="w-3 h-3 text-emerald-500" />);
    };

    const filteredAdventures = adventures.filter(a => a.status === activeTab);

    return (
        <div className="flex-1 bg-background flex flex-col relative h-full overflow-hidden mood-adventure">
            {/* Adventure Hub Accents */}
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[100%] h-[60%] bg-amber-500/10 blur-[150px] rounded-full opacity-60" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[100%] h-[60%] bg-cyan-500/5 blur-[150px] rounded-full opacity-40" />
            </div>

            <header className="px-8 pt-12 pb-6 flex flex-col sticky top-0 bg-background/40 backdrop-blur-3xl z-40">
                <div className="flex items-center justify-between mb-8">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onNavigate('home')}
                        className="w-14 h-14 flex items-center justify-center glass rounded-3xl border-white/60 shadow-xl text-foreground/40"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </motion.button>
                    <div className="text-center">
                        <h1 className="text-2xl font-black text-foreground tracking-tighter">أملنا الموعود</h1>
                        <p className="text-[9px] font-black text-amber-600/40 uppercase tracking-[0.5em]">مغامراتنا الموعودة</p>
                    </div>
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        whileHover={{ scale: 1.1, rotate: 90 }}
                        onClick={() => setShowAddForm(true)}
                        className="w-14 h-14 bg-amber-500 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-amber-500/30 border-t border-white/30"
                    >
                        <Plus className="w-8 h-8" />
                    </motion.button>
                </div>

                {/* Adventure Jar Info Widget */}
                {adventureJar && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass rounded-[3rem] p-8 mb-10 border-white/60 shadow-2xl bg-white/20 relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-amber-500/10 transition-colors" />
                        <div className="flex items-center justify-between relative z-10 w-full mb-6">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-[1.8rem] bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-xl shadow-amber-500/5 border border-white/40">
                                    <Wallet className="w-8 h-8" />
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-amber-600/40 uppercase tracking-[0.4em]">ميزانية الفرح</p>
                                    <p className="text-3xl font-black text-foreground tracking-tighter">{adventureJar.current_amount.toLocaleString()} د.أ</p>
                                </div>
                            </div>
                            <div className="w-14 h-14 rounded-full glass border-white flex items-center justify-center text-amber-500/30">
                                <Compass className="w-8 h-8 animate-spin-slow" />
                            </div>
                        </div>
                        <div className="w-full h-2.5 glass-dark rounded-full relative overflow-hidden shadow-inner">
                            <motion.div
                                className="absolute inset-y-0 right-0 bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (adventureJar.current_amount / (adventureJar.target_amount || 1)) * 100)}%` }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                            />
                        </div>
                    </motion.div>
                )}

                <div className="flex glass rounded-[2.8rem] border-white/80 p-2 shadow-2xl bg-white/40 ring-1 ring-black/[0.03]">
                    {[
                        { id: 'dream', label: 'أمانِينا', icon: Sparkles },
                        { id: 'planned', label: 'الموعد', icon: Clock },
                        { id: 'done', label: 'ذكرىٰ', icon: CheckCircle2 }
                    ].map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-[2.2rem] transition-all duration-700 relative z-10 ${isActive ? 'text-white' : 'text-amber-800/30 hover:text-amber-500'}`}
                            >
                                {isActive && <motion.div layoutId="adv-tab-pill" className="absolute inset-0 bg-amber-500 rounded-[2.2rem] shadow-2xl shadow-amber-500/20 z-[-1]" />}
                                <tab.icon className={`w-4 h-4 transition-transform ${isActive ? 'rotate-12' : ''}`} />
                                <span className="text-[11px] font-black uppercase tracking-widest">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-8 py-6 pb-40 scrollbar-hide">
                <AnimatePresence mode="wait">
                    {loading ? (
                        <div className="flex justify-center py-24">
                            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-xl shadow-primary/10" />
                        </div>
                    ) : filteredAdventures.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-24 space-y-6 opacity-30"
                        >
                            <div className="w-20 h-20 glass-dark border-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto">
                                <Compass className="w-10 h-10" />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">لا يوجد خطط هنا بعد..</p>
                        </motion.div>
                    ) : (
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, scale: 0.95, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 30 }}
                            className="space-y-8"
                        >
                            {filteredAdventures.map((adv, idx) => (
                                <motion.div
                                    key={adv.id}
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05, type: "spring", stiffness: 100 }}
                                    className="glass rounded-[3.5rem] p-8 shadow-2xl border-white/60 relative overflow-hidden group bg-white/30"
                                >
                                    {/* Ticket Perforation Simulation */}
                                    <div className="absolute top-1/2 -left-4 w-8 h-8 rounded-full bg-background border-r border-white/20 -translate-y-1/2" />
                                    <div className="absolute top-1/2 -right-4 w-8 h-8 rounded-full bg-background border-l border-white/20 -translate-y-1/2" />

                                    <div className="flex justify-between items-start mb-8 relative z-10">
                                        <div className="flex items-center gap-6">
                                            <div className="w-16 h-16 rounded-[2rem] glass border-white shadow-xl flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-6">
                                                {adv.category === 'trip' ? <Tag className="w-8 h-8 text-amber-500" /> : <Globe className="w-8 h-8 text-cyan-500" />}
                                            </div>
                                            <div className="text-right">
                                                <h3 className="text-2xl font-black text-foreground tracking-tighter mb-1">{adv.title}</h3>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-5 h-5 rounded-lg glass flex items-center justify-center">
                                                        <MapPin className="w-3 h-3 text-amber-600/60" />
                                                    </div>
                                                    <span className="text-[11px] font-black text-amber-900/40 uppercase tracking-widest">{adv.location || 'أينما كان'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1.5 p-2 glass rounded-2xl border-white/20">
                                            {getBudgetIcons(adv.budget_level)}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-8 border-t border-amber-500/5 relative z-10">
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-amber-600/30 uppercase tracking-[0.3em] leading-none mb-2">تأشيرة الوعد</p>
                                            <p className="text-2xl font-black text-foreground tracking-tighter">{adv.estimated_cost.toLocaleString()} <span className="text-sm text-muted-foreground/40 mr-1">د.أ</span></p>
                                        </div>

                                        <div className="flex gap-4">
                                            {adv.status === 'dream' && (
                                                <motion.button
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={() => { updateStatus(adv.id, 'planned', adv.estimated_cost); }}
                                                    className="h-14 px-8 rounded-[1.8rem] bg-amber-500 text-white text-[11px] font-black shadow-[0_15px_40px_rgba(245,158,11,0.25)] border-t border-white/20 uppercase tracking-widest"
                                                >
                                                    تحويل لحقيقة
                                                </motion.button>
                                            )}
                                            {adv.status === 'planned' && (
                                                <motion.button
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={() => updateStatus(adv.id, 'done', adv.estimated_cost)}
                                                    className="h-14 px-8 rounded-[1.8rem] bg-emerald-500 text-white text-[11px] font-black shadow-[0_15px_40px_rgba(16,185,129,0.25)] border-t border-white/20 uppercase tracking-widest"
                                                >
                                                    نُقشت بالقلب
                                                </motion.button>
                                            )}
                                            <motion.button
                                                whileTap={{ scale: 0.8 }}
                                                onClick={() => deleteAdventure(adv.id)}
                                                className="w-14 h-14 glass border-white rounded-[1.8rem] flex items-center justify-center text-rose-500/30 hover:text-rose-500 hover:bg-rose-500/5 transition-all shadow-xl"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </motion.button>
                                        </div>
                                    </div>

                                    {adv.status === 'planned' && adv.planned_at && (
                                        <div className="mt-8 px-6 py-4 glass border-amber-500/10 rounded-[1.8rem] flex items-center justify-between shadow-inner">
                                            <div className="flex items-center gap-4">
                                                <Clock className="w-4 h-4 text-amber-500" />
                                                <span className="text-[10px] font-black text-amber-900/50 uppercase tracking-widest">تاريخ اللقاء</span>
                                            </div>
                                            <span className="text-[10px] font-black text-amber-600 leading-none">{new Date(adv.planned_at).toLocaleString('ar-SA')}</span>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Add Form Modal */}
            <AnimatePresence>
                {showAddForm && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-8">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-2xl" onClick={() => setShowAddForm(false)} />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 40 }}
                            className="relative w-full max-w-md glass border-white/30 rounded-[3.5rem] p-8 z-10 space-y-6 shadow-2xl overflow-y-auto max-h-[85vh] scrollbar-hide"
                        >
                            <div className="text-center space-y-2">
                                <h2 className="text-2xl font-black text-foreground tracking-tighter">أمنية جديدة ✨</h2>
                                <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">طلعة خفيفة أم سفرة بعيدة؟</p>
                            </div>

                            <div className="space-y-5">
                                <div className="flex p-1 glass-dark rounded-2xl border-white/5">
                                    <button onClick={() => setCategory('trip')} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${category === 'trip' ? 'bg-white text-primary shadow-lg shadow-black/5' : 'text-muted-foreground/40'}`}>طلعة</button>
                                    <button onClick={() => setCategory('travel')} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${category === 'travel' ? 'bg-white text-primary shadow-lg shadow-black/5' : 'text-muted-foreground/40'}`}>سفرة</button>
                                </div>

                                <div className="space-y-4">
                                    <input placeholder="اسم الرحلة..." value={title} onChange={e => setTitle(e.target.value)} className="w-full h-14 glass-dark border-white/10 rounded-2xl px-6 text-right font-bold text-foreground focus:ring-4 ring-primary/10 outline-none" />
                                    <input placeholder="المكان (اختياري)..." value={location} onChange={e => setLocation(e.target.value)} className="w-full h-14 glass-dark border-white/10 rounded-2xl px-6 text-right font-bold text-foreground focus:ring-4 ring-primary/10 outline-none" />
                                    <input type="number" placeholder="كم التكلفة تقريباً؟" value={estimatedCost} onChange={e => setEstimatedCost(e.target.value)} className="w-full h-14 glass-dark border-white/10 rounded-2xl px-6 text-right font-bold text-foreground focus:ring-4 ring-primary/10 outline-none" />
                                </div>

                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest text-right px-2">مستوى الميزانية</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['low', 'medium', 'high'].map(level => (
                                            <button
                                                key={level}
                                                onClick={() => setBudgetLevel(level as any)}
                                                className={`h-14 rounded-2xl border-2 transition-all font-black text-[10px] ${budgetLevel === level ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600' : 'border-white/5 glass-dark text-muted-foreground/30'}`}
                                            >
                                                {level === 'low' ? 'بسيطة' : level === 'medium' ? 'متوسطة' : 'مكلفة'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {status === 'planned' && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest text-right px-2">التاريخ والوقت</p>
                                        <input type="datetime-local" value={plannedAt} onChange={e => setPlannedAt(e.target.value)} className="w-full h-14 glass-dark border-white/10 rounded-2xl px-6 text-right font-bold text-foreground focus:ring-4 ring-primary/10 outline-none" />
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button className="flex-1 h-16 rounded-[2rem] glass border-white/10 text-muted-foreground font-black text-xs uppercase" onClick={() => setShowAddForm(false)}>تراجع</button>
                                <Button onClick={handleAddAdventure} disabled={!title.trim()} className="flex-[2] h-16 bg-primary text-white rounded-[2rem] font-black text-sm shadow-2xl shadow-primary/20">تثبيت الأمنية ✨</Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
