import { ArrowLeft, Plus, Heart, CheckCircle2, X, Trash2, ShieldCheck, Target, Sparkles } from 'lucide-react';
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
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-background">
        <div className="w-20 h-20 rounded-3xl bg-accent/30 flex items-center justify-center mb-5"><ShieldCheck className="w-10 h-10 text-primary" strokeWidth={1.5} /></div>
        <h2 className="text-xl font-bold mb-2">ميثاق العلاقة</h2>
        <p className="text-muted-foreground mb-6 text-sm">الرجاء ربط الشريك أولاً من الإعدادات للبدء في كتابة وعودكما.</p>
        <Button onClick={() => onNavigate('settings')} className="w-full h-12 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 text-md font-bold">الذهاب للإعدادات</Button>
      </div>
    );
  }

  const tabs = [
    { id: 'promises', label: 'وعودنا', icon: Heart, color: 'text-rose-500' },
    { id: 'rules', label: 'قواعدنا', icon: ShieldCheck, color: 'text-sky-500' },
    { id: 'tasks', label: 'مهامنا', icon: Target, color: 'text-emerald-500' },
  ];

  return (
    <div className="flex-1 bg-background flex flex-col relative overflow-hidden">
      <header className="px-5 pt-5 pb-2 sticky top-0 bg-background/80 backdrop-blur-xl z-20">
        <div className="flex items-center justify-between mb-4">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => onNavigate('home')} className="w-9 h-9 flex items-center justify-center bg-white rounded-xl shadow-sm border border-border">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </motion.button>
          <h1 className="text-lg font-black">ميثاقنا</h1>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowAddForm(true)} className="bg-primary text-white w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Plus className="w-5 h-5" />
          </motion.button>
        </div>

        <div className="flex p-1 bg-muted/30 rounded-xl mb-1.5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg transition-all relative ${isActive ? 'text-primary' : 'text-muted-foreground font-black'}`}
              >
                {isActive && <motion.div layoutId="tab-pill" className="absolute inset-0 bg-white rounded-lg shadow-sm z-0" />}
                <tab.icon className={`w-3.5 h-3.5 z-10 ${isActive ? tab.color : ''}`} />
                <span className="text-[10px] font-black z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-3 pb-28">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-16"><div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" /></motion.div>
          ) : (
            <motion.div
              key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {(activeTab === 'promises' ? promises : activeTab === 'rules' ? rules : tasks).length === 0 ? (
                <div className="text-center py-16 space-y-3 bg-white/50 border border-dashed border-border rounded-3xl">
                  <Sparkles className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                  <p className="text-xs text-muted-foreground font-black">لا يوجد محتوى هنا بعد، ابدأ بالإضافة!</p>
                </div>
              ) : (
                (activeTab === 'promises' ? promises : activeTab === 'rules' ? rules : tasks).map((item: any, idx) => (
                  <motion.div
                    key={item.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                    className={`bg-white rounded-2xl p-4 shadow-xl shadow-black/5 border border-border group relative flex items-start gap-3 ${activeTab === 'tasks' && item.is_completed ? 'opacity-60 bg-muted/10' : ''}`}
                  >
                    <div className="flex-1 text-right">
                      <p className={`text-xs font-black leading-relaxed ${activeTab === 'tasks' && item.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {activeTab === 'promises' ? item.promise_text : activeTab === 'rules' ? item.rule_text : item.task_text}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {activeTab === 'tasks' && (
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleToggleTask(item.id)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${item.is_completed ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                          <CheckCircle2 className="w-4 h-4" />
                        </motion.button>
                      )}
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDelete(activeTab === 'promises' ? 'promises' : activeTab === 'rules' ? 'rules' : 'tasks', item.id)} className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3.5 h-3.5" />
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowAddForm(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 z-10 space-y-4"
            >
              <div className="text-center space-y-1">
                <h2 className="text-lg font-black text-foreground">إضافة جديدة</h2>
                <p className="text-[10px] font-black text-muted-foreground">اكتب {activeTab === 'promises' ? 'وعداً' : activeTab === 'rules' ? 'قاعدة' : 'مهمة'} لشريكك</p>
              </div>

              <textarea
                value={formText} onChange={(e) => setFormText(e.target.value)} autoFocus
                placeholder="..."
                className="w-full min-h-[100px] bg-muted/30 border-none rounded-2xl p-4 font-black text-right outline-none resize-none text-sm placeholder:text-muted-foreground/50"
              />

              <div className="flex gap-2.5">
                <Button variant="outline" className="flex-1 h-11 rounded-xl font-bold text-sm" onClick={() => setShowAddForm(false)}>إلغاء</Button>
                <Button disabled={!formText.trim()} onClick={handleAddItem} className="flex-1 h-11 bg-primary text-white rounded-xl font-black text-sm shadow-lg shadow-primary/30 disabled:opacity-50">إضافة</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}