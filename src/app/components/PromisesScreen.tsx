import { ArrowLeft, Plus, Heart, CheckCircle2, X, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Promise, Rule, Task } from '../../lib/supabase';

interface PromisesScreenProps {
  onNavigate: (screen: string) => void;
  userId: string;
  partnershipId: string | null;
}

export function PromisesScreen({ onNavigate, userId, partnershipId }: PromisesScreenProps) {
  const [activeTab, setActiveTab] = useState<'promises' | 'rules' | 'tasks'>('promises');
  const [promises, setPromises] = useState<Promise[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formText, setFormText] = useState('');

  useEffect(() => {
    if (partnershipId) {
      loadData();
    }
  }, [partnershipId]);

  const loadData = async () => {
    if (!partnershipId) return;

    try {
      // تحميل الوعود
      const { data: promisesData } = await supabase
        .from('promises')
        .select('*')
        .eq('partnership_id', partnershipId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // تحميل القواعد
      const { data: rulesData } = await supabase
        .from('rules')
        .select('*')
        .eq('partnership_id', partnershipId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // تحميل المهام
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('partnership_id', partnershipId)
        .order('created_at', { ascending: false });

      if (promisesData) setPromises(promisesData);
      if (rulesData) setRules(rulesData);
      if (tasksData) setTasks(tasksData);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePromise = async (id: string) => {
    try {
      const { error } = await supabase
        .from('promises')
        .delete()
        .eq('id', id);

      if (!error) {
        setPromises(promises.filter(p => p.id !== id));
      }
    } catch (err) {
      console.error('Error deleting promise:', err);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('rules')
        .delete()
        .eq('id', id);

      if (!error) {
        setRules(rules.filter(r => r.id !== id));
      }
    } catch (err) {
      console.error('Error deleting rule:', err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

      if (!error) {
        setTasks(tasks.filter(t => t.id !== id));
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const handleToggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const newStatus = !task.is_completed;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          is_completed: newStatus,
          completed_by_user_id: newStatus ? userId : null,
          completed_at: newStatus ? new Date().toISOString() : null,
        })
        .eq('id', id);

      if (!error) {
        setTasks(tasks.map(t => t.id === id ? { ...t, is_completed: newStatus } : t));
      }
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  const handleAddItem = async () => {
    if (!formText.trim()) return;

    try {
      let newData: Promise | Rule | Task | null = null;

      if (activeTab === 'promises') {
        const { data } = await supabase
          .from('promises')
          .insert({
            partnership_id: partnershipId,
            promise_text: formText,
            is_active: true,
          })
          .select()
          .single();

        newData = data;
      } else if (activeTab === 'rules') {
        const { data } = await supabase
          .from('rules')
          .insert({
            partnership_id: partnershipId,
            rule_text: formText,
            is_active: true,
          })
          .select()
          .single();

        newData = data;
      } else if (activeTab === 'tasks') {
        const { data } = await supabase
          .from('tasks')
          .insert({
            partnership_id: partnershipId,
            task_text: formText,
          })
          .select()
          .single();

        newData = data;
      }

      if (newData) {
        if (activeTab === 'promises') {
          setPromises([...promises, newData as Promise]);
        } else if (activeTab === 'rules') {
          setRules([...rules, newData as Rule]);
        } else if (activeTab === 'tasks') {
          setTasks([...tasks, newData as Task]);
        }
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
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50 pb-24 flex items-center justify-center p-6">
        <div className="text-center">
          <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">الرجاء ربط الشريك أولاً من الإعدادات</p>
          <Button
            onClick={() => onNavigate('settings')}
            className="bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white rounded-2xl"
          >
            الذهاب إلى الإعدادات
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50 pb-24">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              size="sm"
              className="bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="w-4 h-4 ml-1" />
              إضافة
            </Button>
            <h1 className="text-lg text-gray-800">التزاماتنا</h1>
            <button
              onClick={() => onNavigate('home')}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setActiveTab('promises')}
              className={`py-2 rounded-xl text-xs transition-all ${
                activeTab === 'promises'
                  ? 'bg-gradient-to-r from-pink-400 to-rose-400 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              الوعود
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`py-2 rounded-xl text-xs transition-all ${
                activeTab === 'rules'
                  ? 'bg-gradient-to-r from-pink-400 to-rose-400 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              القواعد
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`py-2 rounded-xl text-xs transition-all ${
                activeTab === 'tasks'
                  ? 'bg-gradient-to-r from-pink-400 to-rose-400 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              المهام
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">جاري التحميل...</p>
          </div>
        ) : (
          <>
            {/* Promises Tab */}
            {activeTab === 'promises' && (
              <div className="space-y-3">
                {promises.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">لا توجد وعود بعد</p>
                  </div>
                ) : (
                  promises.map((promise) => (
                    <div
                      key={promise.id}
                      className="bg-white rounded-2xl shadow-md p-5 flex items-start gap-4"
                    >
                      <p className="flex-1 text-gray-700 pt-2 text-right">{promise.promise_text}</p>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-100 to-rose-200 flex items-center justify-center flex-shrink-0">
                        <Heart className="w-5 h-5 text-rose-600" fill="currentColor" />
                      </div>
                      <button
                        onClick={() => handleDeletePromise(promise.id)}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Rules Tab */}
            {activeTab === 'rules' && (
              <div className="space-y-3">
                {rules.length === 0 ? (
                  <div className="text-center py-12">
                    <X className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">لا توجد قواعد بعد</p>
                  </div>
                ) : (
                  rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="bg-white rounded-2xl shadow-md p-5 flex items-start gap-4"
                    >
                      <p className="flex-1 text-gray-700 pt-2 text-right">{rule.rule_text}</p>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0">
                        <X className="w-5 h-5 text-blue-600" />
                      </div>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tasks Tab */}
            {activeTab === 'tasks' && (
              <div className="space-y-3">
                {tasks.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">لا توجد مهام بعد</p>
                  </div>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`bg-white rounded-2xl shadow-md p-5 flex items-start gap-4 ${
                        task.is_completed ? 'opacity-60' : ''
                      }`}
                    >
                      <p className={`flex-1 pt-2 text-right ${task.is_completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                        {task.task_text}
                      </p>
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          task.is_completed
                            ? 'bg-green-100'
                            : 'bg-gradient-to-br from-purple-100 to-purple-200'
                        }`}
                      >
                        <CheckCircle2
                          className={`w-5 h-5 ${task.is_completed ? 'text-green-600' : 'text-purple-600'}`}
                        />
                      </div>
                      <button
                        onClick={() => handleToggleTask(task.id)}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                      >
                        <CheckCircle2 className="w-5 h-5 text-gray-600" />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" dir="rtl">
          <div className="bg-white p-6 rounded-3xl shadow-lg max-w-md w-full">
            <h2 className="text-xl mb-4 text-gray-800 text-center">
              إضافة {activeTab === 'promises' ? 'وعد' : activeTab === 'rules' ? 'قاعدة' : 'مهمة'} جديد
            </h2>
            
            <div className="space-y-4">
              <textarea
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
                placeholder={`اكتب ${activeTab === 'promises' ? 'الوعد' : activeTab === 'rules' ? 'القاعدة' : 'المهمة'} هنا...`}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-right min-h-[100px]"
                rows={4}
                autoFocus
              />
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => {
                  setShowAddForm(false);
                  setFormText('');
                }}
                className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-2xl"
              >
                إلغاء
              </Button>
              <Button
                onClick={handleAddItem}
                disabled={!formText.trim()}
                className="flex-1 bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white rounded-2xl disabled:opacity-50"
              >
                إضافة
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}