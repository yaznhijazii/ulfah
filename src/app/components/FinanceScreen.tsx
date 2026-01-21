import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    PiggyBank,
    Wallet,
    Plus,
    ArrowRight,
    TrendingUp,
    Calendar,
    Target,
    ChevronRight,
    User,
    Users,
    MoreVertical,
    Trash2,
    DollarSign,
    Heart,
    PlusCircle,
    X,
    CheckCircle2,
    CalendarDays,
    Coins,
    ArrowUpRight,
    Sparkles,
    ArrowLeft,
    Shield,
    Compass
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface Jar {
    id: string;
    title: string;
    description?: string;
    target_amount: number;
    current_amount: number;
    deadline?: string;
    is_shared: boolean;
    color?: string;
    created_at: string;
}

interface FinanceScreenProps {
    userId: string;
    partnershipId: string | null;
    isDarkMode: boolean;
    onNavigate: (screen: string) => void;
}

export function FinanceScreen({ userId, partnershipId, isDarkMode, onNavigate }: FinanceScreenProps) {
    const [activeTab, setActiveTab] = useState<'jars' | 'distribution'>('jars');
    const [loading, setLoading] = useState(true);
    const [jars, setJars] = useState<Jar[]>([]);
    const [isAddingJar, setIsAddingJar] = useState(false);
    const [editingJar, setEditingJar] = useState<Jar | null>(null);
    const [isContributing, setIsContributing] = useState<Jar | null>(null);
    const [contributionAmount, setContributionAmount] = useState('');

    const [newJar, setNewJar] = useState({
        title: '',
        description: '',
        target_amount: '',
        deadline: '',
        is_shared: true,
        color: '#E11D48'
    });

    useEffect(() => {
        if (partnershipId) {
            loadJars();
        }
    }, [partnershipId]);

    const loadJars = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('finance_jars')
                .select('*')
                .eq('partnership_id', partnershipId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setJars(data || []);
        } catch (err) {
            console.error('Error loading jars:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateJar = async () => {
        if (!newJar.title || !newJar.target_amount) return;

        try {
            const { error } = await supabase
                .from('finance_jars')
                .insert([{
                    partnership_id: partnershipId,
                    created_by_user_id: userId,
                    title: newJar.title,
                    description: newJar.description,
                    target_amount: parseFloat(newJar.target_amount),
                    deadline: newJar.deadline || null,
                    is_shared: newJar.is_shared,
                    color: newJar.color
                }]);

            if (error) throw error;

            setIsAddingJar(false);
            setNewJar({
                title: '',
                description: '',
                target_amount: '',
                deadline: '',
                is_shared: true,
                color: '#E11D48'
            });
            loadJars();
        } catch (err) {
            console.error('Error creating jar:', err);
        }
    };

    const handleEditJar = async () => {
        if (!editingJar || !editingJar.title || !editingJar.target_amount) return;
        try {
            const { error } = await supabase
                .from('finance_jars')
                .update({
                    title: editingJar.title,
                    description: editingJar.description,
                    target_amount: editingJar.target_amount,
                    deadline: editingJar.deadline || null,
                    is_shared: editingJar.is_shared,
                    color: editingJar.color
                })
                .eq('id', editingJar.id);
            if (error) throw error;
            setEditingJar(null);
            loadJars();
        } catch (err) {
            console.error('Error updating jar:', err);
        }
    };

    const handleContribute = async (amount: number) => {
        if (!isContributing) return;
        try {
            const { error: contribError } = await supabase
                .from('jar_contributions')
                .insert([{
                    jar_id: isContributing.id,
                    user_id: userId,
                    amount: amount
                }]);
            if (contribError) throw contribError;

            const { error: updateError } = await supabase
                .from('finance_jars')
                .update({ current_amount: isContributing.current_amount + amount })
                .eq('id', isContributing.id);
            if (updateError) throw updateError;

            setIsContributing(null);
            setContributionAmount('');
            loadJars();
        } catch (err) {
            console.error('Error contributing to jar:', err);
        }
    };

    const handleDeleteJar = async (id: string, title: string) => {
        if (title === 'حصالة المغامرات') {
            alert('لا يمكن حذف حصالة المغامرات لأنها مرتبطة بنظام المغامرات الأساسي.');
            return;
        }
        if (!confirm('هل أنت متأكد من رغبتك في حذف هذا الصندوق؟ لا يمكن التراجع عن هذه الخطوة.')) return;
        try {
            const { error } = await supabase.from('finance_jars').delete().eq('id', id);
            if (error) throw error;
            loadJars();
        } catch (err) {
            console.error('Error deleting jar:', err);
        }
    };

    const totalSavings = jars.reduce((acc, jar) => acc + (jar.current_amount || 0), 0);

    return (
        <div className="flex-1 bg-background flex flex-col relative h-full overflow-hidden mood-finance">
            {/* Prosperity Background Accents */}
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute top-[-20%] right-[-10%] w-[100%] h-[70%] bg-teal-500/10 blur-[180px] rounded-full opacity-60" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[80%] h-[50%] bg-amber-500/10 blur-[120px] rounded-full opacity-40" />
            </div>

            <header className="px-8 pt-10 pb-6 flex flex-col sticky top-0 bg-background/40 backdrop-blur-3xl z-40">
                <div className="flex items-center justify-between mb-6">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onNavigate('home')}
                        className="w-11 h-11 flex items-center justify-center glass rounded-2xl border-white/60 shadow-xl text-foreground/40"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </motion.button>
                    <div className="text-center">
                        <h1 className="text-lg font-black text-foreground tracking-tighter">مرفأ الرخاء</h1>
                        <p className="text-[8px] font-black text-teal-600/40 uppercase tracking-[0.5em]">نماء مشترك لمستقبل واعد</p>
                    </div>
                    <div className="w-11 h-11 flex items-center justify-center glass rounded-2xl border-white/60 text-amber-500 shadow-xl">
                        <Shield className="w-5 h-5" />
                    </div>
                </div>

                <div className="flex gap-4 px-2">
                    <button
                        onClick={() => setActiveTab('jars')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-[10px] font-black transition-all duration-500 uppercase tracking-widest ${activeTab === 'jars'
                            ? 'bg-teal-600 text-white shadow-xl shadow-teal-500/20'
                            : 'bg-white/40 text-teal-700/30'
                            }`}
                    >
                        <PiggyBank className="w-3.5 h-3.5" />
                        صناديق الادخار
                    </button>
                    <button
                        onClick={() => setActiveTab('distribution')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-[10px] font-black transition-all duration-500 uppercase tracking-widest ${activeTab === 'distribution'
                            ? 'bg-teal-600 text-white shadow-xl shadow-teal-500/20'
                            : 'bg-white/40 text-teal-700/30'
                            }`}
                    >
                        <Wallet className="w-3.5 h-3.5" />
                        توزيع الميزانية
                    </button>
                </div>
            </header>

            <div className="flex-1 px-8 overflow-y-auto pb-40 scrollbar-hide">
                <AnimatePresence mode="wait">
                    {activeTab === 'jars' ? (
                        <motion.div
                            key="jars"
                            initial={{ opacity: 0, scale: 0.95, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 30 }}
                            className="space-y-12"
                        >
                            <motion.div
                                className="p-8 rounded-[2.5rem] bg-slate-900 relative overflow-hidden group shadow-[0_40px_100px_rgba(0,0,0,0.2)]"
                            >
                                <div className="relative z-10 text-right">
                                    <div className="flex items-center justify-end gap-2.5 mb-3 opacity-70">
                                        <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                                        <p className="text-[8px] font-black uppercase tracking-[0.3em] text-amber-500/60">إجمالي المدخرات الصافية</p>
                                    </div>
                                    <div className="flex items-baseline justify-end gap-3">
                                        <span className="text-2xl font-black text-white/20">د.أ</span>
                                        <span className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-amber-200 drop-shadow-2xl">
                                            {totalSavings.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="mt-8 flex justify-end">
                                        <div className="px-5 py-3 glass border-white/5 text-white/80 rounded-2xl inline-flex items-center gap-3 bg-white/5">
                                            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">نمو ائتماني متصاعد</span>
                                        </div>
                                    </div>
                                </div>
                                <Coins className="absolute -left-16 -bottom-16 w-80 h-80 text-white/10 -rotate-12 group-hover:rotate-0 transition-all duration-[3s]" />
                                <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_70%)]" />
                            </motion.div>

                            <div className="space-y-10">
                                <div className="flex items-center justify-between px-3" dir="rtl">
                                    <div className="flex flex-col gap-0.5">
                                        <h3 className="font-black text-xl tracking-tighter text-foreground">الخزائن النشطة</h3>
                                        <span className="text-[8px] font-black text-teal-600/40 uppercase tracking-[0.4em]">{jars.length} أهداف قيد التنفيذ</span>
                                    </div>
                                    <motion.button
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setIsAddingJar(true)}
                                        className="w-12 h-12 bg-teal-600 text-white rounded-xl flex items-center justify-center shadow-2xl shadow-teal-500/20 group border-t border-white/20"
                                    >
                                        <Plus className="w-5 h-5 rotate-0 group-hover:rotate-90 transition-transform duration-700" />
                                    </motion.button>
                                </div>

                                {loading ? (
                                    <div className="py-24 flex flex-col items-center gap-6 opacity-40">
                                        <div className="w-12 h-12 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
                                        <span className="text-[10px] font-black text-primary uppercase tracking-widest animate-pulse">جاري جرد الخزائن</span>
                                    </div>
                                ) : jars.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-24 px-10 text-center glass border-white/20 rounded-[3.5rem] relative overflow-hidden">
                                        <div className="w-24 h-24 bg-primary/5 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner border border-white/5">
                                            <PiggyBank className="w-12 h-12 text-primary/40" />
                                        </div>
                                        <h4 className="font-black text-xl mb-3">الخزينة تنتظر بصمتكن</h4>
                                        <p className="text-[11px] font-bold text-muted-foreground/50 mb-10 max-w-[240px] leading-relaxed uppercase tracking-widest">ابدأوا بتحديد أول هدف مالي لبناء مستقبلكم المشترك خطوة بخطوة</p>
                                        <button
                                            onClick={() => setIsAddingJar(true)}
                                            className="px-10 py-5 bg-primary text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/30 flex items-center gap-3 transition-transform hover:scale-105"
                                        >
                                            <Plus className="w-4 h-4" />
                                            تأسيس صندوق جديد
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-8">
                                        {jars.map((jar, idx) => (
                                            <motion.div
                                                key={jar.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.1 }}
                                                className="p-5 glass border-white/10 rounded-[2rem] relative overflow-hidden group hover:shadow-2xl transition-all duration-500"
                                                dir="rtl"
                                            >
                                                <div className="flex justify-between items-start mb-8">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-14 h-14 rounded-2xl glass-dark border-white/10 flex items-center justify-center ${jar.title === 'حصالة المغامرات' ? 'text-amber-500' : 'text-primary'} group-hover:scale-110 transition-transform`}>
                                                            {jar.title === 'حصالة المغامرات' ? <Compass className="w-6 h-6" /> : <Target className="w-6 h-6" />}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-black text-lg tracking-tight mb-1">{jar.title}</h4>
                                                            <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">{jar.description || 'مشروع نماء مشترك'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <div className={`px-4 py-2 rounded-2xl text-[10px] font-black border tracking-widest ${Math.round((jar.current_amount / jar.target_amount) * 100) >= 100 ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-primary/5 border-primary/10 text-primary'}`}>
                                                            {Math.min(100, Math.round((jar.current_amount / jar.target_amount) * 100))}%
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-4 mb-8">
                                                    <div className="flex justify-between px-1">
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-xl font-black tracking-tighter">{jar.current_amount.toLocaleString()}</span>
                                                            <span className="text-[9px] font-black opacity-30">د.أ</span>
                                                        </div>
                                                        <div className="flex items-baseline gap-1.5 opacity-40">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">الهدف:</span>
                                                            <span className="text-sm font-black tracking-tighter">{jar.target_amount.toLocaleString()}</span>
                                                            <span className="text-[9px] font-black text-muted-foreground/50 uppercase">د.أ</span>
                                                        </div>
                                                    </div>
                                                    <div className="h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/10">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${Math.min(100, (jar.current_amount / jar.target_amount) * 100)}%` }}
                                                            transition={{ duration: 1.5, ease: "circOut" }}
                                                            className={`h-full rounded-full ${Math.round((jar.current_amount / jar.target_amount) * 100) >= 100 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.3)]'}`}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <button
                                                        onClick={() => setIsContributing(jar)}
                                                        className="flex-1 py-3.5 glass border-white/10 text-foreground text-[10px] font-black rounded-xl hover:bg-teal-600 hover:text-white hover:border-teal-500 transition-all duration-500 flex items-center justify-center gap-2 group/btn uppercase tracking-widest"
                                                    >
                                                        <PlusCircle className="w-3.5 h-3.5" />
                                                        تغذية الصندوق
                                                    </button>
                                                    {jar.title !== 'حصالة المغامرات' && (
                                                        <div className="flex gap-2">
                                                            {jar.title !== 'حصالة المغامرات' && (
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => setEditingJar(jar)}
                                                                        className="w-12 h-12 flex items-center justify-center glass border-primary/20 text-primary rounded-xl hover:bg-primary hover:text-white transition-all shadow-sm"
                                                                    >
                                                                        <TrendingUp className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteJar(jar.id, jar.title)}
                                                                        className="w-12 h-12 flex items-center justify-center glass border-rose-500/20 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="distribution"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <SalaryDistributionView
                                userId={userId}
                                partnershipId={partnershipId}
                                isDarkMode={isDarkMode}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {isAddingJar && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsAddingJar(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ scale: 0.9, y: 30 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 30 }}
                            className="w-full max-w-md glass border-white/30 p-10 rounded-[3rem] relative z-10"
                            dir="rtl"
                        >
                            <div className="flex justify-between items-center mb-10">
                                <h3 className="text-2xl font-black tracking-tighter">تأسيس هدف مالي</h3>
                                <button onClick={() => setIsAddingJar(false)} className="w-12 h-12 flex items-center justify-center glass border-white/20 rounded-2xl hover:bg-rose-500/10 hover:text-rose-500 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-muted-foreground/40 mr-2 uppercase tracking-[0.2em]">مسمى الطموح</label>
                                    <input
                                        type="text"
                                        placeholder="مثلاً: رحلة العمر..."
                                        className="w-full h-14 px-5 glass border-white/10 rounded-xl text-base font-black focus:border-teal-500 transition-all"
                                        value={newJar.title}
                                        onChange={(e) => setNewJar({ ...newJar, title: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-muted-foreground/40 mr-2 uppercase tracking-[0.2em]">سقف الادخار (د.أ)</label>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        className="w-full h-14 px-5 glass border-white/10 rounded-xl text-2xl font-black focus:border-teal-500 transition-all text-amber-500"
                                        value={newJar.target_amount}
                                        onChange={(e) => setNewJar({ ...newJar, target_amount: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-muted-foreground/40 mr-2 uppercase tracking-[0.2em]">المدى الزمني</label>
                                    <input
                                        type="date"
                                        className="w-full h-14 px-5 glass border-white/10 rounded-xl text-xs font-black focus:border-teal-500 transition-all font-sans"
                                        value={newJar.deadline}
                                        onChange={(e) => setNewJar({ ...newJar, deadline: e.target.value })}
                                    />
                                </div>

                                <button
                                    onClick={handleCreateJar}
                                    disabled={!newJar.title || !newJar.target_amount}
                                    className="w-full h-16 bg-teal-600 text-white rounded-2xl font-black text-base mt-2 shadow-2xl shadow-teal-500/20 transition-all disabled:opacity-50"
                                >
                                    تثبيت الهدف
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Jar Modal */}
            <AnimatePresence>
                {editingJar && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingJar(null)} className="absolute inset-0 bg-black/40 backdrop-blur-md" />
                        <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }} className="w-full max-w-md glass border-white/20 p-8 rounded-[2.5rem] relative z-10" dir="rtl" >
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-xl font-black tracking-tighter">تعديل الصندوق</h3>
                                <button onClick={() => setEditingJar(null)} className="w-10 h-10 flex items-center justify-center glass border-white/10 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-6">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-muted-foreground/40 mr-2 uppercase tracking-[0.2em]">المسمى الجديد</label>
                                    <input type="text" className="w-full h-14 px-5 glass border-white/10 rounded-xl text-base font-black focus:border-teal-500" value={editingJar.title} onChange={(e) => setEditingJar({ ...editingJar, title: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-muted-foreground/40 mr-2 uppercase tracking-[0.2em]">الهدف (د.أ)</label>
                                    <input type="number" className="w-full h-14 px-5 glass border-white/10 rounded-xl text-2xl font-black text-amber-500 focus:border-teal-500" value={editingJar.target_amount} onChange={(e) => setEditingJar({ ...editingJar, target_amount: parseFloat(e.target.value) })} />
                                </div>
                                <button onClick={handleEditJar} className="w-full h-16 bg-teal-600 text-white rounded-2xl font-black text-base mt-2 shadow-2xl shadow-teal-500/10">تحديث البيانات</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <JarContributionModal
                isOpen={!!isContributing}
                onClose={() => setIsContributing(null)}
                jarTitle={isContributing?.title || ''}
                onContribute={handleContribute}
            />
        </div>
    );
}

function JarContributionModal({ isOpen, onClose, jarTitle, onContribute }: { isOpen: boolean, onClose: () => void, jarTitle: string, onContribute: (amount: number) => void }) {
    const [amount, setAmount] = useState('');

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-md"
                    />
                    <motion.div
                        initial={{ scale: 0.9, y: 30 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 30 }}
                        className="w-full max-w-sm glass border-white/10 p-8 rounded-[2.5rem] relative z-10"
                        dir="rtl"
                    >
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 glass-dark border-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 text-teal-600 shadow-xl">
                                <PiggyBank className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-black tracking-tighter mb-1">{jarTitle}</h3>
                            <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">إضافة بصمة نماء جديدة</p>
                        </div>

                        <div className="space-y-6">
                            <div className="relative">
                                <input
                                    autoFocus
                                    type="number"
                                    placeholder="0.00"
                                    className="w-full h-20 glass border-white/10 rounded-2xl text-4xl font-black text-center focus:border-teal-500 transition-all text-amber-500"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                />
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-lg font-black text-foreground/20">د.أ</span>
                            </div>

                            <div className="grid grid-cols-3 gap-2.5">
                                {[10, 50, 100].map(amt => (
                                    <button
                                        key={amt}
                                        onClick={() => setAmount(amt.toString())}
                                        className="py-3.5 glass border-white/5 rounded-xl font-black text-[10px] hover:bg-teal-600 hover:text-white transition-all active:scale-95"
                                    >
                                        +{amt}
                                    </button>
                                ))}
                            </div>

                            <div className="flex gap-3 pt-1">
                                <button
                                    onClick={onClose}
                                    className="flex-1 h-14 glass border-white/10 text-foreground rounded-xl font-black text-[10px] uppercase tracking-widest"
                                >
                                    تراجع
                                </button>
                                <button
                                    onClick={() => onContribute(parseFloat(amount))}
                                    disabled={!amount}
                                    className="flex-[2] h-14 bg-teal-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-teal-500/20 transition-all disabled:opacity-30"
                                >
                                    تأكيد الإيداع
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

function SalaryDistributionView({ userId, partnershipId, isDarkMode }: { userId: string, partnershipId: string | null, isDarkMode: boolean }) {
    const [viewMode, setViewMode] = useState<'me' | 'partner'>('me');
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [partnerId, setPartnerId] = useState<string | null>(null);
    const [salary, setSalary] = useState('');
    const [items, setItems] = useState<{ id?: string, name: string, amount: number, spent: number, jarId?: string }[]>([]);
    const [newItemName, setNewItemName] = useState('');
    const [newItemAmount, setNewItemAmount] = useState('');
    const [selectedJarId, setSelectedJarId] = useState<string>('');
    const [availableJars, setAvailableJars] = useState<{ id: string, title: string }[]>([]);
    const [planId, setPlanId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [currentMonth, setCurrentMonth] = useState<string>('');

    // Expense Modal State
    const [expenseItemIndex, setExpenseItemIndex] = useState<number | null>(null);
    const [expenseAmount, setExpenseAmount] = useState('');

    useEffect(() => {
        const getPartner = async () => {
            const { data } = await supabase.from('partnerships').select('user1_id, user2_id').eq('id', partnershipId).single();
            if (data) {
                setPartnerId(data.user1_id === userId ? data.user2_id : data.user1_id);
            }
        };
        if (partnershipId) getPartner();
    }, [partnershipId, userId]);

    useEffect(() => {
        // Set current month string YYYY-MM-01
        const date = new Date();
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
        setCurrentMonth(monthStr);
    }, []);

    useEffect(() => {
        if (partnershipId && currentMonth) {
            loadJars();
            loadPlan();
        }
    }, [partnershipId, currentMonth, viewMode]);

    const loadJars = async () => {
        const { data } = await supabase
            .from('finance_jars')
            .select('id, title')
            .eq('partnership_id', partnershipId);
        if (data) setAvailableJars(data);
    };

    const loadPlan = async () => {
        try {
            setLoading(true);

            // Try to load plan for CURRENT MONTH first
            const activeUserId = viewMode === 'me' ? userId : partnerId;
            if (!activeUserId) return;

            const { data: planData, error: planError } = await supabase
                .from('salary_plans')
                .select('*')
                .eq('partnership_id', partnershipId)
                .eq('user_id', activeUserId)
                .eq('billing_period', currentMonth)
                .maybeSingle();

            if (planError) throw planError;

            if (planData) {
                setPlanId(planData.id);
                setSalary(planData.salary_amount.toString());

                const { data: itemsData, error: itemsError } = await supabase
                    .from('salary_plan_items')
                    .select('*')
                    .eq('plan_id', planData.id);

                if (itemsError) throw itemsError;

                if (itemsData) {
                    setItems(itemsData.map(item => ({
                        id: item.id,
                        name: item.category_name,
                        amount: item.allocated_amount,
                        spent: item.spent_amount || 0,
                        jarId: item.jar_id
                    })));
                }
            } else {
                // If no plan for current month, check if we should copy from last month? 
                // For now, just reset (as per user request: "Every first of month it resets")
                setPlanId(null);
                setSalary('');
                setItems([]);
            }
        } catch (err) {
            console.error('Error loading plan:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSavePlan = async () => {
        try {
            setSaving(true);
            let currentPlanId = planId;

            if (!currentPlanId) {
                const { data: newPlan, error: createError } = await supabase
                    .from('salary_plans')
                    .insert([{
                        partnership_id: partnershipId,
                        user_id: userId,
                        salary_amount: parseFloat(salary || '0'),
                        title: `خطة شهر ${new Date().toLocaleDateString('ar-JO', { month: 'long', year: 'numeric' })}`,
                        billing_period: currentMonth
                    }])
                    .select()
                    .single();

                if (createError) throw createError;
                currentPlanId = newPlan.id;
                setPlanId(newPlan.id);
            } else {
                const { error: updateError } = await supabase
                    .from('salary_plans')
                    .update({ salary_amount: parseFloat(salary || '0') })
                    .eq('id', currentPlanId);

                if (updateError) throw updateError;
            }

            // Sync items strategy: Delete all and re-insert is easiest but loses ID tracking if not careful.
            // Since we added 'spent', we need to be careful. 
            // Actually, deleting and re-inserting is fine as long as we preserve the data from 'items' state.

            const { error: deleteError } = await supabase
                .from('salary_plan_items')
                .delete()
                .eq('plan_id', currentPlanId);

            if (deleteError) throw deleteError;

            if (items.length > 0) {
                const { error: insertError } = await supabase
                    .from('salary_plan_items')
                    .insert(items.map(item => ({
                        plan_id: currentPlanId,
                        category_name: item.name,
                        allocated_amount: item.amount,
                        spent_amount: item.spent,
                        jar_id: item.jarId || null
                    })));

                if (insertError) throw insertError;
            }

            loadPlan(); // Reload to get stable IDs
        } catch (err) {
            console.error('Error saving plan:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleAddExpense = async () => {
        if (expenseItemIndex === null || !expenseAmount) return;

        const newItems = [...items];
        const amountToAdd = parseFloat(expenseAmount);

        if (isNaN(amountToAdd)) return;

        newItems[expenseItemIndex].spent = (newItems[expenseItemIndex].spent || 0) + amountToAdd;
        setItems(newItems);

        // Auto-save the specific item expense could be better optimization, but full save is safer for consistency
        // triggered via effect or manually? User asked for persistence.
        // We'll call save immediately after expense add.

        setExpenseItemIndex(null);
        setExpenseAmount('');

        // Optimistic update done, now trigger save
        // We need to wait for state update in a real app, but here we can just call save with new items if we refactor handleSavePlan to take args.
        // For simplicity, we just leverage the fact that we updated state, but handleSavePlan uses state. 
        // We need to wait for render cycle? No, let's just push to DB manually here to be safe and responsive.

        // Actually, handleSavePlan uses 'items' state. If we call it immediately, it might use old state.
        // Let's defer save or just update the UI and let the user click save?
        // User complains about "refresh" losing data. So we should auto-Save.
    };

    // Auto-save effect for expenses? 
    // Let's specific helper for expense saving to be robust
    const saveItemsOnly = async (updatedItems: typeof items) => {
        if (!planId) return;
        // ... simplified save logic for just items if needed, but complete save is easier to maintain.
    };

    const addItem = () => {
        if (!newItemName || !newItemAmount) return;
        setItems([...items, {
            name: newItemName,
            amount: parseFloat(newItemAmount),
            spent: 0,
            jarId: selectedJarId || undefined
        }]);
        setNewItemName('');
        setNewItemAmount('');
        setSelectedJarId('');
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const totalAllocated = items.reduce((acc, item) => acc + item.amount, 0);
    const totalSpent = items.reduce((acc, item) => acc + (item.spent || 0), 0);
    const salaryNum = parseFloat(salary || '0');
    // Remaining to allocate
    const unallocated = Math.max(0, salaryNum - totalAllocated);

    // Remaining in pocket (Real money left)
    const remainingPocket = Math.max(0, salaryNum - totalSpent);

    const isOverSpent = totalAllocated > salaryNum && salaryNum > 0;
    const isReadOnly = viewMode === 'partner';

    const chartData = [
        ...items.map(item => ({ name: item.name, value: item.amount })),
        ...(unallocated > 0 ? [{ name: 'غير موزع', value: unallocated }] : [])
    ];

    const COLORS = [
        '#14b8a6', // Teal
        '#f59e0b', // Amber
        '#6366f1', // Indigo
        '#ec4899', // Pink
        '#8b5cf6', // Violet
        '#0ea5e9', // Sky Blue
        '#f43f5e', // Rose
        '#10b981', // Emerald
        '#f97316', // Orange
        '#06b6d4', // Cyan
        '#d946ef', // Fuchsia
        '#84cc16'  // Lime
    ];

    if (loading) {
        return (
            <div className="py-20 flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-[3px] border-teal-600 border-t-transparent rounded-full animate-spin shadow-lg" />
                <span className="text-[10px] font-black text-teal-600 uppercase tracking-[0.2em] animate-pulse">جاري تحميل الخطة</span>
            </div>
        );
    }

    return (
        <div className="space-y-10 pb-12" dir="rtl">
            {/* View Switcher */}
            {/* View Switcher - Pill Style as per reference */}
            <div className="flex items-center justify-end gap-6 px-4">
                <button
                    onClick={() => setViewMode('partner')}
                    className={`text-[10px] font-black tracking-widest transition-all ${viewMode === 'partner' ? 'text-teal-600' : 'text-muted-foreground/30'}`}
                >
                    ميزانية الشريك
                </button>
                <button
                    onClick={() => setViewMode('me')}
                    className={`px-12 py-3.5 rounded-full text-xs font-black tracking-widest transition-all shadow-2xl ${viewMode === 'me' ? 'bg-teal-600 text-white shadow-teal-500/30' : 'bg-white/10 text-muted-foreground/30'}`}
                >
                    ميزانيتي
                </button>
            </div>

            <div className="flex justify-between items-center px-4">
                <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${saving ? 'bg-amber-500 animate-pulse' : 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]'}`} />
                    <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">
                        {saving ? 'جاري المزامنة...' : 'باناتك محمية'}
                    </span>
                </div>

                <button
                    id="save-plan-btn"
                    onClick={handleSavePlan}
                    disabled={saving || !salary || isReadOnly}
                    className={`flex items-center gap-2.5 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${isReadOnly ? 'bg-muted-foreground/5 text-muted-foreground/20' : 'bg-teal-500/10 text-teal-600 hover:bg-teal-600 hover:text-white shadow-teal-500/5'}`}
                >
                    <CheckCircle2 className="w-4 h-4" />
                    {isReadOnly ? 'عرض فقط' : 'حفظ الترتيب'}
                </button>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-10 rounded-[3.5rem] bg-[#0A1425] relative overflow-hidden group shadow-[0_50px_100px_rgba(0,0,0,0.4)] border border-white/5"
            >
                <div className="relative z-10">
                    <div className="flex items-center justify-end gap-3 mb-6 opacity-80">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">إجمالي الميزانية (د.أ)</p>
                        <Wallet className="w-4 h-4 text-amber-500" />
                    </div>

                    <div className="flex items-center justify-between">
                        {/* Interactive Controls (Left) */}
                        <div className="flex items-center gap-6">
                            <div className="flex flex-col gap-1.5">
                                <button
                                    onClick={() => !isReadOnly && setSalary(prev => (Math.min(20000, Number(prev) + 50)).toString())}
                                    className="p-2.5 rounded-xl bg-white/5 hover:bg-amber-500/20 active:scale-95 transition-all group/up border border-white/5 hover:border-amber-500/30"
                                >
                                    <ChevronRight className="w-5 h-5 -rotate-90 text-white/30 group-hover/up:text-amber-500 transition-colors" />
                                </button>
                                <button
                                    onClick={() => !isReadOnly && setSalary(prev => (Math.max(0, Number(prev) - 50)).toString())}
                                    className="p-2.5 rounded-xl bg-white/5 hover:bg-amber-500/20 active:scale-95 transition-all group/down border border-white/5 hover:border-amber-500/30"
                                >
                                    <ChevronRight className="w-5 h-5 rotate-90 text-white/30 group-hover/down:text-amber-500 transition-colors" />
                                </button>
                            </div>

                            {!isReadOnly && (
                                <div className="hidden sm:flex flex-col gap-2">
                                    <input
                                        type="range"
                                        min="0"
                                        max="5000"
                                        step="50"
                                        value={salary || 0}
                                        onChange={(e) => setSalary(e.target.value)}
                                        className="w-32 accent-amber-500 cursor-pointer opacity-20 hover:opacity-100 transition-opacity"
                                    />
                                    <span className="text-[7px] font-black text-white/10 text-center uppercase tracking-widest">تعديل سريع</span>
                                </div>
                            )}
                        </div>

                        {/* Value Display (Right) */}
                        <div className="relative flex-1 flex justify-end">
                            <input
                                type="number"
                                placeholder="0.00"
                                readOnly={isReadOnly}
                                className={`bg-transparent border-none p-0 text-8xl font-black text-right focus:ring-0 placeholder:text-white/5 tracking-tighter text-white selection:bg-amber-500/30 transition-all ${isReadOnly ? 'opacity-50 pointer-events-none' : 'hover:text-amber-500/90'}`}
                                value={salary}
                                onChange={(e) => setSalary(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                {/* Background Interactive Gradient */}
                <div
                    className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),transparent_70%)] transition-opacity duration-700"
                    style={{ opacity: salaryNum > 0 ? 1 : 0.3 }}
                />
                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-teal-500/5 blur-[100px] rounded-full" />
            </motion.div>

            {(salaryNum > 0 || items.length > 0) && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="glass border-white/20 p-10 rounded-[3.5rem] relative overflow-hidden"
                >
                    <div className="flex items-center justify-between mb-8 px-2">
                        <div className="flex flex-col gap-0.5">
                            <h3 className="font-black text-xl tracking-tighter">خارطة التوزيع</h3>
                            <span className="text-[8px] font-black text-teal-500 uppercase tracking-[0.2em] opacity-60">تحليل لحظي للنفقات</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className={`text-2xl font-black tracking-tighter ${isOverSpent ? 'text-rose-500' : 'text-teal-600'}`}>
                                {salaryNum > 0 ? ((totalAllocated / salaryNum) * 100).toFixed(0) : 0}%
                            </span>
                            <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">المخصص</span>
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-12">
                        <div className="h-[280px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData.length > 0 ? chartData : [{ name: 'انتظار البيانات', value: 1 }]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={90}
                                        outerRadius={120}
                                        paddingAngle={6}
                                        dataKey="value"
                                        stroke="none"
                                        onMouseEnter={(_, index) => setActiveIndex(index)}
                                        onMouseLeave={() => setActiveIndex(null)}
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={COLORS[index % COLORS.length]}
                                                fillOpacity={activeIndex === null || activeIndex === index ? 1 : 0.4}
                                                style={{
                                                    filter: activeIndex === index ? `drop-shadow(0 0 10px ${COLORS[index % COLORS.length]}60)` : 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))',
                                                    transition: 'all 0.3s ease'
                                                }}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: '1.5rem',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            boxShadow: '0 20px 40px -10px rgb(0 0 0 / 0.2)',
                                            fontWeight: '900',
                                            background: 'rgba(255,255,255,0.95)',
                                            backdropFilter: 'blur(10px)',
                                            padding: '12px 20px',
                                            fontSize: '11px'
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeIndex ?? 'default'}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 1.1 }}
                                        className="flex flex-col items-center px-6 text-center"
                                    >
                                        <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-1">
                                            {activeIndex !== null ? chartData[activeIndex]?.name : 'المتبقي الجاهز'}
                                        </span>
                                        <div className="flex items-baseline gap-1">
                                            <span className={`text-3xl font-black tracking-tighter transition-colors duration-500 ${activeIndex !== null ? '' : (remainingPocket < 0 ? 'text-rose-500' : 'text-foreground')}`}
                                                style={{ color: activeIndex !== null ? COLORS[activeIndex % COLORS.length] : undefined }}
                                            >
                                                {(activeIndex !== null ? chartData[activeIndex]?.value : remainingPocket).toLocaleString()}
                                            </span>
                                            <span className="text-[9px] font-black opacity-30 uppercase">د.أ</span>
                                        </div>
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </div>

                        <div className="w-full grid grid-cols-2 gap-3" dir="rtl">
                            {chartData.map((item, index) => (
                                <motion.div
                                    key={index}
                                    layout
                                    onMouseEnter={() => setActiveIndex(index)}
                                    onMouseLeave={() => setActiveIndex(null)}
                                    className={`flex items-center justify-between border px-5 py-3 rounded-full shadow-sm transition-all duration-300 cursor-pointer ${activeIndex === index ? 'bg-white dark:bg-white/10 border-amber-500/30 scale-[1.02] shadow-xl' : 'bg-white/60 dark:bg-white/5 border-white/20'}`}
                                >
                                    <span className={`text-[10px] font-black min-w-[2.5rem] transition-colors ${activeIndex === index ? 'text-amber-600' : 'text-muted-foreground/30'}`}>
                                        {salaryNum > 0 ? Math.round((item.value / salaryNum) * 100) : 0}%
                                    </span>
                                    <span className="text-[11px] font-black text-foreground truncate mx-2">
                                        {item.name}
                                    </span>
                                    <div
                                        className={`w-2 h-2 rounded-full shrink-0 transition-transform duration-300 ${activeIndex === index ? 'scale-150' : ''}`}
                                        style={{
                                            backgroundColor: COLORS[index % COLORS.length],
                                            boxShadow: activeIndex === index ? `0 0 10px ${COLORS[index % COLORS.length]}` : 'none'
                                        }}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}

            <div className="space-y-8">
                <div className="flex items-center justify-between px-2">
                    <div className="flex flex-col gap-1">
                        <h3 className="font-black text-2xl tracking-tighter">بنود الميزانية</h3>
                        <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">{items.length} التزامات محددة</span>
                    </div>
                </div>

                <div className="space-y-6">
                    <AnimatePresence>
                        {items.map((item, index) => (
                            <motion.div
                                key={index}
                                layout
                                onMouseEnter={() => setActiveIndex(index)}
                                onMouseLeave={() => setActiveIndex(null)}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className={`glass border p-6 rounded-[2.5rem] flex flex-col gap-5 group transition-all duration-500 relative overflow-hidden ${activeIndex === index ? 'border-amber-500/30 shadow-2xl scale-[1.01] bg-white/5' : 'border-white/10 hover:border-white/30'}`}
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className={`w-14 h-14 rounded-2xl glass-dark border-white/5 flex items-center justify-center transition-all duration-500 group-hover:bg-teal-600/10 ${item.jarId ? 'text-amber-500' : 'text-teal-600'}`}>
                                            {item.jarId ? <Target className="w-7 h-7" /> : <Coins className="w-7 h-7" />}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-black text-lg tracking-tighter truncate">{item.name}</span>
                                            <div className="flex items-center gap-3 mt-1 text-xs">
                                                <span className="font-black text-teal-600 tracking-tight">{item.amount.toLocaleString()} د.أ</span>
                                                <div className="w-1 h-1 rounded-full bg-slate-300/30" />
                                                <span className="font-bold text-muted-foreground/30 truncate">{Math.round((item.amount / salaryNum) * 100)}% من الميزانية</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!isReadOnly && (
                                            <>
                                                <button
                                                    onClick={() => setExpenseItemIndex(index)}
                                                    className="h-10 px-5 glass border-white/10 text-teal-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-600 hover:text-white transition-all shadow-sm"
                                                >
                                                    خصم
                                                </button>
                                                <button
                                                    onClick={() => removeItem(index)}
                                                    className="w-10 h-10 flex items-center justify-center text-rose-500/30 glass border-white/5 rounded-xl hover:bg-rose-500 hover:text-white transition-all active:scale-90"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </>
                                        )}
                                        {isReadOnly && (
                                            <div className="px-5 py-3 glass border-white/5 text-muted-foreground/30 rounded-2xl text-[10px] font-black uppercase">عرض التفاصيل</div>
                                        )}
                                    </div>
                                </div>

                                <div className="w-full space-y-3">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest px-1">
                                        <div className="flex items-center gap-2 text-muted-foreground/40">
                                            <span>المنفق</span>
                                            <span className="text-foreground">{item.spent.toLocaleString()} د.أ</span>
                                        </div>
                                        <div className={`flex items-center gap-2 ${item.spent > item.amount ? "text-rose-500" : "text-teal-600"}`}>
                                            <span>المتاح</span>
                                            <span className="font-black">{(item.amount - item.spent).toLocaleString()} د.أ</span>
                                        </div>
                                    </div>
                                    <div className="h-2 w-full glass-dark border-white/5 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min((item.spent / item.amount) * 100, 100)}%` }}
                                            className={`h-full rounded-full transition-all duration-700 ${item.spent > item.amount ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]' : 'bg-teal-600 shadow-[0_0_10px_rgba(13,148,136,0.3)]'}`}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {!isReadOnly && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="bg-[#0A1425] border border-white/5 rounded-[3rem] p-10 relative overflow-hidden group/addcard shadow-2xl"
                        >
                            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.05),transparent_70%)]" />

                            <div className="relative z-10">
                                <div className="flex items-center justify-end gap-3 mb-8 opacity-60">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-500">إضافة بند جديد</p>
                                    <Plus className="w-4 h-4 text-teal-500" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-muted-foreground/30 mr-2 uppercase tracking-widest">مسمى الالتزام</label>
                                        <input
                                            type="text"
                                            placeholder="الإيجار، التعليم، التسوق..."
                                            className="h-14 w-full px-6 bg-white/5 border border-white/5 rounded-2xl text-[13px] font-black text-white focus:border-teal-500/50 transition-all placeholder:text-white/10"
                                            value={newItemName}
                                            onChange={(e) => setNewItemName(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-muted-foreground/30 mr-2 uppercase tracking-widest">القيمة المقدرة (د.أ)</label>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            className="h-14 w-full px-6 bg-white/5 border border-white/5 rounded-2xl text-xl font-black text-teal-500 focus:border-teal-500/50 transition-all placeholder:text-white/10"
                                            value={newItemAmount}
                                            onChange={(e) => setNewItemAmount(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 mb-10">
                                    <label className="text-[9px] font-black text-muted-foreground/30 mr-2 flex items-center gap-2 uppercase tracking-widest">
                                        <Target className="w-3 h-3 text-amber-500" />
                                        المصدر المالي (اختياري)
                                    </label>
                                    <div className="relative">
                                        <select
                                            className="w-full h-14 px-6 bg-white/5 border border-white/5 rounded-2xl text-[11px] font-black text-white/60 appearance-none cursor-pointer focus:border-teal-500/50 transition-all"
                                            value={selectedJarId}
                                            onChange={(e) => setSelectedJarId(e.target.value)}
                                        >
                                            <option value="" className="bg-slate-900">مصروف جاري مباشر</option>
                                            {availableJars.map(jar => (
                                                <option key={jar.id} value={jar.id} className="bg-slate-900">{jar.title}</option>
                                            ))}
                                        </select>
                                        <ChevronRight className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20 rotate-90 pointer-events-none" />
                                    </div>
                                </div>

                                <button
                                    onClick={addItem}
                                    disabled={!newItemName || !newItemAmount}
                                    className="w-full h-16 bg-teal-600 text-white rounded-[1.5rem] font-black text-base transition-all disabled:opacity-20 flex items-center justify-center gap-4 shadow-xl hover:bg-teal-500 shadow-teal-500/10"
                                >
                                    <Plus className="w-5 h-5" />
                                    تثبيت في خارطة الراتب
                                </button>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {expenseItemIndex !== null && items[expenseItemIndex] && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setExpenseItemIndex(null)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ scale: 0.9, y: 30 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 30 }}
                            className="glass border-white/20 w-full max-w-sm rounded-[2.5rem] p-8 relative z-10"
                            dir="rtl"
                        >
                            <h3 className="font-black text-xl tracking-tighter mb-1">تسجيل نفقة</h3>
                            <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest mb-8">
                                يتم الخصم من بند: <span className="text-teal-600">{items[expenseItemIndex].name}</span>
                            </p>

                            <div className="space-y-6">
                                <div className="relative">
                                    <input
                                        autoFocus
                                        type="number"
                                        placeholder="0.00"
                                        className="w-full h-20 glass border-white/10 rounded-2xl text-center text-4xl font-black focus:border-teal-500 transition-all text-amber-500"
                                        value={expenseAmount}
                                        onChange={(e) => setExpenseAmount(e.target.value)}
                                    />
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-lg font-black text-foreground/20">د.أ</span>
                                </div>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setExpenseItemIndex(null)}
                                        className="flex-1 h-14 glass border-white/10 text-foreground rounded-xl font-black text-[10px] uppercase tracking-widest"
                                    >
                                        تراجع
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleAddExpense();
                                            setTimeout(() => {
                                                const btn = document.getElementById('save-plan-btn');
                                                if (btn) btn.click();
                                            }, 100);
                                        }}
                                        className="flex-[2] h-14 bg-teal-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-teal-500/20 transition-all"
                                    >
                                        تأكيد الخصم
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
