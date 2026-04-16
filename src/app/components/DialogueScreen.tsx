import { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'motion/react';
import {
    ArrowLeft, MessageCircle, ShieldCheck, Plus, Sparkles,
    Trash2, AlertCircle, AlertTriangle, Target, Flame,
    Heart, XCircle, CheckCircle2, User, Users, FileSignature, Coins
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface DialogueScreenProps {
    onBack: () => void;
    userId: string;
    partnershipId: string | null;
    isDarkMode?: boolean;
}

type Tab = 'constitution' | 'commitments' | 'penalty_rules';

export function DialogueScreen({ onBack, userId, partnershipId }: DialogueScreenProps) {
    const [activeTab, setActiveTab] = useState<Tab>('constitution');

    // UI States
    const [showAddDialogue, setShowAddDialogue] = useState(false);
    const [showAddCommitment, setShowAddCommitment] = useState(false);
    const [showAddRule, setShowAddRule] = useState(false);
    const [loading, setLoading] = useState(true);
    const [names, setNames] = useState<{ me: string, partner: string }>({ me: 'أنا', partner: 'الشريك' });
    const [partnerId, setPartnerId] = useState<string | null>(null);
    const [selectedDialogue, setSelectedDialogue] = useState<any>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [filterType, setFilterType] = useState<'all' | 'me' | 'partner' | 'both'>('all');
    const [dialogueFilterType, setDialogueFilterType] = useState<'all' | 'me' | 'partner' | 'both'>('all');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{ show: boolean, type: string, data: any } | null>(null);

    // Data States
    const [dialogues, setDialogues] = useState<any[]>([]);
    const [agreements, setAgreements] = useState<any[]>([]);
    const [commitments, setCommitments] = useState<any[]>([]);
    const [penaltyRules, setPenaltyRules] = useState<any[]>([]);
    const [penaltyRecords, setPenaltyRecords] = useState<any[]>([]);

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
        period_type: 'weekly' as 'daily' | 'weekly' | 'monthly',
        punishment: '',
        assignee: 'me' as 'me' | 'partner'
    });

    const [ruleForm, setRuleForm] = useState({
        title: '',
        subRules: [{ id: Date.now().toString(), label: '', points: 1 }]
    });

    const filteredDialogues = useMemo(() => {
        return [...dialogues]
            .filter(d => {
                if (dialogueFilterType === 'all') return true;

                // Determine assignee type: prefer direct column, fallback to agreement
                let assigneeType = d.assignee;
                const ag = agreements.find(a => a.origin_dialogue_id === d.id);

                if (!assigneeType && ag) {
                    assigneeType = ag.assignee;
                }

                if (!assigneeType) return false;

                if (dialogueFilterType === 'both') return assigneeType === 'both';

                const creator = d.created_by_user_id;
                let realAssigneeId = '';

                if (assigneeType === 'me') realAssigneeId = creator;
                else if (assigneeType === 'partner') realAssigneeId = (creator === userId ? partnerId : userId) || '';

                // Strict check based on real ID
                if (dialogueFilterType === 'me') return realAssigneeId === userId;
                if (dialogueFilterType === 'partner') return realAssigneeId !== userId && realAssigneeId !== '' && realAssigneeId !== null;

                return true;
            })
            .sort((a, b) => {
                const dateA = new Date(a.dialogue_date).getTime();
                const dateB = new Date(b.dialogue_date).getTime();
                return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
            });
    }, [dialogues, agreements, dialogueFilterType, sortOrder, userId, partnerId]);

    useEffect(() => {
        if (partnershipId) {
            loadData();
            loadNames();
        }
    }, [partnershipId, activeTab]);


    const checkAndResetCommitments = async (items: any[]) => {
        const now = new Date();
        let resetOccurred = false;

        for (const item of items) {
            const lastReset = new Date(item.last_reset_at || item.created_at);
            let shouldReset = false;

            if (item.period_type === 'daily') {
                shouldReset = now.toDateString() !== lastReset.toDateString();
            } else if (item.period_type === 'weekly') {
                const startOfThisWeek = new Date(now);
                // In many Arab countries, week starts on Sunday (0) or Saturday (6)
                // We'll use Sunday (0) as the reference point
                startOfThisWeek.setDate(now.getDate() - now.getDay());
                startOfThisWeek.setHours(0, 0, 0, 0);
                shouldReset = lastReset < startOfThisWeek;
            } else if (item.period_type === 'monthly') {
                shouldReset = now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();
            }

            if (shouldReset) {
                await supabase.from('commitments').update({
                    current_count: 0,
                    status: 'on-track',
                    last_reset_at: now.toISOString()
                }).eq('id', item.id);
                resetOccurred = true;
            }
        }
        return resetOccurred;
    };

    const loadData = async () => {
        if (!partnershipId) return;
        setLoading(true);
        try {
            const [dRes, aRes, cRes, prRes, precRes] = await Promise.all([
                supabase.from('dialogues').select('*').eq('partnership_id', partnershipId).order('dialogue_date', { ascending: false }),
                supabase.from('agreements').select('*').eq('partnership_id', partnershipId),
                supabase.from('commitments').select('*').eq('partnership_id', partnershipId).eq('is_active', true),
                supabase.from('penalty_rules').select('*').eq('partnership_id', partnershipId).eq('is_active', true).order('created_at', { ascending: false }),
                supabase.from('penalty_records').select('*').eq('partnership_id', partnershipId).order('created_at', { ascending: false })
            ]);

            if (dRes.data) setDialogues(dRes.data);
            if (aRes.data) setAgreements(aRes.data);
            
            if (cRes.data) {
                const didReset = await checkAndResetCommitments(cRes.data);
                if (didReset) {
                    const { data: refreshed } = await supabase.from('commitments').select('*').eq('partnership_id', partnershipId).eq('is_active', true);
                    setCommitments(refreshed || cRes.data);
                } else {
                    setCommitments(cRes.data);
                }
            }

            if (prRes.data) setPenaltyRules(prRes.data);
            if (precRes.data) setPenaltyRecords(precRes.data);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const loadNames = async () => {
        if (!partnershipId) return;
        try {
            const { data } = await supabase.from('partnerships').select('user1_id, user2_id').eq('id', partnershipId).single();
            if (data) {
                const otherId = data.user1_id === userId ? data.user2_id : data.user1_id;
                setPartnerId(otherId);
                const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', [userId, otherId]);
                if (profiles) {
                    const me = profiles.find(p => p.id === userId)?.full_name || 'أنا';
                    const partner = profiles.find(p => p.id === otherId)?.full_name || 'الشريك';
                    setNames({ me, partner });
                }
            }
        } catch (err) { console.error(err); }
    };


    const handleSaveDialogue = async () => {
        setIsSubmitting(true);
        try {
            const { data: dialogue, error: dError } = await supabase.from('dialogues').insert({
                partnership_id: partnershipId,
                title: dialogueForm.title,
                dialogue_date: dialogueForm.date,
                problem: dialogueForm.problem,
                my_opinion: dialogueForm.my_opinion,
                partner_opinion: dialogueForm.partner_opinion,
                final_agreement: dialogueForm.solution,
                created_by_user_id: userId,
                assignee: dialogueForm.assignee
            }).select().single();

            if (dError) throw dError;

            if (dialogue) {
                // Create agreement
                await supabase.from('agreements').insert({
                    partnership_id: partnershipId,
                    origin_dialogue_id: dialogue.id,
                    title: dialogue.final_agreement,
                    assignee: dialogueForm.assignee,
                    duration: 'open'
                });
            }

            setShowAddDialogue(false);
            setDialogueForm({ title: '', date: new Date().toISOString().split('T')[0], problem: '', my_opinion: '', partner_opinion: '', solution: '', assignee: 'both' });
            setDialogueStep(1);
            loadData();
        } catch (err: any) {
            console.error(err);
            alert('خطأ في حفظ الحوار: ' + (err.message || 'مشكلة في قاعدة البيانات'));
        }
        setIsSubmitting(false);
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
                start_date: new Date().toISOString(),
                last_reset_at: new Date().toISOString()
            };

            const { error: firstTryError } = await supabase.from('commitments').insert({
                ...commitmentData,
                created_by_user_id: userId
            });

            if (firstTryError) {
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

    const handleReduceBreach = async (agreement: any) => {
        if ((agreement.breach_count || 0) <= 0) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('agreements').update({
                breach_count: agreement.breach_count - 1
            }).eq('id', agreement.id);

            if (!error) {
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

    const handleSaveRule = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('penalty_rules').insert({
                partnership_id: partnershipId,
                created_by_user_id: userId,
                title: ruleForm.title,
                sub_rules: ruleForm.subRules,
                is_active: true
            });
            if (error) {
                alert("للأسف صار في مشكلة: " + error.message);
            } else {
                setShowAddRule(false);
                setRuleForm({ title: '', subRules: [{ id: Date.now().toString(), label: '', points: 1 }] });
                loadData();
            }
        } catch (err) { console.error(err); }
        setIsSubmitting(false);
    };

    const handleAddPenalty = async (ruleId: string, violatorId: string, subRuleId: string, points: number) => {
        setIsSubmitting(true);
        try {
            const numPoints = Number(points);
            const { data, error } = await supabase.from('penalty_records').insert({
                partnership_id: partnershipId,
                user_id: violatorId,
                rule_id: ruleId,
                sub_rule_id: subRuleId,
                points: numPoints
            }).select();

            if (error) {
                alert("مشكلة في تسجيل الخصم: " + error.message);
            } else {
                // Remove alert after testing, just for confirmation
                alert(`تم تسجيل خصم ${numPoints} نقاط بنجاح! جاري تحديث الأرقام...`);
                loadData();
            }
        } catch (err: any) { 
            alert("خطأ غير متوقع: " + err.message);
            console.error(err); 
        }
        setIsSubmitting(false);
    };

    const handleDeleteRule = async (rule: any) => {
        setIsSubmitting(true);
        try {
            await supabase.from('penalty_rules').delete().eq('id', rule.id);
            setConfirmModal(null);
            loadData();
        } catch (err) { console.error(err); }
        setIsSubmitting(false);
    };

    const handleResetPenalties = async (ruleId?: string) => {
        setIsSubmitting(true);
        try {
            let query = supabase.from('penalty_records').delete().eq('partnership_id', partnershipId);
            if (ruleId) query = query.eq('rule_id', ruleId);
            
            const { error } = await query;
            if (error) throw error;
            
            setConfirmModal(null);
            loadData();
        } catch (err) { console.error(err); }
        setIsSubmitting(false);
    };

    const nextStep = () => setDialogueStep(prev => Math.min(prev + 1, 5));
    const prevStep = () => setDialogueStep(prev => Math.max(prev - 1, 1));

    return (
        <div className="flex-1 bg-background flex flex-col relative h-screen mood-dialogue overflow-hidden">
            {/* Atmospheric Background Auras */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[100%] h-[60%] bg-rose-500/5 blur-[150px] rounded-full opacity-60" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[100%] h-[60%] bg-blue-500/5 blur-[150px] rounded-full opacity-40" />
            </div>

            {/* Header */}
            <header className="px-8 pt-12 pb-8 sticky top-0 bg-background/40 backdrop-blur-3xl z-40">
                <div className="flex items-center justify-between mb-8">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={onBack}
                        className="w-12 h-12 flex items-center justify-center glass rounded-2xl border-white/60 dark:border-white/10 shadow-xl text-foreground/40 hover:bg-white/40 transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </motion.button>
                    <div className="text-center">
                        <h1 className="text-xl font-black text-foreground tracking-tighter">عهودنا</h1>
                        <p className="text-[9px] font-black text-blue-600/40 uppercase tracking-[0.5em] mt-0.5">سجل الحوارات.. ومحطات الاتفاق</p>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.1, rotate: 90 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                            if (activeTab === 'constitution') setShowAddDialogue(true);
                            else if (activeTab === 'commitments') setShowAddCommitment(true);
                            else setShowAddRule(true);
                        }}
                        className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-2xl shadow-blue-500/40 relative overflow-hidden group border-4 border-white dark:border-[#0a0505]"
                    >
                        <Plus className="w-8 h-8 relative z-10" />
                    </motion.button>
                </div>

                <div className="flex bg-white dark:bg-[#0a0505]/40 rounded-[2.8rem] border border-white/40 dark:border-white/5 p-1.5 shadow-2xl shadow-blue-900/5 max-w-[360px] mx-auto relative overflow-hidden backdrop-blur-xl">
                    {[
                        { id: 'constitution', label: 'جلسات الحوار', icon: MessageCircle },
                        { id: 'penalty_rules', label: 'دفتر الاتفاقيات', icon: FileSignature },
                        { id: 'commitments', label: 'التزاماتنا', icon: Target }
                    ].map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-[2.2rem] transition-all duration-700 relative z-10 ${isActive ? 'text-white' : 'text-blue-900/40 dark:text-white/30 hover:text-blue-600 dark:hover:text-white'}`}
                            >
                                {isActive && <motion.div layoutId="pact-tab-pill" className="absolute inset-0 bg-blue-600 rounded-[2.2rem] shadow-xl shadow-blue-600/20 z-[-1]" />}
                                <tab.icon className={`w-3 h-3 transition-transform ${isActive ? 'rotate-12 scale-110' : 'opacity-40'}`} />
                                <span className={`text-[8.5px] font-black uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-60'}`}>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </header>

            <div className="flex-1 px-4 py-8 overflow-y-auto pb-32 scrollbar-hide">
                <AnimatePresence mode="wait">
                    {activeTab === 'constitution' && (
                        <motion.div
                            key="constitution"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="space-y-6"
                        >
                            <div className="flex flex-col gap-4 px-2 mb-2">
                                <div className="flex items-center justify-between">
                                    <motion.button
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                        className="flex items-center gap-2 px-4 py-2 bg-white/40 dark:bg-black/20 border border-white/60 dark:border-white/5 rounded-full text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-blue-500 transition-colors"
                                    >
                                        {sortOrder === 'desc' ? 'الأحدث أولاً' : 'الأقدم أولاً'}
                                        <div className={`w-1.5 h-1.5 rounded-full bg-blue-500 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                                    </motion.button>
                                    <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.3em]">أرشيف السكينة</span>
                                </div>
                                <div className="flex items-center gap-2 justify-end overflow-x-auto scrollbar-hide pb-2">
                                    {[
                                        { id: 'all', label: 'الكل' },
                                        { id: 'me', label: names.me },
                                        { id: 'partner', label: names.partner },
                                        { id: 'both', label: 'مشترك' }
                                    ].map((f) => (
                                        <button
                                            key={f.id}
                                            onClick={() => setDialogueFilterType(f.id as any)}
                                            className={`px-4 py-1.5 rounded-full text-[9px] font-black transition-all border ${dialogueFilterType === f.id ? 'bg-blue-500 text-white border-blue-500' : 'bg-white/40 dark:bg-white/5 text-muted-foreground border-white/40 dark:border-white/5 hover:border-blue-500/50'}`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="relative group/tray px-1">
                                <div className="absolute inset-x-[-12px] inset-y-[-16px] bg-gradient-to-b from-blue-500/[0.03] to-indigo-500/[0.03] dark:from-white/[0.02] dark:to-transparent rounded-[4rem] border border-white/20 dark:border-white/5 shadow-2xl shadow-blue-900/[0.02] pointer-events-none -z-10" />

                                <div className="grid grid-cols-2 gap-4 pb-12">
                                    {dialogues.length === 0 && !loading && (
                                        <div className="col-span-2 py-24 text-center space-y-6 opacity-20">
                                            <div className="w-24 h-24 glass border-white/10 rounded-[3rem] flex items-center justify-center mx-auto">
                                                <MessageCircle className="w-10 h-10" />
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] leading-relaxed">لم يتم تدوين حوار بعد..</p>
                                        </div>
                                    )}

                                    {/* Dialogue Card Content */}
                                    {filteredDialogues.map((d, i) => {
                                        // Random but deterministic gradient
                                        const gradients = [
                                            "from-blue-500/[0.03] to-purple-500/[0.03]",
                                            "from-rose-500/[0.03] to-orange-500/[0.03]",
                                            "from-emerald-500/[0.03] to-teal-500/[0.03]",
                                            "from-amber-500/[0.03] to-yellow-500/[0.03]",
                                            "from-indigo-500/[0.03] to-cyan-500/[0.03]"
                                        ];
                                        const grad = gradients[i % gradients.length];

                                        // Assignee Badge Logic
                                        const ag = agreements.find(a => a.origin_dialogue_id === d.id);
                                        let assigneeLabel = '';
                                        let assigneeColor = 'text-gray-400';

                                        if (ag && ag.assignee) {
                                            if (ag.assignee === 'both') {
                                                assigneeLabel = 'عهد مشترك';
                                                assigneeColor = 'text-purple-500';
                                            } else {
                                                const creator = d.created_by_user_id;
                                                let realAssigneeId = '';
                                                if (ag.assignee === 'me') realAssigneeId = creator;
                                                else if (ag.assignee === 'partner') realAssigneeId = (creator === userId ? partnerId : userId) || '';

                                                if (realAssigneeId === userId) {
                                                    assigneeLabel = `عهد عليّ (${names.me})`;
                                                    assigneeColor = 'text-blue-500';
                                                } else if (realAssigneeId) {
                                                    assigneeLabel = `عهد على ${names.partner}`;
                                                    assigneeColor = 'text-rose-500';
                                                }
                                            }
                                        }

                                        return (
                                            <motion.div
                                                key={d.id}
                                                layoutId={`dialogue-card-${d.id}`}
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: i * 0.05 }}
                                                onClick={() => setSelectedDialogue(d)}
                                                className="relative group cursor-pointer active:scale-95"
                                            >
                                                <div className={`relative bg-gradient-to-br ${grad} bg-white dark:bg-[#0a0505]/80 backdrop-blur-md border border-white dark:border-white/5 rounded-[3.2rem] p-6 overflow-hidden flex flex-col justify-between h-[165px] shadow-2xl shadow-blue-900/[0.03] group-hover:shadow-blue-500/[0.06] transition-all duration-700`}>
                                                    {/* Subtly Decorative Shape */}
                                                    <div className={`absolute -bottom-10 -left-10 w-40 h-40 bg-current opacity-[0.03] rounded-full blur-3xl group-hover:opacity-[0.06] transition-opacity`} />

                                                    <div className="flex justify-between items-start relative z-10">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-10 h-10 bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/5 rounded-full flex items-center justify-center text-foreground/50 transition-all shadow-sm">
                                                                <MessageCircle className="w-5 h-5 opacity-70" />
                                                            </div>
                                                            {assigneeLabel && (
                                                                <span className={`text-[9px] font-black ${assigneeColor} bg-white/50 dark:bg-black/20 px-2 py-1 rounded-full border border-white/20`}>{assigneeLabel}</span>
                                                            )}
                                                        </div>

                                                        <div className="px-3 py-1.5 bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/5 rounded-full shadow-sm">
                                                            <span className="text-[9px] font-black text-foreground/30 uppercase tracking-[0.2em]">
                                                                {d.dialogue_date?.slice(5).replace('-', '_')}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2 text-right relative z-10">
                                                        <h3 className="font-black text-base leading-[1.2] line-clamp-2 tracking-tight text-foreground/80 group-hover:text-foreground transition-colors">{d.title}</h3>
                                                        <div className="flex items-center gap-1.5 justify-end opacity-30 group-hover:opacity-50 transition-all">
                                                            <p className="text-[9px] font-black uppercase tracking-widest line-clamp-1">{d.problem || d.description || 'تأسيس حوار'}</p>
                                                            <div className="w-1 h-1 rounded-full bg-foreground/40" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    )}
                    {activeTab === 'penalty_rules' && (
                        <motion.div
                            key="penalty_rules"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="space-y-6 px-1"
                        >
                            {(() => {
                                const myPoints = penaltyRecords.filter(r => r.user_id === userId).reduce((acc, r) => acc + (r.points || 0), 0);
                                const partnerPoints = penaltyRecords.filter(r => r.user_id === partnerId).reduce((acc, r) => acc + (r.points || 0), 0);
                                const myJod = (myPoints / 10).toFixed(1);
                                const partnerJod = (partnerPoints / 10).toFixed(1);

                                return (
                                    <>
                                        <div className="grid grid-cols-2 gap-4 mb-6">
                                            <div className="bg-rose-500/10 rounded-[2rem] p-5 text-center flex flex-col items-center">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">مخالفات {names.me}</span>
                                                <span className="text-3xl font-black text-rose-500 mb-1">{myPoints}</span>
                                                <div className="bg-white/50 dark:bg-black/20 px-3 py-1 rounded-full flex items-center gap-1.5 border border-black/5 mt-1">
                                                    <Coins className="w-3 h-3 text-amber-500" />
                                                    <span className="text-[10px] font-bold">{myJod} JOD</span>
                                                </div>
                                            </div>
                                            <div className="bg-emerald-500/10 rounded-[2rem] p-5 text-center flex flex-col items-center">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">مخالفات {names.partner}</span>
                                                <span className="text-3xl font-black text-emerald-500 mb-1">{partnerPoints}</span>
                                                <div className="bg-white/50 dark:bg-black/20 px-3 py-1 rounded-full flex items-center gap-1.5 border border-black/5 mt-1">
                                                    <Coins className="w-3 h-3 text-amber-500" />
                                                    <span className="text-[10px] font-bold">{partnerJod} JOD</span>
                                                </div>
                                            </div>
                                        </div>

                                        {penaltyRecords.length > 0 && (
                                            <div className="flex justify-center mb-6">
                                                <button onClick={() => setConfirmModal({ show: true, type: 'reset_penalties', data: null })} className="text-[10px] font-black uppercase tracking-widest text-rose-500 bg-rose-500/5 px-6 py-3 rounded-[1rem] hover:bg-rose-500 hover:text-white transition-all border border-rose-500/10">
                                                    تصفير عداد المخالفات بالكامل 🔄
                                                </button>
                                            </div>
                                        )}

                                        <div className="space-y-4">
                                            {penaltyRules.length === 0 && !loading && (
                                                <div className="text-center py-10 opacity-40">
                                                    <div className="w-20 h-20 glass border-white/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-4">
                                                        <FileSignature className="w-8 h-8" />
                                                    </div>
                                                    <p className="text-[10px] font-black tracking-[0.2em] uppercase">لا توجد اتفاقيات قيد التنفيذ</p>
                                                </div>
                                            )}
                                            {penaltyRules.map((rule, idx) => (
                                                <motion.div
                                                    key={rule.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    className="bg-white dark:bg-[#0a0505]/60 rounded-[2.5rem] p-6 shadow-sm border border-black/5 dark:border-white/5 overflow-hidden relative group"
                                                >
                                                    <div className="flex justify-between items-start mb-5 text-right">
                                                        <div className="flex gap-2">
                                                            <button onClick={() => setConfirmModal({ show: true, type: 'delete_rule', data: rule })} className="text-muted-foreground/20 hover:text-rose-500 transition-colors p-2" title="حذف القانون"><Trash2 className="w-4 h-4" /></button>
                                                            <button onClick={() => setConfirmModal({ show: true, type: 'reset_rule_penalties', data: rule })} className="text-muted-foreground/20 hover:text-blue-500 transition-colors p-2" title="تصفير هذا الاتفاق"><Plus className="w-4 h-4 rotate-45" /></button>
                                                        </div>
                                                        
                                                        <div className="flex items-start gap-4">
                                                            <div className="flex flex-col items-end">
                                                                <h4 className="font-black text-base text-foreground leading-tight mb-2">{rule.title}</h4>
                                                                <span className="text-[9px] font-black text-amber-600 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">{rule.sub_rules?.length || 0} مستويات</span>
                                                            </div>
                                                            <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center shrink-0">
                                                                <FileSignature className="w-5 h-5" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3 pt-5 border-t border-black/5 dark:border-white/5">
                                                        {rule.sub_rules?.map((sr: any) => (
                                                            <div key={sr.id} className="flex flex-col gap-2 p-3 rounded-2xl bg-muted/20 border border-black/5">
                                                                <div className="flex justify-between items-center text-right mb-1">
                                                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-md">{sr.points} نقاط</span>
                                                                    <span className="text-xs font-black">{sr.label}</span>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <Button onClick={() => handleAddPenalty(rule.id, partnerId!, sr.id, sr.points)} disabled={isSubmitting} className="flex-1 bg-emerald-500/10 text-emerald-500 font-bold hover:bg-emerald-500 hover:text-white h-8 rounded-xl text-[9px] uppercase shadow-none border border-emerald-500/20">تغريم {names.partner}</Button>
                                                                    <Button onClick={() => handleAddPenalty(rule.id, userId, sr.id, sr.points)} disabled={isSubmitting} className="flex-1 bg-rose-500/10 text-rose-500 font-bold hover:bg-rose-500 hover:text-white h-8 rounded-xl text-[9px] uppercase shadow-none border border-rose-500/20">أنا أخطأت</Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </>
                                )
                            })()}
                        </motion.div>
                    )}
                    {activeTab === 'commitments' && (
                        <motion.div
                            key="commitments"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div className="flex items-center gap-2 justify-end overflow-x-auto scrollbar-hide pb-2 px-1">
                                {[
                                    { id: 'all', label: 'الكل' },
                                    { id: 'me', label: names.me },
                                    { id: 'partner', label: names.partner }
                                ].map((f) => (
                                    <button
                                        key={f.id}
                                        onClick={() => setFilterType(f.id as any)}
                                        className={`px-4 py-1.5 rounded-full text-[9px] font-black transition-all border ${filterType === f.id ? 'bg-blue-500 text-white border-blue-500' : 'bg-white/40 dark:bg-white/5 text-muted-foreground border-white/40 dark:border-white/5 hover:border-blue-500/50'}`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            {commitments.length === 0 && !loading && (
                                <div className="py-24 text-center space-y-6 opacity-20">
                                    <div className="w-24 h-24 glass border-white/10 rounded-[3rem] flex items-center justify-center mx-auto"><Flame className="w-10 h-10" /></div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">لا توجد التزامات نشطة..</p>
                                </div>
                            )}

                            {commitments
                                .filter(c => {
                                    if (filterType === 'all') return true;
                                    if (filterType === 'both') return false;
                                    if (filterType === 'me') return c.owner_user_id === userId;
                                    if (filterType === 'partner') return c.owner_user_id !== userId;
                                    return true;
                                })
                                .map((c, i) => {
                                    const current = Number(c.current_count) || 0;
                                    const target = Number(c.target_count) || 1;
                                    const progress = Math.min(100, Math.max(0, (current / target) * 100));

                                    return (
                                        <motion.div
                                            key={c.id}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="relative group bg-white dark:bg-[#0a0505]/60 rounded-[2.5rem] p-5 shadow-sm border border-black/5 dark:border-white/5 overflow-hidden hover:shadow-lg transition-all"
                                        >
                                            <div className="flex items-center justify-between mb-4 relative z-10">
                                                <div className="flex items-center gap-3 text-right">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${c.status === 'failed' ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/5 text-blue-500'}`}>
                                                        {c.status === 'failed' ? <XCircle className="w-5 h-5" /> : <Flame className="w-5 h-5" />}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-base font-black text-foreground tracking-tight leading-none mb-1">{c.title}</h3>
                                                        <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">{c.owner_user_id === userId ? names.me : names.partner}</span>
                                                    </div>
                                                </div>

                                                {c.status !== 'failed' && (
                                                    <div className="flex items-center gap-2">
                                                        {isObserver(c.owner_user_id) && (
                                                            <button onClick={() => setConfirmModal({ show: true, type: 'fail_commitment', data: c })} className="w-8 h-8 flex items-center justify-center bg-rose-500/5 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all"><AlertTriangle className="w-3.5 h-3.5" /></button>
                                                        )}
                                                        <button onClick={() => setConfirmModal({ show: true, type: 'delete_commitment', data: c })} className="w-8 h-8 flex items-center justify-center bg-black/5 dark:bg-white/5 text-muted-foreground/40 rounded-xl hover:bg-rose-500 hover:text-white transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                )}
                                            </div>

                                            {c.status === 'failed' ? (
                                                <div className="bg-rose-500/5 border border-rose-500/10 rounded-[1.8rem] p-4 text-center">
                                                    <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest block mb-1">كفارة الغياب</span>
                                                    <p className="text-sm font-bold text-foreground/80">{c.punishment || 'المودة والاعتذار'}</p>
                                                </div>
                                            ) : (
                                                <div className="flex items-end justify-between gap-4">
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex justify-between items-end px-1">
                                                            <span className="text-[10px] font-black text-blue-500/60">{Math.round(progress)}%</span>
                                                            <span className="text-sm font-black text-blue-600">{current}<span className="text-[10px] opacity-40">/{target}</span></span>
                                                        </div>
                                                        <div className="h-2 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                                                            <div style={{ width: `${progress}%` }} className="h-full bg-blue-500 rounded-full transition-all duration-500" />
                                                        </div>
                                                    </div>
                                                    <Button
                                                        onClick={() => handleMarkProgress(c.id, current, target)}
                                                        disabled={current >= target || c.owner_user_id !== userId}
                                                        className={`h-10 px-5 rounded-2xl font-black text-[10px] shadow-lg ${current >= target
                                                            ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 disabled:opacity-100'
                                                            : c.owner_user_id !== userId
                                                                ? 'bg-muted text-muted-foreground shadow-none'
                                                                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                                                            }`}
                                                    >
                                                        {current >= target ? 'مكتمل' : c.owner_user_id !== userId ? 'للشريك' : 'إتمام'}
                                                    </Button>
                                                </div>
                                            )}
                                        </motion.div>
                                    );
                                })}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Modals - Dialogue Wizard */}
            <AnimatePresence>
                {showAddDialogue && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={() => setShowAddDialogue(false)} />
                        <motion.div initial={{ scale: 0.9, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 40, opacity: 0 }} className="relative w-full max-w-md bg-white dark:bg-[#0a0505] rounded-[3.5rem] p-10 shadow-2xl z-10 border border-white/20 overflow-hidden">
                            <div className="flex justify-center gap-2 mb-10">
                                {[1, 2, 3, 4, 5].map(step => (
                                    <div key={step} className={`h-1.5 rounded-full transition-all duration-500 ${step <= dialogueStep ? 'w-10 bg-blue-500' : 'w-2 bg-muted'}`} />
                                ))}
                            </div>
                            <div className="min-h-[360px] flex flex-col">
                                {dialogueStep === 1 && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 text-right">
                                        <h3 className="text-3xl font-black">شو المشكلة؟ 🧐</h3>
                                        <input className="w-full h-16 rounded-2xl bg-muted/40 px-6 text-right font-bold" placeholder="عنوان الموضوع..." value={dialogueForm.title} onChange={e => setDialogueForm({ ...dialogueForm, title: e.target.value })} />
                                        <textarea className="w-full h-36 rounded-3xl bg-muted/40 p-6 text-right font-bold resize-none" placeholder="شوية تفاصيل..." value={dialogueForm.problem} onChange={e => setDialogueForm({ ...dialogueForm, problem: e.target.value })} />
                                    </motion.div>
                                )}
                                {dialogueStep === 2 && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 text-right">
                                        <h3 className="text-3xl font-black">رأيك أنتِ 🌸</h3>
                                        <textarea className="w-full h-64 rounded-[2.5rem] bg-indigo-500/5 p-7 text-right font-bold resize-none italic" placeholder="أنا بشوف إنه..." value={dialogueForm.my_opinion} onChange={e => setDialogueForm({ ...dialogueForm, my_opinion: e.target.value })} />
                                    </motion.div>
                                )}
                                {dialogueStep === 3 && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 text-right">
                                        <h3 className="text-3xl font-black">رأيه هو 🧔🏻‍♂️</h3>
                                        <textarea className="w-full h-64 rounded-[2.5rem] bg-amber-500/5 p-7 text-right font-bold resize-none italic" placeholder="هو حكى إنه..." value={dialogueForm.partner_opinion} onChange={e => setDialogueForm({ ...dialogueForm, partner_opinion: e.target.value })} />
                                    </motion.div>
                                )}
                                {dialogueStep === 4 && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 text-right">
                                        <h3 className="text-3xl font-black">الحل والوعد 🤝</h3>
                                        <textarea className="w-full h-64 rounded-[2.5rem] bg-emerald-500/5 p-7 text-right font-bold resize-none" placeholder="اتفقنا إنه..." value={dialogueForm.solution} onChange={e => setDialogueForm({ ...dialogueForm, solution: e.target.value })} />
                                    </motion.div>
                                )}
                                {dialogueStep === 5 && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 text-right">
                                        <h3 className="text-3xl font-black">مين المسؤول؟ 👤</h3>
                                        <div className="space-y-3">
                                            {['me', 'partner', 'both'].map((type) => (
                                                <button key={type} onClick={() => setDialogueForm({ ...dialogueForm, assignee: type as any })} className={`w-full p-6 rounded-3xl border-2 transition-all text-right flex items-center justify-between ${dialogueForm.assignee === type ? 'border-blue-500 bg-blue-500/10' : 'border-border/40 bg-muted/20'}`}>
                                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${dialogueForm.assignee === type ? 'border-blue-500' : 'border-muted-foreground/30'}`}>{dialogueForm.assignee === type && <div className="w-3 h-3 rounded-full bg-blue-500" />}</div>
                                                    <div><p className="font-black">{type === 'me' ? names.me : type === 'partner' ? names.partner : 'كلينا'}</p></div>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                            <div className="flex gap-4 mt-8">
                                {dialogueStep > 1 && <button onClick={prevStep} className="h-16 px-8 rounded-2xl bg-muted/40 font-black">رجوع</button>}
                                <Button onClick={dialogueStep === 5 ? handleSaveDialogue : nextStep} disabled={isSubmitting} className="flex-1 h-16 rounded-2xl font-black shadow-xl shadow-blue-500/20">{dialogueStep === 5 ? 'حفظ الميثاق ✨' : 'التالي'}</Button>
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
                        <motion.div initial={{ scale: 0.9, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 40, opacity: 0 }} className="relative w-full max-w-md bg-white dark:bg-[#0a0505] rounded-[3.5rem] p-10 shadow-2xl z-10 border border-white/20">
                            <h2 className="text-3xl font-black mb-8 text-right">التزام جديد 💪</h2>
                            <form onSubmit={handleSaveCommitment} className="space-y-6">
                                <div className="space-y-2 text-right"><label className="text-[10px] font-black uppercase opacity-40">شو الالتزام؟</label><input required className="w-full h-16 rounded-2xl bg-muted/40 px-6 text-right font-bold" placeholder="مثلاً: جيم، قراءة..." value={commitmentForm.title} onChange={e => setCommitmentForm({ ...commitmentForm, title: e.target.value })} /></div>
                                <div className="space-y-2 text-right"><label className="text-[10px] font-black uppercase opacity-40">مين صاحب الالتزام؟</label><div className="flex gap-3">{['partner', 'me'].map(t => <button key={t} type="button" onClick={() => setCommitmentForm({ ...commitmentForm, assignee: t as any })} className={`flex-1 h-14 rounded-2xl border-2 font-black transition-all ${commitmentForm.assignee === t ? 'border-blue-500 bg-blue-500/10' : 'border-border/40'}`}>{t === 'partner' ? names.partner : names.me}</button>)}</div></div>
                                <div className="space-y-2 text-right"><label className="text-[10px] font-black uppercase opacity-40">شو العقوبة؟ 😅</label><textarea required className="w-full h-28 rounded-[2rem] bg-muted/40 p-6 text-right font-bold resize-none" placeholder="شوكولاته، مشوار..." value={commitmentForm.punishment} onChange={e => setCommitmentForm({ ...commitmentForm, punishment: e.target.value })} /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2 text-right"><label className="text-[10px] font-black uppercase opacity-40">التكرار</label><select className="w-full h-14 rounded-2xl bg-muted/40 px-5 text-right font-bold appearance-none outline-none" value={commitmentForm.period_type} onChange={e => setCommitmentForm({ ...commitmentForm, period_type: e.target.value as any })}><option value="daily">يومي</option><option value="weekly">أسبوعي</option><option value="monthly">شهري</option></select></div>
                                    <div className="space-y-2 text-right"><label className="text-[10px] font-black uppercase opacity-40">الهدف</label><input type="number" required className="w-full h-14 rounded-2xl bg-muted/40 px-5 text-right font-bold" value={commitmentForm.target_count} onChange={e => setCommitmentForm({ ...commitmentForm, target_count: parseInt(e.target.value) })} /></div>
                                </div>
                                <Button type="submit" disabled={isSubmitting} className="w-full h-16 rounded-[2rem] font-black bg-blue-600 shadow-xl shadow-blue-500/20 mt-4">{isSubmitting ? 'جاري الحفظ...' : 'تثبيت الالتزام 💪'}</Button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal for New Penalty Rule */}
            <AnimatePresence>
                {showAddRule && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={() => setShowAddRule(false)} />
                        <motion.div initial={{ scale: 0.9, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 40, opacity: 0 }} className="relative w-full max-w-md bg-white dark:bg-[#0a0505] rounded-[3.5rem] p-10 shadow-2xl z-10 border border-white/20">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                    <FileSignature className="w-8 h-8" />
                                </div>
                                <h2 className="text-2xl font-black mb-8 text-center">إضافة بند للاتفاقيات 📝</h2>
                            </div>
                            <form onSubmit={handleSaveRule} className="space-y-6">
                                <div className="space-y-2 text-right">
                                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40">ما هو الفعل؟</label>
                                    <textarea required className="w-full h-24 rounded-[2rem] bg-muted/40 p-6 text-right font-bold resize-none leading-relaxed" placeholder="أدخل اسم البند (مثال: المسبات)" value={ruleForm.title} onChange={e => setRuleForm({ ...ruleForm, title: e.target.value })} />
                                </div>
                                <div className="space-y-3 text-right">
                                    <div className="flex justify-between items-center mb-1">
                                        <button type="button" onClick={() => setRuleForm({ ...ruleForm, subRules: [...ruleForm.subRules, { id: Date.now().toString(), label: '', points: 1 }]})} className="text-[10px] text-blue-500 font-bold bg-blue-500/10 px-3 py-1 rounded-full">إضافة مستوى +</button>
                                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40">مستويات الخصم</label>
                                    </div>
                                    <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide pr-1">
                                    {ruleForm.subRules.map((sr, idx) => (
                                        <div key={sr.id} className="flex items-center gap-2">
                                            {ruleForm.subRules.length > 1 && <button type="button" onClick={() => setRuleForm({ ...ruleForm, subRules: ruleForm.subRules.filter(r => r.id !== sr.id)})} className="w-10 h-12 shrink-0 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center"><Trash2 className="w-4 h-4"/></button>}
                                            <div className="flex bg-muted/40 rounded-2xl overflow-hidden p-1 focus-within:ring-2 ring-blue-500 transition-all w-24 shrink-0 h-12">
                                                <input type="number" min="1" required className="w-full bg-transparent px-2 font-black text-center outline-none" value={sr.points} onChange={e => {
                                                    const newSR = [...ruleForm.subRules]; newSR[idx].points = parseInt(e.target.value) || 1; setRuleForm({ ...ruleForm, subRules: newSR });
                                                }} />
                                                <div className="flex items-center px-2 bg-white dark:bg-black/40 rounded-xl text-muted-foreground font-black text-[9px] uppercase">نقاط</div>
                                            </div>
                                            <input required className="flex-1 h-12 rounded-2xl bg-muted/40 px-4 text-right font-bold text-sm outline-none w-full" placeholder="مثال: مسبة قوية" value={sr.label} onChange={e => {
                                                    const newSR = [...ruleForm.subRules]; newSR[idx].label = e.target.value; setRuleForm({ ...ruleForm, subRules: newSR });
                                                }} />
                                        </div>
                                    ))}
                                    </div>
                                    <p className="text-[9px] font-bold text-center text-blue-500/60 pt-2">(10 نقاط = 1 JOD)</p>
                                </div>
                                <Button type="submit" disabled={isSubmitting || !ruleForm.title || ruleForm.subRules.length === 0} className="w-full h-16 rounded-[2rem] font-black bg-blue-600 shadow-xl shadow-blue-500/20 mt-4 text-sm">{isSubmitting ? 'جاري الحفظ...' : 'تثبيت بالدفتر ✨'}</Button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Selected Dialogue Details Modal */}
            <AnimatePresence>
                {selectedDialogue && (
                    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/60 backdrop-blur-3xl" onClick={() => setSelectedDialogue(null)} />
                        <motion.div layoutId={`dialogue-card-${selectedDialogue.id}`} className="w-full h-full max-h-[90vh] overflow-y-auto bg-white/95 dark:bg-[#0a0505]/95 rounded-[4rem] shadow-4xl relative z-10 max-w-lg scrollbar-hide border border-white dark:border-white/10">
                            <div className="sticky top-0 bg-white/10 backdrop-blur-2xl p-8 border-b border-black/5 flex justify-between items-center z-20">
                                <button onClick={() => setSelectedDialogue(null)} className="w-12 h-12 bg-muted/40 rounded-2xl flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></button>
                                <div className="flex items-center gap-4 text-right">
                                    <div><h3 className="font-black text-lg">{selectedDialogue.title}</h3><p className="text-[10px] text-blue-500 font-black uppercase tracking-widest">{selectedDialogue.dialogue_date}</p></div>
                                    <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500"><MessageCircle className="w-6 h-6" /></div>
                                </div>
                            </div>
                            <div className="p-10 space-y-12 pb-24 text-right">
                                <div className="space-y-10 relative">
                                    <div className="absolute top-4 right-[23px] bottom-10 w-1 bg-gradient-to-b from-rose-500/30 via-indigo-500/30 to-emerald-500/30 -z-10 rounded-full blur-[1px]" />
                                    <div className="flex items-start gap-6">
                                        <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-lg relative z-10"><AlertCircle className="w-6 h-6" /></div>
                                        <div className="flex-1"><span className="text-[10px] font-black text-rose-500 uppercase opacity-40">أصل المسألة</span><div className="bg-rose-500/5 p-7 rounded-[2.5rem] mt-2"><p className="font-bold leading-relaxed">{selectedDialogue.problem || selectedDialogue.description}</p></div></div>
                                    </div>
                                    <div className="flex items-start gap-6">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-lg relative z-10"><MessageCircle className="w-6 h-6" /></div>
                                        <div className="space-y-4 w-full">
                                            <div className="bg-indigo-500/5 rounded-[2rem] p-6">
                                                <span className="text-[9px] font-black text-indigo-500 block mb-2">{names.me}</span>
                                                <p className="font-bold italic opacity-80">"{selectedDialogue.my_opinion || '...'}"</p>
                                            </div>
                                            <div className="bg-indigo-500/5 rounded-[2rem] p-6">
                                                <span className="text-[9px] font-black text-indigo-500 block mb-2">{names.partner}</span>
                                                <p className="font-bold italic opacity-80">"{selectedDialogue.partner_opinion || '...'}"</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-6">
                                        <div className="flex flex-col items-center gap-2 relative z-10 shrink-0">
                                            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg"><ShieldCheck className="w-6 h-6" /></div>

                                            {/* Assignee Badge in Modal */}
                                            {(() => {
                                                let assigneeLabel = '';
                                                let assigneeColor = 'bg-gray-100 text-gray-400';

                                                // Try finding assignee from dialogue or agreement
                                                const assigneeType = selectedDialogue.assignee;
                                                const ag = agreements.find(a => (a.origin_dialogue_id === selectedDialogue.id) || (a.title === selectedDialogue.final_agreement));

                                                let finalType = assigneeType;
                                                if (!finalType && ag && ag.assignee) finalType = ag.assignee;

                                                if (finalType) {
                                                    if (finalType === 'both') {
                                                        assigneeLabel = 'عهد مشترك';
                                                        assigneeColor = 'bg-purple-500 text-white';
                                                    } else {
                                                        const creator = selectedDialogue.created_by_user_id;
                                                        let realAssigneeId = '';

                                                        // Resolve 'me'/'partner' relative to creator if needed
                                                        // But usually 'me' means userId if created by me, etc.
                                                        // Let's stick to the logic:
                                                        if (finalType === 'me') realAssigneeId = creator;
                                                        else if (finalType === 'partner') realAssigneeId = (creator === userId ? partnerId : userId) || '';

                                                        if (realAssigneeId === userId) {
                                                            assigneeLabel = 'عهد عليّ';
                                                            assigneeColor = 'bg-blue-500 text-white';
                                                        } else if (realAssigneeId) {
                                                            assigneeLabel = 'عهد عليه/ا';
                                                            assigneeColor = 'bg-rose-500 text-white';
                                                        }
                                                    }
                                                }

                                                if (assigneeLabel) {
                                                    return <span className={`text-[8px] font-black py-1 px-2 rounded-lg ${assigneeColor} shadow-sm whitespace-nowrap`}>{assigneeLabel}</span>;
                                                }
                                                return null;
                                            })()}
                                        </div>
                                        <div className="bg-emerald-500/10 rounded-[3rem] p-10 w-full border-2 border-emerald-500/10">
                                            <span className="text-[10px] font-black text-emerald-500 uppercase block mb-4">آية الاتفاق</span>
                                            <p className="text-2xl font-black">{selectedDialogue.final_agreement || 'سكنٌ ومودة'}</p>
                                        </div>
                                    </div>
                                </div>

                                {(() => {
                                    const ag = agreements.find(a => (a.origin_dialogue_id === selectedDialogue.id) || (a.title === selectedDialogue.final_agreement));
                                    if (ag) return (
                                        <div className="pt-10 border-t border-black/5 space-y-6">
                                            <div className="bg-muted/20 dark:bg-white/5 rounded-[3rem] p-8 space-y-5">
                                                <div className="flex items-center gap-4 justify-end">
                                                    <div><h4 className="font-black text-lg">ميثاق التنفيذ</h4><p className="text-[10px] opacity-40">متابعة سريان الاتفاق</p></div>
                                                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary"><Target className="w-6 h-6" /></div>
                                                </div>
                                                <div className="flex gap-4">
                                                    <div className="flex-1 bg-white dark:bg-black/20 rounded-3xl p-5 border text-center relative group">
                                                        <span className="block text-3xl font-black">{ag.breach_count || 0}</span>
                                                        <span className="text-[10px] font-black opacity-40 uppercase">تجاوز للعهد</span>
                                                        {ag.breach_count > 0 && <button onClick={() => handleReduceBreach(ag)} className="absolute top-2 left-2 w-6 h-6 bg-muted rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Plus className="w-3 h-3 rotate-45" /></button>}
                                                    </div>
                                                    <button onClick={() => setConfirmModal({ show: true, type: 'breach', data: ag })} className="flex-1 bg-rose-500/10 text-rose-500 rounded-3xl font-black text-xs uppercase hover:bg-rose-500 hover:text-white transition-all">تسجيل إخلاف ⚠️</button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                    return null;
                                })()}
                                <button onClick={() => setConfirmModal({ show: true, type: 'delete_dialogue', data: selectedDialogue })} className="w-full py-6 text-rose-500/40 hover:text-rose-500 font-black text-[10px] uppercase">إلغاء أرشفة الجلسة</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Confirmation Modal */}
            <AnimatePresence>
                {confirmModal?.show && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setConfirmModal(null)} />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-[320px] bg-white dark:bg-[#0a0505] rounded-[3rem] p-10 text-center z-10 border">
                            <div className="w-20 h-20 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-6"><AlertTriangle className="w-10 h-10" /></div>
                            <h3 className="text-2xl font-black mb-4">هل أنت متأكد؟</h3>
                            <p className="text-xs opacity-60 mb-8 uppercase font-black">هذا القرار قد يؤثر على سجل المودة.. هل نعتمد القرار؟</p>
                            <div className="flex flex-col gap-3">
                                <Button className="h-16 rounded-2xl bg-rose-600 font-black" onClick={() => {
                                    if (confirmModal.type === 'breach') handleBreach(confirmModal.data);
                                    else if (confirmModal.type === 'fail_commitment') handleCommitmentFail(confirmModal.data);
                                    else if (confirmModal.type === 'delete_dialogue') handleDeleteDialogue(confirmModal.data);
                                    else if (confirmModal.type === 'delete_agreement') handleDeleteAgreement(confirmModal.data);
                                    else if (confirmModal.type === 'delete_commitment') handleDeleteCommitment(confirmModal.data);
                                    else if (confirmModal.type === 'delete_rule') handleDeleteRule(confirmModal.data);
                                    else if (confirmModal.type === 'reset_penalties') handleResetPenalties();
                                    else if (confirmModal.type === 'reset_rule_penalties') handleResetPenalties(confirmModal.data.id);
                                }}>نعم، اعتمد</Button>
                                <button className="h-12 font-black text-[10px] opacity-40 uppercase" onClick={() => setConfirmModal(null)}>تراجع</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
