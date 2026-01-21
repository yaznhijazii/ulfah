import { ArrowLeft, Plus, Heart, CheckCircle2, X, Trash2, ShieldCheck, Target, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Promise as PromiseType, Rule, Task } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

interface PromisesScreenProps {
  onNavigate: (screen: string) => void;
  userId: string;
  partnershipId: string | null;
}

export function PromisesScreen({ onNavigate, userId, partnershipId }: PromisesScreenProps) {
  const [activeTab, setActiveTab] = useState<'promises' | 'rules' | 'tasks'>('promises');
  const [promises, setPromises] = useState<PromiseType[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formText, setFormText] = useState('');

  useEffect(() => {
    if (partnershipId) loadData();
  }, [partnershipId]);

  const loadData = async () => {
    if (!partnershipId) return;
    try {
      const { data: promisesData } = await supabase.from('promises').select('*').eq('partnership_id', partnershipId).eq('is_active', true).order('created_at', { ascending: false });
      const { data: rulesData } = await supabase.from('rules').select('*').eq('partnership_id', partnershipId).eq('is_active', true).order('created_at', { ascending: false });
      const { data: tasksData } = await supabase.from('tasks').select('*').eq('partnership_id', partnershipId).order('created_at', { ascending: false });
      if (promisesData) setPromises(promisesData);
      if (rulesData) setRules(rulesData);
      if (tasksData) setTasks(tasksData);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (table: string, id: string) => {
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (!error) {
        if (table === 'promises') setPromises(promises.filter(p => p.id !== id));
        else if (table === 'rules') setRules(rules.filter(r => r.id !== id));
        else if (table === 'tasks') setTasks(tasks.filter(t => t.id !== id));
      }
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const handleToggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newStatus = !task.is_completed;
    try {
      const { error } = await supabase.from('tasks').update({ is_completed: newStatus, completed_by_user_id: newStatus ? userId : null, completed_at: newStatus ? new Date().toISOString() : null }).eq('id', id);
      if (!error) setTasks(tasks.map(t => t.id === id ? { ...t, is_completed: newStatus } : t));
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  const handleAddItem = async () => {
    if (!formText.trim()) return;
    try {
      let result;
      if (activeTab === 'promises') result = await supabase.from('promises').insert({ partnership_id: partnershipId, promise_text: formText, is_active: true }).select().single();
      else if (activeTab === 'rules') result = await supabase.from('rules').insert({ partnership_id: partnershipId, rule_text: formText, is_active: true }).select().single();
      else result = await supabase.from('tasks').insert({ partnership_id: partnershipId, task_text: formText }).select().single();

      if (result.data) {
        if (activeTab === 'promises') setPromises([result.data as PromiseType, ...promises]);
        else if (activeTab === 'rules') setRules([result.data as Rule, ...rules]);
        else setTasks([result.data as Task, ...tasks]);
      }
    } catch (err) {
      console.error('Error adding item:', err);
    } finally {
      setFormText('');
      setShowAddForm(false);
    }
  };

  if (!partnershipId) {
    return (
      <div className="flex-1 bg-background flex flex-col items-center justify-center p-10 text-center">
        <div className="w-24 h-24 rounded-[2.5rem] glass-dark border-white/5 flex items-center justify-center mb-8 shadow-2xl">
          <ShieldCheck className="w-12 h-12 text-primary/40" />
        </div>
        <h2 className="text-2xl font-black mb-3 tracking-tighter">ميثاق المودة</h2>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mb-10 leading-relaxed">يرجى إتمام ربط الشريك لتفعيل بنود هذا الميثاق المقدس</p>
        <Button onClick={() => onNavigate('settings')} className="w-full h-16 bg-primary text-white rounded-[2rem] shadow-2xl shadow-primary/20 text-sm font-black uppercase tracking-widest leading-none">إتمام الربط الآن</Button>
      </div>
    );
  }

  const tabs = [
    { id: 'promises', label: 'وعودنا', icon: Heart, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { id: 'rules', label: 'قواعدنا', icon: ShieldCheck, color: 'text-sky-500', bg: 'bg-sky-500/10' },
    { id: 'tasks', label: 'مهامنا', icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className="flex-1 bg-background flex flex-col relative h-full overflow-hidden">
      <header className="px-8 pt-12 pb-6 sticky top-0 bg-background/60 backdrop-blur-3xl z-30">
        <div className="flex items-center justify-between mb-10">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => onNavigate('home')} className="w-12 h-12 flex items-center justify-center glass rounded-2xl border-white/20 shadow-sm text-foreground/70">
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <div className="text-center">
            <h1 className="text-xl font-black text-foreground tracking-tight">ميثاقنا</h1>
            <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em]">بنود المحبة.. وعهود السكينة</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowAddForm(true)}
            className="w-12 h-12 glass border-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-lg shadow-primary/5"
          >
            <Plus className="w-6 h-6" />
          </motion.button>
        </div>

        <div className="flex glass-dark border-white/5 p-1.5 rounded-[2.2rem] max-w-[340px] mx-auto relative overflow-hidden">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[1.8rem] transition-all relative z-10 ${isActive ? 'text-white' : 'text-muted-foreground/40'}`}
              >
                {isActive && <motion.div layoutId="tab-pill" className="absolute inset-0 bg-primary rounded-[1.8rem] shadow-xl shadow-primary/20 z-[-1]" />}
                <tab.icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-muted-foreground/30'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6 pb-40 scrollbar-hide">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-24">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-xl shadow-primary/10" />
            </motion.div>
          ) : (
            <motion.div
              key={activeTab} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              {(activeTab === 'promises' ? promises : activeTab === 'rules' ? rules : tasks).length === 0 ? (
                <div className="text-center py-24 space-y-8 glass rounded-[3.5rem] border-white/10 opacity-30">
                  <div className="w-20 h-20 glass-dark border-white/5 rounded-[2rem] flex items-center justify-center mx-auto">
                    <Sparkles className="w-10 h-10" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] leading-relaxed">لم يتم تدوين أي عهد بعد..</p>
                </div>
              ) : (
                (activeTab === 'promises' ? promises : activeTab === 'rules' ? rules : tasks).map((item: any, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`glass-dark rounded-[2.5rem] p-7 shadow-2xl shadow-black/5 border relative overflow-hidden flex items-start gap-5 group ${activeTab === 'tasks' && item.is_completed ? 'opacity-40 border-white/5' : 'border-white/10'}`}
                  >
                    <div className="w-10 h-10 rounded-2xl glass-dark border-white/5 flex items-center justify-center text-primary/40 group-hover:text-primary transition-colors shrink-0">
                      {activeTab === 'promises' ? <Heart className="w-4 h-4 fill-current" /> : activeTab === 'rules' ? <ShieldCheck className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                    </div>

                    <div className="flex-1 text-right">
                      <p className={`text-base font-bold leading-relaxed tracking-tight ${activeTab === 'tasks' && item.is_completed ? 'line-through opacity-50' : 'text-foreground'}`}>
                        {activeTab === 'promises' ? item.promise_text : activeTab === 'rules' ? item.rule_text : item.task_text}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 shrink-0">
                      {activeTab === 'tasks' && (
                        <motion.button
                          whileTap={{ scale: 0.8 }}
                          onClick={() => handleToggleTask(item.id)}
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${item.is_completed ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'glass border-white/10 text-muted-foreground/30'}`}
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </motion.button>
                      )}
                      <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={() => handleDelete(activeTab === 'promises' ? 'promises' : activeTab === 'rules' ? 'rules' : 'tasks', item.id)}
                        className="w-10 h-10 rounded-2xl glass border-rose-500/10 text-rose-500/30 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-2xl" onClick={() => setShowAddForm(false)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="relative w-full max-w-md glass border-white/30 rounded-[3.5rem] p-10 z-10 space-y-8 shadow-2xl"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 glass-dark border-white/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
                  <Plus className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-foreground tracking-tighter">إضافة بند للميثاق</h2>
                <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">اكتب {activeTab === 'promises' ? 'وعداً' : activeTab === 'rules' ? 'قاعدة' : 'مهمة'} بعناية</p>
              </div>

              <textarea
                value={formText} onChange={(e) => setFormText(e.target.value)} autoFocus
                placeholder="..."
                className="w-full min-h-[160px] glass-dark border-white/10 rounded-[2.5rem] p-8 font-bold text-right outline-none resize-none text-lg placeholder:text-muted-foreground/20 italic"
              />

              <div className="flex gap-4">
                <button
                  className="flex-1 h-16 rounded-[2rem] glass border-white/10 text-muted-foreground font-black text-xs uppercase tracking-widest hover:bg-white/5 transition-all"
                  onClick={() => setShowAddForm(false)}
                >
                  تراجع
                </button>
                <Button
                  disabled={!formText.trim()}
                  onClick={handleAddItem}
                  className="flex-[2] h-16 bg-primary text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-primary/20 disabled:opacity-30 leading-none"
                >
                  إضافة للميثاق ✨
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}