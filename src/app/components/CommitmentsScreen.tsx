import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { ArrowRight, Plus, Target, Trophy, AlertCircle, Heart } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Commitment } from '../../lib/supabase';

interface CommitmentsScreenProps {
  onBack: () => void;
  userId: string;
  partnershipId: string | null;
}

export function CommitmentsScreen({ onBack, userId, partnershipId }: CommitmentsScreenProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [selectedCommitment, setSelectedCommitment] = useState<Commitment | null>(null);
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

      if (!error && data) {
        setCommitments(data);
      }
    } catch (err) {
      console.error('Error loading commitments:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-50 border-green-200 text-green-700';
      case 'on-track': return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'at-risk': return 'bg-orange-50 border-orange-200 text-orange-700';
      case 'failed': return 'bg-red-50 border-red-200 text-red-700';
      default: return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'مكتمل';
      case 'on-track': return 'على المسار الصحيح';
      case 'at-risk': return 'في خطر';
      case 'failed': return 'فشل';
      default: return '';
    }
  };

  const getPeriodText = (period: string) => {
    switch (period) {
      case 'daily': return 'يومي';
      case 'weekly': return 'أسبوعي';
      case 'monthly': return 'شهري';
      default: return '';
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('commitments')
        .delete()
        .eq('id', id);

      if (!error) {
        setCommitments(commitments.filter(c => c.id !== id));
      }
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
      const { error } = await supabase
        .from('commitments')
        .update({ current_count: newCount })
        .eq('id', id);

      if (!error) {
        setCommitments(commitments.map(c =>
          c.id === id ? { ...c, current_count: newCount } : c
        ));
      }
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
          title: formData.title,
          description: formData.description,
          target_count: formData.target_count,
          current_count: 0,
          period_type: formData.period_type,
          punishment: formData.punishment,
          start_date: new Date().toISOString().split('T')[0],
          is_active: true,
          status: 'on-track',
        }])
        .select()
        .single();

      if (!error && data) {
        setCommitments([data, ...commitments]);
        setShowAddForm(false);
        setFormData({
          title: '',
          description: '',
          target_count: 5,
          period_type: 'weekly',
          punishment: '',
        });
      }
    } catch (err) {
      console.error('Error adding commitment:', err);
    }
  };

  if (!partnershipId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50 pb-24 flex items-center justify-center p-6">
        <div className="text-center">
          <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">الرجاء ربط الشريك أولاً من الإعدادات</p>
          <Button
            onClick={onBack}
            className="bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white rounded-2xl"
          >
            العودة
          </Button>
        </div>
      </div>
    );
  }

  const activeCommitments = commitments.filter(c => c.is_active);
  const completedCount = commitments.filter(c => c.status === 'completed').length;
  const atRiskCount = commitments.filter(c => c.status === 'at-risk').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50 p-6 pb-24" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/60 rounded-full transition-colors"
          >
            <ArrowRight className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-2xl text-gray-800">الالتزامات</h1>
        </div>
        <Button
          onClick={() => setShowAddForm(true)}
          className="bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white rounded-2xl shadow-md"
        >
          <Plus className="w-5 h-5 ml-2" />
          التزام جديد
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
          <Target className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl mb-1">{activeCommitments.length}</p>
          <p className="text-xs text-gray-500">نشطة</p>
        </div>
        <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
          <Trophy className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-2xl mb-1">{completedCount}</p>
          <p className="text-xs text-gray-500">مكتملة</p>
        </div>
        <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
          <AlertCircle className="w-6 h-6 text-orange-500 mx-auto mb-2" />
          <p className="text-2xl mb-1">{atRiskCount}</p>
          <p className="text-xs text-gray-500">في خطر</p>
        </div>
      </div>

      {/* Active Commitments */}
      <div className="mb-6">
        <h2 className="text-lg mb-3 text-gray-700">الالتزامات النشطة</h2>
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">جاري التحميل...</p>
          </div>
        ) : activeCommitments.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <Target className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">لا توجد التزامات نشطة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeCommitments.map((commitment) => (
              <div
                key={commitment.id}
                className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-gray-800 mb-1">
                      {commitment.title}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {commitment.description}
                    </p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full border ${getStatusColor(commitment.status)}`}>
                    {getStatusText(commitment.status)}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">التقدم</span>
                    <span className="text-gray-700">
                      {commitment.current_count} / {commitment.target_count}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className="bg-gradient-to-r from-pink-400 to-rose-400 h-2.5 rounded-full transition-all"
                      style={{ width: `${(commitment.current_count / commitment.target_count) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="text-sm text-gray-500">
                    <span>{getPeriodText(commitment.period_type)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">العقاب: </span>
                    <span className="text-red-500">{commitment.punishment}</span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 mt-3">
                  <Button
                    className="flex-1 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl h-9 text-sm"
                    onClick={() => handleMarkComplete(commitment.id)}
                  >
                    ✓ تم اليوم
                  </Button>
                  <Button
                    className="flex-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl h-9 text-sm"
                    onClick={() => {
                      setSelectedCommitment(commitment);
                      setShowDeleteConfirm(true);
                    }}
                  >
                    حذف
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed/History */}
      <div>
        <h2 className="text-lg mb-3 text-gray-700">السجل</h2>
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
          <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">لا توجد التزامات منتهية بعد</p>
        </div>
      </div>

      {/* Add Form Modal (Placeholder) */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl mb-4 text-gray-800">التزام جديد</h2>
            
            <form onSubmit={handleAddCommitment}>
              <div className="space-y-4 mb-6">
                <div className="flex flex-col">
                  <label className="text-sm text-gray-500">العنوان</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-pink-400"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm text-gray-500">الوصف</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-pink-400"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm text-gray-500">الهدف</label>
                  <input
                    type="number"
                    value={formData.target_count}
                    onChange={(e) => setFormData({ ...formData, target_count: parseInt(e.target.value) })}
                    className="border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-pink-400"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm text-gray-500">الفترة</label>
                  <select
                    value={formData.period_type}
                    onChange={(e) => setFormData({ ...formData, period_type: e.target.value as 'daily' | 'weekly' | 'monthly' })}
                    className="border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-pink-400"
                  >
                    <option value="daily">يومي</option>
                    <option value="weekly">أسبوعي</option>
                    <option value="monthly">شهري</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-sm text-gray-500">العقاب</label>
                  <input
                    type="text"
                    value={formData.punishment}
                    onChange={(e) => setFormData({ ...formData, punishment: e.target.value })}
                    className="border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-pink-400"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-2xl"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-pink-400 text-white hover:bg-pink-500 rounded-2xl"
                >
                  إضافة
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedCommitment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full">
            <h2 className="text-xl mb-4 text-gray-800 text-center">تأكيد الحذف</h2>
            
            <p className="text-sm text-gray-600 mb-6 text-center">
              هل أنت متأكد من أنك تريد حذف هذا الالتزام؟
            </p>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedCommitment(null);
                }}
                className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-2xl"
              >
                إلغاء
              </Button>
              <Button
                onClick={() => handleDelete(selectedCommitment.id)}
                className="flex-1 bg-red-500 text-white hover:bg-red-600 rounded-2xl"
              >
                حذف
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}