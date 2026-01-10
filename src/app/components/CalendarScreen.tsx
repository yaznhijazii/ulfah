import { ArrowLeft, Plus, X, Heart } from 'lucide-react';
import { Button } from './ui/button';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { CalendarEvent } from '../../lib/supabase';

interface CalendarScreenProps {
  onNavigate: (screen: string) => void;
  userId: string;
  partnershipId: string | null;
}

export function CalendarScreen({ onNavigate, userId, partnershipId }: CalendarScreenProps) {
  const [currentMonth] = useState('يناير 2026');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    event_date: '',
    event_time: '',
    event_type: 'special' as 'special' | 'meeting' | 'travel',
    location: '',
    description: '',
  });

  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);
  const startDay = 3; // January 1, 2026 is a Thursday (0=Sun, 3=Wed)

  useEffect(() => {
    if (partnershipId) {
      loadEvents();
    }
  }, [partnershipId]);

  const loadEvents = async () => {
    if (!partnershipId) return;

    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('partnership_id', partnershipId)
        .order('event_date', { ascending: true });

      if (!error && data) {
        setEvents(data);
      }
    } catch (err) {
      console.error('Error loading events:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEventsByDay = (day: number) => {
    return events.filter(event => {
      const eventDate = new Date(event.event_date);
      return eventDate.getDate() === day;
    });
  };

  const getEventDots = (day: number) => {
    const dayEvents = getEventsByDay(day);
    return dayEvents.map((event) => {
      const color =
        event.event_type === 'special'
          ? 'bg-pink-400'
          : event.event_type === 'meeting'
          ? 'bg-blue-400'
          : 'bg-green-400';
      return color;
    });
  };

  const selectedDayEvents = selectedDay ? getEventsByDay(selectedDay) : [];

  const handleDeleteEvent = async (id: string) => {
    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id);

      if (!error) {
        setEvents(events.filter(e => e.id !== id));
      }
    } catch (err) {
      console.error('Error deleting event:', err);
    }
  };

  const handleAddEvent = async () => {
    if (!partnershipId) return;

    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          partnership_id: partnershipId,
          title: formData.title,
          event_date: formData.event_date,
          event_time: formData.event_time,
          event_type: formData.event_type,
          location: formData.location,
          description: formData.description,
        });

      if (!error && data) {
        setEvents([...events, data[0]]);
        setShowAddForm(false);
        setFormData({
          title: '',
          event_date: '',
          event_time: '',
          event_type: 'special' as 'special' | 'meeting' | 'travel',
          location: '',
          description: '',
        });
      }
    } catch (err) {
      console.error('Error adding event:', err);
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
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              className="bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="w-4 h-4 ml-1" />
              إضافة
            </Button>
            <h1 className="text-lg text-gray-800">{currentMonth}</h1>
            <button
              onClick={() => onNavigate('home')}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6">
        {/* Legend */}
        <div className="bg-white rounded-2xl shadow-md p-4 mb-6">
          <div className="flex items-center justify-around text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">مناسبة خاصة</span>
              <div className="w-3 h-3 rounded-full bg-pink-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">موعد</span>
              <div className="w-3 h-3 rounded-full bg-blue-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">سفر</span>
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-3xl shadow-lg p-6 mb-6">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'].reverse().map((day) => (
              <div key={day} className="text-center text-sm text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Empty cells before month starts */}
            {Array.from({ length: startDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Days */}
            {daysInMonth.map((day) => {
              const dots = getEventDots(day);
              const isToday = day === 10; // Mock today
              const isSelected = day === selectedDay;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-center transition-all relative ${
                    isSelected
                      ? 'bg-gradient-to-br from-pink-400 to-rose-400 text-white shadow-lg'
                      : isToday
                      ? 'bg-rose-50 text-gray-800'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="text-sm">{day}</span>
                  {dots.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {dots.slice(0, 3).map((color, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : color}`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Events */}
        {selectedDay && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg text-gray-800">أحداث {selectedDay} {currentMonth}</h2>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-2 hover:bg-white rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {selectedDayEvents.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-md p-8 text-center">
                <p className="text-gray-500 text-sm">لا توجد أحداث في هذا اليوم</p>
              </div>
            ) : (
              selectedDayEvents.map((event) => (
                <div
                  key={event.id}
                  className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {event.image_url && (
                    <div className="h-32 overflow-hidden">
                      <img
                        src={event.image_url}
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 text-right">
                        <h3 className="text-gray-800 mb-1">{event.title}</h3>
                        {event.event_time && (
                          <p className="text-sm text-gray-500 mb-1">🕐 {event.event_time}</p>
                        )}
                        {event.location && (
                          <p className="text-sm text-gray-500 mb-1">📍 {event.location}</p>
                        )}
                        {event.description && (
                          <p className="text-sm text-gray-600 mt-2">{event.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteEvent(event.id)}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                      >
                        <X className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Add Event Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" dir="rtl">
          <div className="bg-white p-6 rounded-3xl shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl mb-4 text-gray-800 text-center">إضافة حدث جديد</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 mb-2 block text-right">عنوان الحدث</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="مثلاً: عشاء رومانسي"
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-right"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-2 block text-right">التاريخ</label>
                <input
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-2 block text-right">الوقت (اختياري)</label>
                <input
                  type="time"
                  value={formData.event_time}
                  onChange={(e) => setFormData({ ...formData, event_time: e.target.value })}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-2 block text-right">نوع الحدث</label>
                <select
                  value={formData.event_type}
                  onChange={(e) => setFormData({ ...formData, event_type: e.target.value as 'special' | 'meeting' | 'travel' })}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 bg-white text-right"
                >
                  <option value="special">مناسبة خاصة</option>
                  <option value="meeting">موعد</option>
                  <option value="travel">سفر</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-2 block text-right">الموقع (اختياري)</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="مثلاً: مطعم الورود"
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-right"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-2 block text-right">الوصف (اختياري)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="اكتب تفاصيل الحدث..."
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-right min-h-[80px]"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({
                    title: '',
                    event_date: '',
                    event_time: '',
                    event_type: 'special',
                    location: '',
                    description: '',
                  });
                }}
                className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-2xl"
              >
                إلغاء
              </Button>
              <Button
                onClick={handleAddEvent}
                disabled={!formData.title || !formData.event_date}
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