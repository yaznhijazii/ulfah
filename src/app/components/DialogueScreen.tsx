import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, MessageCircle, ShieldCheck, Plus, Sparkles, Trash2, AlertCircle, AlertTriangle, Target, Flame, Heart, XCircle, CheckCircle2, User, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface DialogueScreenProps {
    onBack: () => void;
    userId: string;
    partnershipId: string | null;
    isDarkMode?: boolean;
}

type Tab = 'constitution' | 'commitments';

export function DialogueScreen({ onBack, userId, partnershipId, isDarkMode }: DialogueScreenProps) {
    const [activeTab, setActiveTab] = useState<Tab>('constitution');

    // UI States
    const [showAddDialogue, setShowAddDialogue] = useState(false);
    const [showAddCommitment, setShowAddCommitment] = useState(false);
    const [loading, setLoading] = useState(true);
    const [names, setNames] = useState<{ me: string, partner: string }>({ me: 'أنا', partner: 'الشريك' });
    const [partnerId, setPartnerId] = useState<string | null>(null);
    const [selectedDialogue, setSelectedDialogue] = useState<any>(null);

    // Data States
    const [dialogues, setDialogues] = useState<any[]>([]);
    const [agreements, setAgreements] = useState<any[]>([]);
    const [commitments, setCommitments] = useState<any[]>([]);

    // Helper: Is current user the one who should NOT do the task?
    const isObserver = (assigneeId: string) => assigneeId !== userId;

    // Forms
    const [dialogueStep, setDialogueStep] = useState(1);
    const [dialogueForm, setDialogueForm] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        problem: '',
        my_opinion: '',
        partner_opinion: '',
        solution: '',
        assignee: 'both' as 'me' | 'partner' | 'both'
    });

    const [commitmentForm, setCommitmentForm] = useState({
        title: '',
        target_count: 5,
        period_type: 'weekly',
        punishment: '',
        assignee: 'me' as 'me' | 'partner'
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{ show: boolean, type: 'breach' | 'delete_agreement' | 'delete_dialogue' | 'delete_commitment' | 'fail_commitment', data: any } | null>(null);

    useEffect(() => {
        if (partnershipId) {
            loadData();
            loadNames();
        }
    }, [partnershipId, activeTab]);

    const loadNames = async () => {
        if (!partnershipId || !userId) return;
        try {
            const { data: p } = await supabase
                .from('partnerships')
                .select('user1_id, user2_id, user1_details:user1_id(name), user2_details:user2_id(name)')
                .eq('id', partnershipId)
                .single();

            if (p) {
                const isUser1 = p.user1_id === userId;
                setPartnerId(isUser1 ? p.user2_id : p.user1_id);
                const user1Name = Array.isArray(p.user1_details) ? p.user1_details[0]?.name : (p.user1_details as any)?.name;
                const user2Name = Array.isArray(p.user2_details) ? p.user2_details[0]?.name : (p.user2_details as any)?.name;
                setNames({ me: isUser1 ? user1Name : user2Name || 'أنا', partner: isUser1 ? user2Name : user1Name || 'الشريك' });
            }
        } catch (err) { console.error(err); }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [dRes, aRes, cRes] = await Promise.all([
                supabase.from('dialogues').select('*').eq('partnership_id', partnershipId).order('dialogue_date', { ascending: false }),
                supabase.from('agreements').select('*').eq('partnership_id', partnershipId).order('created_at', { ascending: false }),
                supabase.from('commitments').select('*').eq('partnership_id', partnershipId).order('created_at', { ascending: false })
            ]);

            if (dRes.data) setDialogues(dRes.data);
            if (aRes.data) setAgreements(aRes.data);
            if (cRes.data) setCommitments(cRes.data);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const handleSaveDialogue = async () => {
        if (!dialogueForm.title || !dialogueForm.solution) {
            alert('يرجى إكمال العنوان والحل');
            return;
        }
        setIsSubmitting(true);
        try {
            // 1. Save the dialogue
            const { data: dialogue, error: dError } = await supabase.from('dialogues').insert({
                partnership_id: partnershipId,
                title: dialogueForm.title,
                dialogue_date: dialogueForm.date,
                description: dialogueForm.problem,
                problem: dialogueForm.problem,
                my_opinion: dialogueForm.my_opinion,
                partner_opinion: dialogueForm.partner_opinion,
                final_agreement: dialogueForm.solution,
                created_by_user_id: userId
            }).select().single();

            if (dError) {
                console.error('Dialogue Insert Error:', dError);
                // Fallback: try inserting without created_by_user_id if column is missing
                const { data: dFallback, error: dError2 } = await supabase.from('dialogues').insert({
                    partnership_id: partnershipId,
                    title: dialogueForm.title,
                    dialogue_date: dialogueForm.date,
                    problem: dialogueForm.problem,
                    my_opinion: dialogueForm.my_opinion,
                    partner_opinion: dialogueForm.partner_opinion,
                    final_agreement: dialogueForm.solution
                }).select().single();

                if (dError2) throw dError2;
                if (dFallback) {
                    await createLinkedAgreement(dFallback);
                }
            } else if (dialogue) {
                await createLinkedAgreement(dialogue);
            }
        } catch (err: any) {
            console.error(err);
            alert('حدث خطأ أثناء الحفظ: ' + (err.message || 'مشكلة في الاتصال بقاعدة البيانات'));
        }
        setIsSubmitting(false);
    };

    const createLinkedAgreement = async (dialogue: any) => {
        const { error: aError } = await supabase.from('agreements').insert({
            partnership_id: partnershipId,
            title: dialogue.final_agreement,
            assignee: dialogueForm.assignee,
            duration: 'open',
            created_by_user_id: userId,
            origin_dialogue_id: dialogue.id
        });

        if (aError) {
            console.warn('Agreement Insert Error (linking failed, trying fallback):', aError);
            // Try without origin_dialogue_id and created_by if linking fails due to missing columns
            await supabase.from('agreements').insert({
                partnership_id: partnershipId,
                title: dialogue.final_agreement,
                assignee: dialogueForm.assignee,
                duration: 'open'
            });
        }

        setShowAddDialogue(false);
        setDialogueForm({ title: '', date: new Date().toISOString().split('T')[0], problem: '', my_opinion: '', partner_opinion: '', solution: '', assignee: 'both' });
        setDialogueStep(1);
        loadData();
    };

    const handleSaveCommitment = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const commitmentData: any = {
                partnership_id: partnershipId,
                owner_user_id: commitmentForm.assignee === 'me' ? userId : partnerId,
                title: commitmentForm.title,
                target_count: commitmentForm.target_count,
                period_type: commitmentForm.period_type,
                punishment: commitmentForm.punishment,
                current_count: 0,
                status: 'on-track',
                is_active: true,
                start_date: new Date().toISOString()
            };

            // محاولة أولى مع created_by_user_id
            const { error: firstTryError } = await supabase.from('commitments').insert({
                ...commitmentData,
                created_by_user_id: userId
            });

            if (firstTryError) {
                console.warn('First try failed, trying without created_by_user_id');
                // محاولة ثانية بدون العمود إذا طلع مش موجود
                const { error: secondTryError } = await supabase.from('commitments').insert(commitmentData);

                if (secondTryError) throw secondTryError;
            }

            setShowAddCommitment(false);
            setCommitmentForm({ title: '', target_count: 5, period_type: 'weekly', punishment: '', assignee: 'me' });
            loadData();

        } catch (err: any) {
            console.error(err);
            alert('خطأ في حفظ الالتزام: ' + (err.message || 'مشكلة في قاعدة البيانات'));
        }
        setIsSubmitting(false);
    };

    const handleBreach = async (agreement: any) => {
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('agreements').update({
                breach_count: (agreement.breach_count || 0) + 1,
                last_breach_at: new Date().toISOString()
            }).eq('id', agreement.id);
            if (!error) {
                setConfirmModal(null);
                loadData();
            }
        } catch (err) { console.error(err); }
        setIsSubmitting(false);
    };

    const handleCommitmentFail = async (commitment: any) => {
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('commitments').update({
                status: 'failed'
            }).eq('id', commitment.id);
            if (!error) {
                setConfirmModal(null);
                loadData();
            }
        } catch (err) { console.error(err); }
        setIsSubmitting(false);
    };

    const handleMarkProgress = async (id: string, current: number, target: number) => {
        if (current >= target) return;
        try {
            const newCount = current + 1;
            const status = newCount >= target ? 'completed' : 'on-track';
            await supabase.from('commitments').update({ current_count: newCount, status }).eq('id', id);
            loadData();
        } catch (err) { console.error(err); }
    };

    const handleDeleteDialogue = async (dialogue: any) => {
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('dialogues').delete().eq('id', dialogue.id);
            if (!error) {
                setConfirmModal(null);
                loadData();
            }
        } catch (err) { console.error(err); }
        setIsSubmitting(false);
    };

    const handleDeleteAgreement = async (agreement: any) => {
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('agreements').delete().eq('id', agreement.id);
            if (!error) {
                setConfirmModal(null);
                loadData();
            }
        } catch (err) { console.error(err); }
        setIsSubmitting(false);
    };

    const handleDeleteCommitment = async (commitment: any) => {
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('commitments').delete().eq('id', commitment.id);
            if (!error) {
                setConfirmModal(null);
                loadData();
            }
        } catch (err) { console.error(err); }
        setIsSubmitting(false);
    };

    // Helper for multi-step form
    const nextStep = () => setDialogueStep(prev => Math.min(prev + 1, 5));
    const prevStep = () => setDialogueStep(prev => Math.max(prev - 1, 1));

    return (
        <div className="flex-1 bg-background flex flex-col relative h-screen mood-dialogue">
            {/* Pact Atmospheric Blue Aura */}
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute top-[-10%] right-[-10%] w-[100%] h-[60%] bg-blue-500/10 blur-[150px] rounded-full opacity-60" />
            </div>

            {/* Header */}
            <header className="px-8 pt-12 pb-8 sticky top-0 bg-background/40 backdrop-blur-3xl z-40">
                <div className="flex items-center justify-between mb-8">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={onBack}
                        className="w-12 h-12 flex items-center justify-center glass rounded-2xl border-white/60 shadow-xl text-foreground/40"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </motion.button>
                    <div className="text-center">
                        <h1 className="text-xl font-black text-foreground tracking-tighter">ميثاق المودة</h1>
                        <p className="text-[9px] font-black text-blue-600/40 uppercase tracking-[0.5em]">حواراتنا.. ومحطات اتفاقنا</p>
                    </div>
                    <div className="w-12 h-12 glass-dark border-blue-500/20 rounded-2xl flex items-center justify-center text-blue-500 shadow-xl shadow-blue-500/5">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                </div>

                <div className="flex glass rounded-[2.8rem] border-white/80 p-1.5 shadow-2xl bg-white/40 ring-1 ring-black/[0.03] max-w-[320px] mx-auto relative overflow-hidden">
                    {[
                        { id: 'constitution', label: 'جلسات الحوار', icon: MessageCircle },
                        { id: 'commitments', label: 'التزاماتنا', icon: Target }
                    ].map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-[2.2rem] transition-all duration-700 relative z-10 ${isActive ? 'text-white' : 'text-blue-800/30 hover:text-blue-500'}`}
                            >
                                {isActive && <motion.div layoutId="pact-tab-pill" className="absolute inset-0 bg-blue-600 rounded-[2.2rem] shadow-2xl shadow-blue-500/20 z-[-1]" />}
                                <tab.icon className={`w-4 h-4 transition-transform ${isActive ? 'rotate-12' : ''}`} />
                                <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </header>

            <div className="flex-1 px-4 py-8 overflow-y-auto pb-32 scrollbar-hide">
                {activeTab === 'constitution' ? (
                    <div className="space-y-12">
                        {/* New Dialogue Trigger */}
                        <motion.button
                            whileHover={{ y: -4 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowAddDialogue(true)}
                            className="w-full relative overflow-hidden rounded-[3rem] p-1 group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 via-blue-500/5 to-transparent blur-2xl opacity-50 group-hover:opacity-100 transition-opacity" />
                            <div className="relative glass border-white/20 py-10 px-8 rounded-[2.8rem] flex flex-col items-center justify-center gap-5 shadow-2xl">
                                <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/5 group-hover:rotate-6 transition-transform">
                                    <MessageCircle className="w-8 h-8 text-blue-500" />
                                </div>
                                <div className="text-center space-y-1">
                                    <span className="text-xl font-black text-foreground tracking-tighter block">تأسيس جلسة حوار</span>
                                    <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] max-w-[200px]">نتحاور بوعي.. لنرتقي بالعهد الذي بيننا</p>
                                </div>
                            </div>
                        </motion.button>

                        <div className="grid grid-cols-2 gap-5 px-2">
                            {dialogues.length === 0 && !loading && (
                                <div className="col-span-2 py-24 text-center space-y-6 opacity-20">
                                    <div className="w-24 h-24 glass border-white/10 rounded-[3rem] flex items-center justify-center mx-auto">
                                        <MessageCircle className="w-12 h-12" />
                                    </div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] leading-relaxed">لم يتم تدوين أي جلسة حوار بعد..</p>
                                </div>
                            )}

                            {dialogues.map((d, i) => (
                                <motion.div
                                    key={d.id}
                                    layoutId={`dialogue-card-${d.id}`}
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    onClick={() => setSelectedDialogue(d)}
                                    className="aspect-square glass border-white/10 rounded-[2.5rem] p-5 relative overflow-hidden group cursor-pointer hover:shadow-2xl transition-all duration-500 shadow-sm active:scale-95 flex flex-col justify-between"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="w-11 h-11 glass-dark border-white/10 rounded-2xl flex items-center justify-center text-blue-500 shadow-inner">
                                            <MessageCircle className="w-5 h-5" />
                                        </div>
                                        <div className="px-3 py-1.5 glass-dark border-white/5 rounded-xl">
                                            <span className="text-[9px] font-black text-foreground/40 uppercase tracking-widest">{d.dialogue_date?.slice(5)}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-right">
                                        <h3 className="font-black text-lg leading-tight line-clamp-2 tracking-tight opacity-90">{d.title}</h3>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1 h-1 rounded-full bg-blue-500" />
                                            <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest line-clamp-1">
                                                {d.problem || d.description}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                ) : (
                    <div className="space-y-12">
                        {/* New Commitment Trigger */}
                        <motion.button
                            whileHover={{ y: -4 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowAddCommitment(true)}
                            className="w-full relative overflow-hidden rounded-[3rem] p-1 group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/30 via-amber-500/5 to-transparent blur-2xl opacity-50 group-hover:opacity-100 transition-opacity" />
                            <div className="relative glass border-white/20 py-10 px-8 rounded-[2.8rem] flex flex-col items-center justify-center gap-5 shadow-2xl">
                                <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center shadow-xl shadow-amber-500/5 group-hover:rotate-6 transition-transform">
                                    <Target className="w-8 h-8 text-amber-500" />
                                </div>
                                <div className="text-center space-y-2">
                                    <span className="text-xl font-black text-foreground tracking-tighter block">تعهد والتزام جديد</span>
                                    <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] max-w-[200px]">نبني أنفسنا معاً.. لنبني بيتاً من السكينة</p>
                                </div>
                            </div>
                        </motion.button>

                        <div className="space-y-10 px-2">
                            {commitments.length === 0 && !loading && (
                                <div className="py-24 text-center space-y-6 opacity-20">
                                    <div className="w-24 h-24 glass border-white/10 rounded-[3rem] flex items-center justify-center mx-auto">
                                        <Flame className="w-12 h-12" />
                                    </div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] leading-relaxed">لا توجد التزامات نشطة بعد..</p>
                                </div>
                            )}

                            {commitments.map((c, i) => (
                                <motion.div
                                    key={c.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="relative group"
                                >
                                    <div className={`glass-dark rounded-[3rem] p-8 shadow-2xl shadow-black/[0.05] border relative overflow-hidden transition-all duration-500 ${c.status === 'failed' ? 'border-rose-500/20' : 'border-white/10'}`}>
                                        <div className="flex items-center justify-between mb-8 relative z-10">
                                            <div className="flex items-center gap-5 text-right">
                                                <div className={`w-16 h-16 rounded-2xl glass-dark border-white/10 flex items-center justify-center shadow-inner ${c.status === 'failed' ? 'text-rose-500 animate-pulse' : 'text-blue-500'}`}>
                                                    {c.status === 'failed' ? <XCircle className="w-8 h-8" /> : <Flame className="w-8 h-8" />}
                                                </div>
                                                <div className="space-y-1">
                                                    <h3 className="text-xl font-black text-foreground tracking-tighter">{c.title}</h3>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-2.5 h-2.5 rounded-full ${c.status === 'failed' ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`} />
                                                        <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">
                                                            {c.owner_user_id === userId ? `أنا (${names.me})` : `${names.partner}`}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                {c.status !== 'failed' && isObserver(c.owner_user_id) && (
                                                    <motion.button
                                                        whileHover={{ scale: 1.1 }}
                                                        whileTap={{ scale: 0.9 }}
                                                        onClick={() => setConfirmModal({ show: true, type: 'fail_commitment', data: c })}
                                                        className="w-12 h-12 flex items-center justify-center glass border-rose-500/20 text-rose-500 rounded-2xl transition-all shadow-sm"
                                                    >
                                                        <AlertTriangle className="w-6 h-6" />
                                                    </motion.button>
                                                )}
                                                <motion.button
                                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={() => setConfirmModal({ show: true, type: 'delete_commitment', data: c })}
                                                    className="w-12 h-12 flex items-center justify-center glass border-white/10 text-muted-foreground/30 rounded-2xl transition-all hover:bg-rose-500/10 hover:text-rose-500"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </motion.button>
                                            </div>
                                        </div>

                                        {c.status === 'failed' ? (
                                            <motion.div
                                                initial={{ y: 20, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                className="glass-dark border-rose-500/10 rounded-[3rem] p-10 text-center relative overflow-hidden"
                                            >
                                                <div className="absolute top-0 right-0 w-40 h-40 bg-rose-500/5 rounded-full blur-3xl -mr-20 -mt-20" />
                                                <span className="text-[9px] font-black text-rose-500/40 uppercase tracking-[0.3em] block mb-4">كفارة الوعد</span>
                                                <p className="text-xl font-black text-foreground tracking-tight flex items-center justify-center gap-3">
                                                    <AlertCircle className="w-5 h-5 text-rose-500/30" />
                                                    {c.punishment || 'لم يتم تحديد أثر'}
                                                </p>
                                                <div className="mt-8 inline-flex items-center gap-3 px-6 py-2 glass border-rose-500/20 rounded-full text-[9px] font-black text-rose-500 uppercase tracking-widest leading-none">
                                                    تم تسجيل التقصير اليوم ⚠️
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <div className="space-y-10">
                                                <div className="glass-dark border-white/5 rounded-[2.5rem] p-6 shadow-inner shadow-black/5">
                                                    <div className="flex items-center justify-between mb-4 px-2">
                                                        <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">مؤشر المداومة</span>
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-3xl font-black text-blue-600 tracking-tighter leading-none">{c.current_count}</span>
                                                            <span className="text-[9px] font-black text-muted-foreground/40 uppercase leading-none">/ {c.target_count}</span>
                                                        </div>
                                                    </div>
                                                    <div className="h-3 w-full glass-dark border-white/10 rounded-full overflow-hidden p-0.5">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${Math.min(100, (c.current_count / c.target_count) * 100)}%` }}
                                                            className="h-full bg-blue-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                                                        />
                                                    </div>
                                                </div>

                                                <Button
                                                    onClick={() => handleMarkProgress(c.id, c.current_count, c.target_count)}
                                                    disabled={c.current_count >= c.target_count}
                                                    className="w-full h-16 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/20 relative overflow-hidden group/btn bg-blue-600 text-white transition-all transform hover:scale-[1.01] active:scale-95 disabled:opacity-30"
                                                >
                                                    {c.current_count >= c.target_count ? (
                                                        <span className="flex items-center justify-center gap-3 leading-none">
                                                            تم بلوغ الغاية بنجاح <CheckCircle2 className="w-6 h-6" />
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center justify-center gap-3 tracking-[0.2em] leading-none">
                                                            تسجيل إتمام الهمة <Plus className="w-6 h-6" />
                                                        </span>
                                                    )}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Wizard Modal for New Dialogue */}
            <AnimatePresence>
                {showAddDialogue && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-xl"
                            onClick={() => setShowAddDialogue(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.9, y: 40, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, y: 40, opacity: 0 }}
                            className="relative w-full max-w-md bg-card/70 backdrop-blur-2xl rounded-[3.5rem] p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] z-10 border border-white/20 overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

                            {/* Step Indicators */}
                            <div className="flex justify-center gap-2.5 mb-10">
                                {[1, 2, 3, 4, 5].map(step => (
                                    <div key={step} className={`h-1.5 rounded-full transition-all duration-500 ${step <= dialogueStep ? 'w-10 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'w-2 bg-muted'}`} />
                                ))}
                            </div>

                            <div className="min-h-[360px] flex flex-col">
                                {dialogueStep === 1 && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1 space-y-6 text-right">
                                        <div className="space-y-2">
                                            <h3 className="text-3xl font-black text-foreground tracking-tight">شو المشكلة؟ 🧐</h3>
                                            <p className="text-sm text-muted-foreground font-bold">لخصي الموضوع بعنوان ووصف بسيط</p>
                                        </div>
                                        <div className="space-y-4">
                                            <input
                                                className="w-full h-16 rounded-2xl bg-muted/40 border border-border/50 px-6 text-right font-bold text-foreground focus:ring-4 ring-primary/10 transition-all outline-none"
                                                placeholder="عنوان الموضوع..."
                                                value={dialogueForm.title}
                                                onChange={e => setDialogueForm({ ...dialogueForm, title: e.target.value })}
                                            />
                                            <textarea
                                                className="w-full h-36 rounded-3xl bg-muted/40 border border-border/50 p-6 text-right font-bold text-foreground resize-none focus:ring-4 ring-primary/10 transition-all outline-none"
                                                placeholder="احكيلي شو اللي صار..."
                                                value={dialogueForm.problem}
                                                onChange={e => setDialogueForm({ ...dialogueForm, problem: e.target.value })}
                                            />
                                        </div>
                                    </motion.div>
                                )}
                                {dialogueStep === 2 && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1 space-y-6 text-right">
                                        <div className="space-y-2">
                                            <h3 className="text-3xl font-black text-foreground tracking-tight">رأيك أنتِ 🌸</h3>
                                            <p className="text-sm text-muted-foreground font-bold">كيف شايفة الموضوع من زاويتك؟</p>
                                        </div>
                                        <textarea
                                            className="w-full h-64 rounded-[2.5rem] bg-indigo-500/[0.03] border border-indigo-500/10 p-7 text-right font-bold text-foreground resize-none focus:ring-4 ring-indigo-500/10 transition-all outline-none italic"
                                            placeholder="أنا بشوف إنه..."
                                            value={dialogueForm.my_opinion}
                                            onChange={e => setDialogueForm({ ...dialogueForm, my_opinion: e.target.value })}
                                        />
                                    </motion.div>
                                )}
                                {dialogueStep === 3 && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1 space-y-6 text-right">
                                        <div className="space-y-2">
                                            <h3 className="text-3xl font-black text-foreground tracking-tight">رأيه هو 🧔🏻‍♂️</h3>
                                            <p className="text-sm text-muted-foreground font-bold">شو كان رده أو وجهة نظره؟</p>
                                        </div>
                                        <textarea
                                            className="w-full h-64 rounded-[2.5rem] bg-amber-500/[0.03] border border-amber-500/10 p-7 text-right font-bold text-foreground resize-none focus:ring-4 ring-amber-500/10 transition-all outline-none italic"
                                            placeholder="هو حكى إنه..."
                                            value={dialogueForm.partner_opinion}
                                            onChange={e => setDialogueForm({ ...dialogueForm, partner_opinion: e.target.value })}
                                        />
                                    </motion.div>
                                )}
                                {dialogueStep === 4 && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1 space-y-6 text-right">
                                        <div className="space-y-2">
                                            <h3 className="text-3xl font-black text-foreground tracking-tight">الحل والوعد 🤝</h3>
                                            <p className="text-sm text-muted-foreground font-bold">على شو اتفقتوا بالنهاية؟</p>
                                        </div>
                                        <textarea
                                            className="w-full h-64 rounded-[2.5rem] bg-emerald-500/[0.03] border border-emerald-500/10 p-7 text-right font-bold text-foreground resize-none focus:ring-4 ring-emerald-500/10 transition-all outline-none"
                                            placeholder="اتفقنا إنه..."
                                            value={dialogueForm.solution}
                                            onChange={e => setDialogueForm({ ...dialogueForm, solution: e.target.value })}
                                        />
                                    </motion.div>
                                )}
                                {dialogueStep === 5 && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1 space-y-6 text-right">
                                        <div className="space-y-2">
                                            <h3 className="text-3xl font-black text-foreground tracking-tight">مين المسؤول؟ 👤</h3>
                                            <p className="text-sm text-muted-foreground font-bold">حددي مين لازم يلتزم بهذا الوعد</p>
                                        </div>
                                        <div className="space-y-3">
                                            {['me', 'partner', 'both'].map((type) => (
                                                <motion.button
                                                    key={type}
                                                    whileHover={{ x: -4 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={() => setDialogueForm({ ...dialogueForm, assignee: type as any })}
                                                    className={`w-full p-6 rounded-3xl border-2 transition-all text-right flex items-center justify-between ${dialogueForm.assignee === type ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/5' : 'border-border/40 bg-muted/20 hover:bg-muted/40'}`}
                                                >
                                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${dialogueForm.assignee === type ? 'border-blue-500' : 'border-muted-foreground/30'}`}>
                                                        {dialogueForm.assignee === type && <div className="w-3 h-3 rounded-full bg-blue-500" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-base font-black text-foreground">
                                                            {type === 'me' ? names.me : type === 'partner' ? names.partner : 'كلينا'}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground font-black opacity-70 uppercase">
                                                            {type === 'me' ? 'أنا المسؤول' : type === 'partner' ? 'هو المسؤول' : 'مسؤولية مشتركة'}
                                                        </p>
                                                    </div>
                                                </motion.button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            <div className="flex gap-4 mt-10">
                                {dialogueStep > 1 && (
                                    <button
                                        onClick={prevStep}
                                        className="h-16 px-8 rounded-2xl bg-muted/40 text-muted-foreground font-black text-sm hover:bg-muted/60 transition-colors"
                                    >
                                        رجوع
                                    </button>
                                )}
                                <Button
                                    onClick={dialogueStep === 5 ? handleSaveDialogue : nextStep}
                                    disabled={isSubmitting}
                                    className="flex-1 h-16 rounded-2xl font-black text-sm shadow-xl shadow-blue-500/20"
                                >
                                    {dialogueStep === 5 ? (isSubmitting ? 'جاري الحفظ...' : 'اعتماد وحفظ الوعد ✨') : 'التالي'}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal for New Commitment */}
            <AnimatePresence>
                {showAddCommitment && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={() => setShowAddCommitment(false)} />
                        <motion.div
                            initial={{ scale: 0.9, y: 40, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, y: 40, opacity: 0 }}
                            className="relative w-full max-w-md bg-card/70 backdrop-blur-2xl rounded-[3.5rem] p-10 shadow-2xl z-10 border border-white/20"
                        >
                            <h2 className="text-3xl font-black mb-8 text-foreground text-right tracking-tight">التزام جديد 💪</h2>
                            <form onSubmit={handleSaveCommitment} className="space-y-6">
                                <div className="space-y-2 text-right">
                                    <label className="text-[11px] font-black text-muted-foreground uppercase mr-1 opacity-70">شو الالتزام؟</label>
                                    <input required className="w-full h-16 rounded-2xl bg-muted/40 border border-border/50 px-6 text-right font-bold text-foreground focus:ring-4 ring-primary/10 transition-all outline-none" placeholder="مثلاً: جيم، قراءة..." value={commitmentForm.title} onChange={e => setCommitmentForm({ ...commitmentForm, title: e.target.value })} />
                                </div>
                                <div className="space-y-3 text-right">
                                    <label className="text-[11px] font-black text-muted-foreground uppercase mr-1 opacity-70">مين صاحب الالتزام؟</label>
                                    <div className="flex gap-3">
                                        {['partner', 'me'].map((type) => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setCommitmentForm({ ...commitmentForm, assignee: type as any })}
                                                className={`flex-1 h-14 rounded-2xl border-2 transition-all font-black text-sm ${commitmentForm.assignee === type ? 'border-blue-500 bg-blue-500/10 ring-4 ring-blue-500/5' : 'border-border/40 bg-muted/20 hover:bg-muted/40'}`}
                                            >
                                                {type === 'partner' ? names.partner : names.me}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2 text-right">
                                    <label className="text-[11px] font-black text-muted-foreground uppercase mr-1 opacity-70">شو العقوبة إذا فشل؟ 😅</label>
                                    <textarea required className="w-full h-28 rounded-[2rem] bg-muted/40 border border-border/50 p-6 text-right font-bold text-foreground resize-none focus:ring-4 ring-primary/10 transition-all outline-none" placeholder="عزيمة، مشوار، هدية..." value={commitmentForm.punishment} onChange={e => setCommitmentForm({ ...commitmentForm, punishment: e.target.value })} />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2 text-right">
                                        <label className="text-[11px] font-black text-muted-foreground uppercase mr-1 opacity-70">التكرار</label>
                                        <select className="w-full h-14 rounded-2xl bg-muted/40 border border-border/50 px-5 text-right font-bold text-foreground focus:ring-4 ring-primary/10 appearance-none outline-none" value={commitmentForm.period_type} onChange={e => setCommitmentForm({ ...commitmentForm, period_type: e.target.value as any })}>
                                            <option value="daily">يومي</option>
                                            <option value="weekly">أسبوعي</option>
                                            <option value="monthly">شهري</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2 text-right">
                                        <label className="text-[11px] font-black text-muted-foreground uppercase mr-1 opacity-70">الهدف</label>
                                        <input type="number" min="1" max="100" required className="w-full h-14 rounded-2xl bg-muted/40 border border-border/50 px-5 text-right font-bold text-foreground focus:ring-4 ring-primary/10 outline-none" value={commitmentForm.target_count} onChange={e => setCommitmentForm({ ...commitmentForm, target_count: parseInt(e.target.value) })} />
                                    </div>
                                </div>

                                <Button type="submit" disabled={isSubmitting} className="w-full h-16 rounded-[2rem] font-black shadow-2xl shadow-blue-500/20 mt-6 text-sm bg-blue-600">
                                    {isSubmitting ? 'جاري الحفظ...' : 'تثبيت الالتزام 💪'}
                                </Button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>



            {/* Selected Dialogue Details Modal */}
            <AnimatePresence>
                {selectedDialogue && (
                    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-background/80 backdrop-blur-xl"
                            onClick={() => setSelectedDialogue(null)}
                        />
                        <motion.div
                            layoutId={`dialogue-card-${selectedDialogue.id}`}
                            initial={{ scale: 0.9, y: 50, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, y: 50, opacity: 0 }}
                            className="w-full h-full max-h-[85vh] overflow-y-auto bg-card border border-border/50 rounded-[3rem] shadow-2xl relative z-10 max-w-lg scrollbar-hide"
                        >
                            {/* Decorative Header */}
                            <div className="sticky top-0 bg-card/80 backdrop-blur-xl p-6 border-b border-border/10 z-20 flex justify-between items-center">
                                <button
                                    onClick={() => setSelectedDialogue(null)}
                                    className="w-10 h-10 bg-muted rounded-full flex items-center justify-center hover:bg-muted/80"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                                <div className="flex items-center gap-2">
                                    <div className="text-right">
                                        <h3 className="font-black text-sm">{selectedDialogue.title}</h3>
                                        <p className="text-[10px] text-muted-foreground font-bold">{selectedDialogue.dialogue_date}</p>
                                    </div>
                                    <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500">
                                        <MessageCircle className="w-5 h-5" />
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 space-y-8">
                                {/* Visual Flow Journey - Reusing existing design */}
                                <div className="space-y-8 relative">
                                    {/* Journey Line */}
                                    <div className="absolute top-4 right-[19px] bottom-10 w-0.5 bg-gradient-to-b from-rose-500/20 via-indigo-500/20 to-emerald-500/20 -z-10" />

                                    {/* 1. The Issue */}
                                    <div className="flex items-start gap-5">
                                        <div className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/30 border-4 border-card relative z-10">
                                            <AlertCircle className="w-5 h-5" />
                                        </div>
                                        <div className="bg-rose-500/[0.03] rounded-3xl p-6 w-full border border-rose-500/10 space-y-2">
                                            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest block opacity-70">نقطة الخلاف</span>
                                            <p className="text-base font-bold text-foreground/90 leading-relaxed text-right">{selectedDialogue.problem || selectedDialogue.description}</p>
                                        </div>
                                    </div>

                                    {/* 2. The Opinions */}
                                    <div className="flex items-start gap-5">
                                        <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30 border-4 border-card relative z-10">
                                            <MessageCircle className="w-5 h-5" />
                                        </div>
                                        <div className="space-y-4 w-full">
                                            <div className="bg-indigo-500/[0.03] rounded-3xl p-6 border border-indigo-500/10 relative text-right">
                                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500/10 rounded-full blur-sm" />
                                                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block mb-2">{names.me}</span>
                                                <p className="text-sm font-bold text-foreground/80 leading-relaxed italic">"{selectedDialogue.my_opinion || '...'}"</p>
                                            </div>
                                            <div className="bg-indigo-500/[0.03] rounded-3xl p-6 border border-indigo-500/10 relative text-right">
                                                <div className="absolute -top-1 -left-1 w-4 h-4 bg-indigo-500/10 rounded-full blur-sm" />
                                                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block mb-2">{names.partner}</span>
                                                <p className="text-sm font-bold text-foreground/80 leading-relaxed italic">"{selectedDialogue.partner_opinion || '...'}"</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. The Decree (Agreement) */}
                                    <div className="flex items-start gap-5">
                                        <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30 border-4 border-card relative z-10">
                                            <ShieldCheck className="w-5 h-5" />
                                        </div>
                                        <div className="bg-emerald-500/[0.06] rounded-[2rem] p-8 w-full border-2 border-emerald-500/10 relative overflow-hidden group/decree shadow-inner text-right">
                                            <Sparkles className="absolute top-4 left-4 w-6 h-6 text-emerald-500/30 animate-pulse" />
                                            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />

                                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] block mb-4">الاتفاق النهائي</span>
                                            <p className="text-xl font-black text-foreground leading-snug tracking-tight">{selectedDialogue.final_agreement}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Linked Agreement Status */}
                                <div className="pt-6 border-t border-border/10">
                                    {(() => {
                                        const ag = agreements.find(a =>
                                            (a.origin_dialogue_id && a.origin_dialogue_id === selectedDialogue.id) ||
                                            (a.title === selectedDialogue.final_agreement && a.partnership_id === selectedDialogue.partnership_id)
                                        );

                                        if (ag) {
                                            return (
                                                <div className="bg-muted/30 rounded-[2.5rem] p-6 text-right space-y-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                                            <Target className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-black text-sm">حالة الالتزام</h4>
                                                            <p className="text-[10px] text-muted-foreground font-bold">متابعة تنفيذ الوعد</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-3">
                                                        <div className="flex-1 bg-background rounded-2xl p-4 border border-border/20 text-center">
                                                            <span className="block text-2xl font-black text-foreground">{ag.breach_count || 0}</span>
                                                            <span className="text-[10px] font-bold text-muted-foreground uppercase">مخالفة</span>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            onClick={() => setConfirmModal({ show: true, type: 'breach', data: ag })}
                                                            className="flex-1 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 h-auto rounded-2xl font-black text-xs"
                                                        >
                                                            تسجيل إخلاف
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>

                                {/* Delete Action */}
                                <div className="pt-6">
                                    <button
                                        onClick={() => {
                                            setConfirmModal({ show: true, type: 'delete_dialogue', data: selectedDialogue });
                                            // Close details modal? No, wait for confirmation modal
                                        }}
                                        className="w-full h-14 flex items-center justify-center gap-2 text-rose-500 bg-rose-500/5 hover:bg-rose-500/10 rounded-2xl transition-colors font-black text-xs"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        حذف هذه الجلسة نهائياً
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Confirmation Modal - Reusing existing logic but ensure z-index is higher */}
            <AnimatePresence>
                {confirmModal?.show && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-5">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={() => setConfirmModal(null)} />
                        <motion.div initial={{ scale: 0.9, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 40, opacity: 0 }} className="relative w-full max-w-[320px] bg-card/80 backdrop-blur-2xl rounded-[3.5rem] p-10 shadow-2xl z-10 text-center border border-white/20">
                            <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner ${confirmModal.type.includes('delete') ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                {confirmModal.type.includes('delete') ? <Trash2 className="w-10 h-10" /> : <AlertTriangle className="w-10 h-10" />}
                            </div>
                            <h3 className="text-2xl font-black mb-3 text-foreground tracking-tight">
                                {confirmModal.type === 'breach' && 'إبلاغ عن إخلاف؟'}
                                {confirmModal.type === 'fail_commitment' && 'إبلاغ عن تقصير؟'}
                                {confirmModal.type === 'delete_dialogue' && 'حذف الجلسة؟'}
                                {confirmModal.type === 'delete_agreement' && 'حذف الوعد؟'}
                                {confirmModal.type === 'delete_commitment' && 'حذف الالتزام؟'}
                            </h3>
                            <p className="text-sm font-bold text-muted-foreground mb-10 opacity-80 leading-relaxed px-2">
                                {confirmModal.type === 'breach' && 'هل تم إخلاف الوعد فعلاً؟ سيتم تسجيل التجاوز في السجل.'}
                                {confirmModal.type === 'fail_commitment' && 'هل يوجد تقصير في الالتزام؟ سيتم كشف العقوبة المتفق عليها.'}
                                {confirmModal.type.includes('delete') && 'هل أنتِ متأكدة من الحذف؟ لا يمكن التراجع عن هذا الإجراء.'}
                            </p>
                            <div className="flex flex-col gap-3">
                                <Button variant="destructive" className="w-full h-14 rounded-2xl font-black text-sm shadow-xl shadow-rose-500/10" onClick={() => {
                                    if (confirmModal.type === 'breach') handleBreach(confirmModal.data);
                                    else if (confirmModal.type === 'fail_commitment') handleCommitmentFail(confirmModal.data);
                                    else if (confirmModal.type === 'delete_dialogue') handleDeleteDialogue(confirmModal.data);
                                    else if (confirmModal.type === 'delete_agreement') handleDeleteAgreement(confirmModal.data);
                                    else if (confirmModal.type === 'delete_commitment') handleDeleteCommitment(confirmModal.data);
                                }}>نعم، أنا متأكد</Button>
                                <button className="w-full h-12 rounded-2xl font-black text-xs text-muted-foreground hover:bg-muted/30 transition-colors" onClick={() => setConfirmModal(null)}>تراجع</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
}
