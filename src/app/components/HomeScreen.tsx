import { useState, useEffect } from 'react';
import { Lock, Calendar, ImageIcon, Gamepad2, Heart, Settings, Smile, Meh, Frown, Laugh, Target } from 'lucide-react';
import { Button } from './ui/button';
import { Logo } from './Logo';
import { supabase } from '../../lib/supabase';

interface HomeScreenProps {
  onNavigate: (screen: string) => void;
  userId: string;
}

export function HomeScreen({ onNavigate, userId }: HomeScreenProps) {
  const [daysTogether, setDaysTogether] = useState(0);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [showMoodPrompt, setShowMoodPrompt] = useState(true);
  const [partnershipId, setPartnershipId] = useState<string | null>(null);

  useEffect(() => {
    loadPartnershipData();
    loadTodayMood();
  }, [userId]);

  const loadPartnershipData = async () => {
    try {
      // التحقق من وجود شراكة نشطة
      const { data: partnership, error: partnershipError } = await supabase
        .from('partnerships')
        .select('id, relationship_start_date')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .eq('is_active', true)
        .single();

      if (partnership && !partnershipError) {
        setPartnershipId(partnership.id);
        
        // حساب عدد الأيام
        if (partnership.relationship_start_date) {
          const startDate = new Date(partnership.relationship_start_date);
          const today = new Date();
          const diffTime = Math.abs(today.getTime() - startDate.getTime());
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          setDaysTogether(diffDays);
        }
      }
    } catch (err) {
      console.error('Error loading partnership data:', err);
    }
  };

  const loadTodayMood = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('daily_moods')
        .select('mood')
        .eq('user_id', userId)
        .eq('mood_date', today)
        .maybeSingle();

      if (!error && data) {
        setSelectedMood(data.mood);
        setShowMoodPrompt(false);
      } else {
        setShowMoodPrompt(true);
      }
    } catch (err) {
      console.error('Error loading today mood:', err);
    }
  };

  const moods = [
    { id: 'happy', label: 'سعيد', icon: Laugh, color: 'text-yellow-500' },
    { id: 'good', label: 'جيد', icon: Smile, color: 'text-green-500' },
    { id: 'okay', label: 'عادي', icon: Meh, color: 'text-blue-500' },
    { id: 'sad', label: 'حزين', icon: Frown, color: 'text-gray-500' },
  ];

  const handleMoodSelect = async (mood: string) => {
    setSelectedMood(mood);
    setShowMoodPrompt(false);
    
    // Save mood to Supabase
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('daily_moods')
        .upsert({
          user_id: userId,
          mood_date: today,
          mood: mood,
        }, {
          onConflict: 'user_id,mood_date'
        });

      if (error) {
        console.error('Error saving mood:', error);
      }
    } catch (err) {
      console.error('Error saving mood:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => onNavigate('settings')}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="text-lg text-gray-800">أُلْفَة</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6 space-y-6 pb-24">
        {/* Relationship Card */}
        <div className="bg-white rounded-3xl shadow-lg p-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-200 to-rose-300 flex items-center justify-center">
                <Heart className="w-12 h-12 text-white" fill="currentColor" />
              </div>
              <div className="absolute -bottom-1 -left-1 w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center border-4 border-white">
                <Lock className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-2">معًا منذ</p>
          <p className="text-6xl text-gray-800 mb-2">{daysTogether}</p>
          <p className="text-lg text-gray-600">يوم</p>
        </div>

        {/* Daily Mood Card */}
        {showMoodPrompt && (
          <div className="bg-white rounded-3xl shadow-lg p-6">
            <h3 className="text-lg text-gray-800 text-center mb-4">
              كيف شعور قلبك اليوم؟
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {moods.map((mood) => {
                const Icon = mood.icon;
                return (
                  <button
                    key={mood.id}
                    onClick={() => handleMoodSelect(mood.id)}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl hover:bg-gradient-to-br hover:from-pink-50 hover:to-rose-50 transition-all"
                  >
                    <Icon className={`w-10 h-10 ${mood.color}`} strokeWidth={1.5} />
                    <span className="text-xs text-gray-600">{mood.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedMood && !showMoodPrompt && (
          <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-3xl p-6 text-center">
            <p className="text-gray-700">
              شكرًا للمشاركة! تم حفظ مشاعرك
            </p>
          </div>
        )}

        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={() => onNavigate('memories')}
            className="bg-white rounded-2xl shadow-md p-5 flex items-center gap-4 hover:shadow-lg transition-shadow"
          >
            <div className="flex-1 text-right">
              <h4 className="text-gray-800 mb-1">الذكريات</h4>
              <p className="text-sm text-gray-500">ابدأ بإضافة ذكرياتك</p>
            </div>
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-purple-600" />
            </div>
          </button>

          <button
            onClick={() => onNavigate('games')}
            className="bg-white rounded-2xl shadow-md p-5 flex items-center gap-4 hover:shadow-lg transition-shadow"
          >
            <div className="flex-1 text-right">
              <h4 className="text-gray-800 mb-1">لعبة اليوم</h4>
              <p className="text-sm text-gray-500">العب واستمتع</p>
            </div>
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-pink-100 to-rose-200 flex items-center justify-center">
              <Gamepad2 className="w-8 h-8 text-rose-600" />
            </div>
          </button>

          <button
            onClick={() => onNavigate('commitments')}
            className="bg-white rounded-2xl shadow-md p-5 flex items-center gap-4 hover:shadow-lg transition-shadow"
          >
            <div className="flex-1 text-right">
              <h4 className="text-gray-800 mb-1">الالتزامات</h4>
              <p className="text-sm text-gray-500">تتبع أهدافكم والعقوبات</p>
            </div>
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">
              <Target className="w-8 h-8 text-orange-600" />
            </div>
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-around">
            <button className="flex flex-col items-center gap-1 text-rose-500">
              <Heart className="w-6 h-6" fill="currentColor" />
              <span className="text-xs">الرئيسية</span>
            </button>
            <button
              onClick={() => onNavigate('memories')}
              className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600"
            >
              <ImageIcon className="w-6 h-6" />
              <span className="text-xs">الذكريات</span>
            </button>
            <button
              onClick={() => onNavigate('calendar')}
              className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600"
            >
              <Calendar className="w-6 h-6" />
              <span className="text-xs">التقويم</span>
            </button>
            <button
              onClick={() => onNavigate('commitments')}
              className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600"
            >
              <Target className="w-6 h-6" />
              <span className="text-xs">الالتزامات</span>
            </button>
            <button
              onClick={() => onNavigate('travel')}
              className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-xs">السفر</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}