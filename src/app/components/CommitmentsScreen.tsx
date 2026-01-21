import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { ArrowLeft, Plus, Target, Trophy, AlertCircle, Heart, Trash2, CheckCircle2, Flame } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Commitment } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

interface CommitmentsScreenProps {
  onBack: () => void;
  userId: string;
  partnershipId: string | null;
  isDarkMode?: boolean;
}

export function CommitmentsScreen({ onBack, userId, partnershipId, isDarkMode }: CommitmentsScreenProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [selectedCommitment, setSelectedCommitment] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    target_count: 5,
    period_type: 'weekly' as 'daily' | 'weekly' | 'monthly',
    punishment: '',
  });

  useEffect(() => {
    if (partnershipId) {
      loadCommitments();
    }
  }, [partnershipId]);

  const loadCommitments = async () => {
    if (!partnershipId) return;
    try {
      const { data, error } = await supabase
        .from('commitments')
        .select('*')
        .eq('partnership_id', partnershipId)
        .order('created_at', { ascending: false });

      if (!error && data) setCommitments(data);
    } catch (err) {
      console.error('Error loading commitments:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'on-track': return 'bg-sky-500/10 text-sky-500 border-sky-500/20';
      case 'at-risk': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'failed': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default: return 'bg-muted/30 text-muted-foreground border-border/50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'مكتمل';
      case 'on-track': return 'مستمر';
      case 'at-risk': return 'متأخر';
      case 'failed': return 'تعثر';
      default: return '';
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('commitments').delete().eq('id', id);
      if (!error) setCommitments(commitments.filter(c => c.id !== id));
    } catch (err) {
      console.error('Error deleting commitment:', err);
    }
    setShowDeleteConfirm(false);
    setSelectedCommitment(null);
  };

  const handleMarkComplete = async (id: string) => {
    const commitment = commitments.find(c => c.id === id);
    if (!commitment) return;
    const newCount = Math.min(commitment.current_count + 1, commitment.target_count);
    try {
      const { error } = await supabase.from('commitments').update({ current_count: newCount }).eq('id', id);
      if (!error) setCommitments(commitments.map(c => c.id === id ? { ...c, current_count: newCount } : c));
    } catch (err) {
      console.error('Error updating commitment:', err);
    }
  };

  const handleAddCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnershipId || !formData.title) return;
    try {
      const { data, error } = await supabase
        .from('commitments')
        .insert([{
          partnership_id: partnershipId,
          created_by_user_id: userId,
          owner_user_id: userId,
          ...formData,
          current_count: 0,
          start_date: new Date().toISOString().split('T')[0],
          is_active: true,
          status: 'on-track',
        }])
        .select()
        .single();

      if (!error && data) {
        setCommitments([data, ...commitments]);
        setShowAddForm(false);
        setFormData({ title: '', description: '', target_count: 5, period_type: 'weekly', punishment: '' });
      }
    } catch (err) {
      console.error('Error adding commitment:', err);
    }
  };

  if (!partnershipId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-background">
        <div className="w-20 h-20 rounded-3xl bg-accent/30 flex items-center justify-center mb-5">
          <Target className="w-10 h-10 text-primary" strokeWidth={1.5} />
        </div>
        <h2 className="text-xl font-bold mb-2">التزامات متبادلة</h2>
        <p className="text-[10px] font-black text-muted-foreground mb-6 text-foreground">الرجاء ربط الشريك أولاً من الإعدادات لنشر الالتزامات بينكما.</p>
        <Button onClick={onBack} className="w-full h-12 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 font-black">العودة</Button>
      </div>
    );
  }

  const activeCommitments = commitments.filter(c => c.is_active);
  const completedCount = commitments.filter(c => c.status === 'completed').length;
  const streakDays = 7;

  return (
    <div className="flex-1 bg-background flex flex-col relative h-screen overflow-hidden mood-dialogue">
      {/* Covenants Atmospheric Blue Aura */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[100%] h-[60%] bg-blue-500/10 blur-[150px] rounded-full opacity-60" />
      </div>

      <header className="px-8 pt-12 pb-6 flex items-center justify-between sticky top-0 bg-background/40 backdrop-blur-3xl z-40">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="w-14 h-14 flex items-center justify-center glass rounded-3xl border-white/60 shadow-xl text-foreground/40"
        >
          <ArrowLeft className="w-6 h-6" />
        </motion.button>
        <div className="text-center">
          <h1 className="text-2xl font-black text-foreground tracking-tighter">مواثيقنا</h1>
          <p className="text-[9px] font-black text-blue-600/40 uppercase tracking-[0.5em]">عهود تبني جسور المودة</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddForm(true)}
          className="w-14 h-14 flex items-center justify-center bg-blue-500 text-white rounded-3xl shadow-2xl shadow-blue-500/30 border-t border-white/30"
        >
          <Plus className="w-8 h-8" />
        </motion.button>
      </header>

      <div className="flex-1 px-6 py-8 space-y-8 overflow-y-auto pb-32">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card rounded-[2.5rem] p-6 shadow-xl shadow-black/[0.02] border border-border/50 relative overflow-hidden group">
            <div className="absolute -right-2 -bottom-2 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors" />
            <div className="flex items-center gap-3 mb-3 relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-inner"><Target className="w-5 h-5" /></div>
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">جارية</span>
            </div>
            <p className="text-3xl font-black text-foreground relative z-10">{activeCommitments.length}</p>
          </div>
          <div className="bg-card rounded-[2.5rem] p-6 shadow-xl shadow-black/[0.02] border border-border/50 relative overflow-hidden group">
            <div className="absolute -right-2 -bottom-2 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors" />
            <div className="flex items-center gap-3 mb-3 relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-inner"><Trophy className="w-5 h-5" /></div>
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">انجزت</span>
            </div>
            <p className="text-3xl font-black text-foreground relative z-10">{completedCount}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">قائمة المواثيق</h2>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-500/10 rounded-full border border-orange-500/20">
              <Flame className="w-3 h-3 text-orange-500" />
              <span className="text-[9px] font-black text-orange-600 dark:text-orange-400">ستريك لـ {streakDays} أيام</span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" /></div>
          ) : activeCommitments.length === 0 ? (
            <div className="bg-muted/30 border-2 border-dashed border-border/50 rounded-[3rem] p-16 text-center flex flex-col items-center">
              <div className="w-20 h-20 bg-muted/50 rounded-[2rem] flex items-center justify-center mb-4"><Target className="w-8 h-8 text-muted-foreground/30" /></div>
              <p className="text-xs text-muted-foreground font-black">لا توجد عهود حالية</p>
            </div>
          ) : (
            <div className="space-y-5">
              {activeCommitments.map((commitment, idx) => (
                <motion.div
                  key={commitment.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-card rounded-[2.5rem] p-6 shadow-xl shadow-black/[0.02] border border-border/50 relative overflow-hidden group"
                >
                  <div className="flex items-start justify-between mb-5 relative z-10">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-blue-500/5 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                        <Heart className="w-6 h-6" />
                      </div>
                      <div className="text-right">
                        <h3 className="font-black text-xl text-foreground mb-1 leading-tight">{commitment.title}</h3>
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black border uppercase tracking-widest ${getStatusColor(commitment.status)}`}>
                          {getStatusText(commitment.status)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => { setSelectedCommitment(commitment.id); setShowDeleteConfirm(true); }}
                      className="w-10 h-10 flex items-center justify-center bg-destructive/10 text-destructive rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="bg-muted/30 rounded-2xl p-4 mb-5 border border-border/10">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">مستوى التقدم</span>
                      <span className="text-xs font-black text-foreground">
                        {commitment.current_count} من {commitment.target_count}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(commitment.current_count / commitment.target_count) * 100}%` }}
                        className="h-full bg-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex -space-x-2 flex-row-reverse">
                      <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground border-2 border-card flex items-center justify-center text-[10px] font-black">Y</div>
                      <div className="w-8 h-8 rounded-full bg-blue-500 text-white border-2 border-card flex items-center justify-center text-[10px] font-black">M</div>
                    </div>
                    <Button
                      onClick={() => handleMarkComplete(commitment.id)}
                      disabled={commitment.current_count >= commitment.target_count}
                      className="flex-1 h-12 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border-none rounded-2xl font-black text-xs transition-all active:scale-95 disabled:opacity-30"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      تسجيل إنجاز
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddForm(false)} />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative w-full max-w-sm bg-card rounded-[3rem] p-8 shadow-2xl z-10 border border-border/50 overflow-y-auto max-h-[85vh]">
              <h2 className="text-2xl font-black mb-6 text-foreground text-right">ميثاق جديد</h2>
              <form onSubmit={handleAddCommitment} className="space-y-6">
                <div className="space-y-2 text-right">
                  <label className="text-[11px] font-black text-muted-foreground uppercase mr-1">موضوع العهد</label>
                  <input required className="w-full h-14 rounded-2xl bg-muted/30 border-none text-sm font-bold px-5 text-right text-foreground" placeholder="..." value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                </div>
                <div className="space-y-2 text-right">
                  <label className="text-[11px] font-black text-muted-foreground uppercase mr-1">التكرار المطلوب</label>
                  <input type="number" required min="1" className="w-full h-14 rounded-2xl bg-muted/30 border-none text-sm font-bold px-5 text-right text-foreground" value={formData.target_count} onChange={e => setFormData({ ...formData, target_count: parseInt(e.target.value) })} />
                </div>
                <div className="space-y-2 text-right">
                  <label className="text-[11px] font-black text-muted-foreground uppercase mr-1">نوع الميثاق</label>
                  <select className="w-full h-14 rounded-2xl bg-muted/30 border-none text-sm font-bold px-5 appearance-none text-right text-foreground" value={formData.period_type} onChange={e => setFormData({ ...formData, period_type: e.target.value as any })}>
                    <option value="daily" className="bg-card">يومي</option>
                    <option value="weekly" className="bg-card">أسبوعي</option>
                    <option value="monthly" className="bg-card">شهري</option>
                  </select>
                </div>
                <div className="space-y-2 text-right">
                  <label className="text-[11px] font-black text-rose-500 uppercase mr-1">الفدية (في حال التقصير)</label>
                  <input className="w-full h-14 rounded-2xl bg-rose-500/5 border border-rose-500/10 text-sm font-bold px-5 text-right text-foreground" placeholder="مثلاً: التصدق بمبلغ بسيط..." value={formData.punishment} onChange={e => setFormData({ ...formData, punishment: e.target.value })} />
                </div>
                <Button type="submit" className="w-full h-16 rounded-2xl text-base font-black shadow-lg shadow-blue-500/20 mt-4 bg-blue-600">بناء الميثاق</Button>
              </form>
            </motion.div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-5">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative w-full max-w-[320px] bg-card rounded-[3rem] p-8 shadow-2xl z-10 text-center border border-border/50">
              <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner"><AlertCircle className="w-8 h-8" /></div>
              <h3 className="text-xl font-black mb-2 text-foreground">حذف الميثاق؟</h3>
              <p className="text-xs font-bold text-muted-foreground mb-8 text-foreground/70 px-4">هل أنت متأكد؟ سيتم حذف هذا العهد ولا يمكن استعادته.</p>
              <div className="flex flex-col gap-3">
                <Button variant="destructive" className="w-full h-14 rounded-2xl font-black text-xs shadow-lg" onClick={() => selectedCommitment && handleDelete(selectedCommitment)}>نعم، احذف</Button>
                <button className="w-full h-12 rounded-2xl font-black text-xs text-muted-foreground hover:bg-muted/30 transition-colors" onClick={() => setShowDeleteConfirm(false)}>تراجع</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}