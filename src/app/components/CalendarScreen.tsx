import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Plus, Calendar as CalendarIcon, ImageIcon, Trash2, MapPin, Clock, X, Upload, Sparkles, Heart } from 'lucide-react';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';

interface CalendarScreenProps {
  onNavigate: (screen: string) => void;
  userId: string;
  partnershipId: string | null;
  isDarkMode?: boolean;
}

export function CalendarScreen({ onNavigate, userId, partnershipId, isDarkMode }: CalendarScreenProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddEventForm, setShowAddEventForm] = useState(false);
  const [showAddMemoryForm, setShowAddMemoryForm] = useState(false);
  const [showAddRealEventForm, setShowAddRealEventForm] = useState(false);

  const [eventForm, setEventForm] = useState({ title: '', event_date: '', event_time: '', location: '', event_type: 'normal' });
  const [memoryForm, setMemoryForm] = useState({ title: '', memory_date: new Date().toISOString().split('T')[0], description: '' });
  const [selectedImages, setSelectedImages] = useState<{ file: File, preview: string }[]>([]);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [limit, setLimit] = useState(15);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');

  const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

  useEffect(() => {
    if (partnershipId) {
      loadTimelineData();
    }
  }, [partnershipId]);

  const loadTimelineData = async () => {
    setLoading(true);
    const [eventsResult, memoriesResult] = await Promise.all([
      supabase.from('calendar_events').select('*').eq('partnership_id', partnershipId).order('event_date', { ascending: false }).limit(limit),
      supabase.from('memories').select('*, images:memory_images(image_url)').eq('partnership_id', partnershipId).order('memory_date', { ascending: false }).limit(limit)
    ]);

    if (eventsResult.data) setEvents(eventsResult.data);
    if (memoriesResult.data) setMemories(memoriesResult.data);
    setLoading(false);
  };

  const fetchEvents = async () => {
    const { data } = await supabase.from('calendar_events').select('*').eq('partnership_id', partnershipId).order('event_date', { ascending: false }).limit(limit);
    if (data) setEvents(data);
  };

  const fetchMemories = async () => {
    const { data } = await supabase.from('memories').select('*, images:memory_images(image_url)').eq('partnership_id', partnershipId).order('memory_date', { ascending: false }).limit(limit);
    if (data) setMemories(data);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnershipId) return;
    const { error } = await supabase.from('calendar_events').insert({ partnership_id: partnershipId, created_by_user_id: userId, ...eventForm });
    if (!error) {
      setShowAddRealEventForm(false);
      fetchEvents();
      setEventForm({ title: '', event_date: '', event_time: '', location: '', event_type: 'normal' });
    }
  };

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnershipId || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const { data: memory, error: mError } = await supabase.from('memories').insert({ partnership_id: partnershipId, created_by_user_id: userId, ...memoryForm }).select().single();

      if (!mError && memory && selectedImages.length > 0) {
        const uploadedUrls = [];

        for (const img of selectedImages) {
          const fileExt = img.file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${partnershipId}/${memory.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('memories')
            .upload(filePath, img.file);

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('memories').getPublicUrl(filePath);
            uploadedUrls.push({ memory_id: memory.id, image_url: publicUrl });
          }
        }

        if (uploadedUrls.length > 0) {
          await supabase.from('memory_images').insert(uploadedUrls);
        }
      }

      if (!mError) {
        setShowAddMemoryForm(false);
        fetchMemories();
        setMemoryForm({ title: '', memory_date: new Date().toISOString().split('T')[0], description: '' });
        setSelectedImages([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteItem = async (id: string, type: 'event' | 'memory') => {
    const table = type === 'event' ? 'calendar_events' : 'memories';
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) {
      if (type === 'event') fetchEvents();
      else fetchMemories();
    }
  };

  const timelineItems = useMemo(() => {
    const combined = [
      ...events.map(e => ({ ...e, type: 'event' as const, date: new Date(e.event_date) })),
      ...memories.map(m => ({ ...m, type: 'memory' as const, date: new Date(m.memory_date) }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime());
    return combined;
  }, [events, memories]);

  const filteredItems = useMemo(() => {
    if (viewMode === 'timeline') return timelineItems;
    return timelineItems.filter(item =>
      item.date.getDate() === selectedDate.getDate() &&
      item.date.getMonth() === selectedDate.getMonth() &&
      item.date.getFullYear() === selectedDate.getFullYear()
    );
  }, [timelineItems, selectedDate, viewMode]);

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isPast = date.getTime() < now.getTime();

    if (diffDays === 0) return 'اليوم';
    if (diffDays === 1) return isPast ? 'أمس' : 'غداً';
    return isPast ? `منذ ${diffDays} أيام` : `بعد ${diffDays} أيام`;
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calendar Helpers
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const currentMonthDays = useMemo(() => {
    const days = [];
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const totalDays = getDaysInMonth(year, month);
    for (let i = 1; i <= totalDays; i++) days.push(new Date(year, month, i));
    return days;
  }, [selectedDate]);

  return (
    <div className="flex-1 bg-background flex flex-col relative h-screen">
      {/* Header Area */}
      <header className="px-6 pt-12 pb-6 sticky top-0 bg-background/80 backdrop-blur-xl border-b border-border/50 z-30">
        <div className="flex items-center justify-between mb-4">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => onNavigate('home')} className="w-11 h-11 flex items-center justify-center bg-card rounded-2xl shadow-sm border border-border">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </motion.button>
          <div className="text-center">
            <h1 className="text-xl font-black text-foreground">خط الزمن الخاص بنا</h1>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">لحظات خلدتها المحبة</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowAddEventForm(true)}
            className="w-11 h-11 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20"
          >
            <Plus className="w-6 h-6" />
          </motion.button>
        </div>

        {/* Horizontal Calendar Strip */}
        <div className="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-hide px-2">
          {currentMonthDays.map((day, i) => {
            const isSelected = day.getDate() === selectedDate.getDate() && day.getMonth() === selectedDate.getMonth();
            const dayEvents = timelineItems.filter(item =>
              item.date.getDate() === day.getDate() &&
              item.date.getMonth() === day.getMonth() &&
              item.date.getFullYear() === day.getFullYear()
            );

            return (
              <motion.button
                key={i}
                onClick={() => {
                  setSelectedDate(day);
                  setViewMode('grid');
                }}
                whileTap={{ scale: 0.95 }}
                className={`flex flex-col items-center min-w-[60px] py-4 rounded-[2rem] transition-all border-2 ${isSelected ? 'bg-primary border-primary shadow-lg shadow-primary/30 text-white' : 'bg-card border-border/40 text-muted-foreground'
                  }`}
              >
                <span className="text-[10px] font-black uppercase opacity-60 mb-1">{monthNames[day.getMonth()]}</span>
                <span className="text-xl font-black mb-1">{day.getDate()}</span>
                <div className="flex gap-1">
                  {dayEvents.slice(0, 3).map((_, idx) => (
                    <div key={idx} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/60' : 'bg-primary/40'}`} />
                  ))}
                </div>
              </motion.button>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-2 mt-2">
          <button
            onClick={() => setViewMode(viewMode === 'timeline' ? 'grid' : 'timeline')}
            className="flex items-center gap-2 text-[11px] font-black text-primary bg-primary/5 px-4 py-2 rounded-full border border-primary/10"
          >
            {viewMode === 'timeline' ? '📅 عرض حسب اليوم' : '🎞️ عرض كل الذكريات'}
          </button>
          <div className="text-[10px] font-black text-muted-foreground tracking-widest uppercase">
            {viewMode === 'timeline' ? 'أحدث الذكريات' : `ذكريات يوم ${selectedDate.getDate()} ${monthNames[selectedDate.getMonth()]}`}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8 pb-32 scroll-smooth">
        <div className="relative">
          {/* Vertical Timeline Line */}
          {viewMode === 'timeline' && (
            <div className="absolute right-7 top-0 bottom-0 w-[2px] bg-gradient-to-b from-primary/50 via-primary/20 to-transparent rounded-full" />
          )}

          <div className="space-y-12">
            {filteredItems.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center text-muted-foreground/30"><CalendarIcon className="w-10 h-10" /></div>
                <div>
                  <h3 className="text-lg font-black text-foreground">{viewMode === 'grid' ? 'لا توجد محطات في هذا اليوم' : 'لا توجد ذكريات بعد'}</h3>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    {viewMode === 'grid' ? 'تبدو الحكاية هادئة هنا.. ما رأيكم بتوثيق لحظة؟' : 'ابدأ بتوثيق رحلتكما الآن'}
                  </p>
                </div>
                {viewMode === 'grid' && (
                  <Button variant="ghost" onClick={() => setViewMode('timeline')} className="text-xs font-black text-primary">العودة لعرض الكل</Button>
                )}
              </div>
            )}

            {filteredItems.map((item, idx) => {
              const day = item.date.getDate();
              const month = monthNames[item.date.getMonth()];
              const year = item.date.getFullYear();

              return (
                <div key={`${item.id}-${idx}`} className={`flex ${viewMode === 'timeline' ? 'flex-row-reverse' : 'flex-col'} gap-8 relative items-start`}>
                  {/* Date Indicator in Timeline Mode */}
                  {viewMode === 'timeline' && (
                    <div className="flex flex-col items-center w-14 shrink-0 pt-1 relative z-10 text-center">
                      <span className="text-[9px] font-black text-primary uppercase tracking-widest">{month}</span>
                      <span className="text-3xl font-black text-foreground leading-tight tracking-tighter">{day}</span>
                      <span className="text-[10px] font-black text-muted-foreground opacity-50">{year}</span>
                      <motion.div
                        initial={{ scale: 0 }}
                        whileInView={{ scale: 1 }}
                        className={`mt-4 w-5 h-5 rounded-full border-4 border-card shadow-lg ${item.type === 'event' ? 'bg-primary' : 'bg-indigo-500'}`}
                      />
                    </div>
                  )}

                  {/* Content Card */}
                  <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="flex-1 min-w-0">
                    {item.type === 'memory' ? (
                      <div className="bg-card rounded-[3rem] overflow-hidden shadow-xl shadow-black/[0.02] border border-border/50 group hover:shadow-2xl transition-all duration-500">
                        {item.images && item.images.length > 0 && (
                          <div className="aspect-[1.5] relative overflow-hidden bg-muted/20">
                            <motion.img
                              initial={{ opacity: 0 }}
                              whileInView={{ opacity: 1 }}
                              loading="lazy"
                              src={item.images[0].image_url}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1.5s]"
                              onClick={() => setViewImage(item.images![0].image_url)}
                            />
                            <div className="absolute bottom-5 left-5 bg-black/40 backdrop-blur-md border border-white/20 text-white px-3 py-1.5 rounded-2xl text-[10px] font-black flex items-center gap-2"><ImageIcon className="w-3.5 h-3.5" /><span>{item.images.length} صور</span></div>
                          </div>
                        )}
                        <div className="p-8 space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-black text-xl leading-tight text-foreground">{item.title}</h3>
                            <button onClick={() => deleteItem(item.id, 'memory')} className="w-9 h-9 flex items-center justify-center bg-destructive/10 text-destructive rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-sm"><Trash2 className="w-4 h-4" /></button>
                          </div>
                          <p className="text-sm text-muted-foreground font-bold leading-relaxed">{item.description}</p>
                          <div className="pt-4 flex items-center justify-between border-t border-border/50">
                            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-muted-foreground/30" /><span className="text-[10px] font-black text-muted-foreground uppercase">{getRelativeTime(item.date)}</span></div>
                            <div className="w-9 h-9 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500"><Heart className="w-5 h-5" fill="currentColor" /></div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-card rounded-[2.5rem] p-6 shadow-xl shadow-black/[0.02] border border-border/50 flex items-center justify-between group hover:shadow-md transition-all duration-300">
                        <div className="flex items-center gap-5">
                          <div className={`w-16 h-16 rounded-[1.8rem] flex items-center justify-center text-white shadow-lg ${item.event_type === 'special' ? 'bg-primary shadow-primary/20' : 'bg-foreground/10 text-foreground'}`}>
                            {item.event_type === 'special' ? <Sparkles className="w-7 h-7" /> : <CalendarIcon className="w-7 h-7" />}
                          </div>
                          <div className="text-right">
                            <h3 className="font-black text-base text-foreground mb-1">{item.title}</h3>
                            <div className="flex flex-col gap-1">
                              {item.event_time && <span className="text-[10px] font-black text-muted-foreground flex items-center gap-2 justify-end"><Clock className="w-3 h-3" />{item.event_time}</span>}
                              {item.location && <span className="text-[10px] font-black text-muted-foreground flex items-center gap-2 justify-end"><MapPin className="w-3 h-3" />{item.location}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-3 shrink-0">
                          <button onClick={() => deleteItem(item.id, 'event')} className="w-8 h-8 flex items-center justify-center bg-destructive/10 text-destructive rounded-xl opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                          <span className="px-3 py-1.5 bg-muted/30 rounded-full text-[9px] font-black text-muted-foreground uppercase">{getRelativeTime(item.date)}</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </div>
              );
            })}

            {timelineItems.length >= limit && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => setLimit(prev => prev + 10)}
                  className="rounded-2xl px-8 h-12 font-black text-xs border-primary/20 text-primary hover:bg-primary/5 transition-all"
                >
                  عرض ذكريات أقدم 🕰️
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showAddEventForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddEventForm(false)} />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative w-full max-w-sm bg-card rounded-[2.5rem] p-8 shadow-2xl z-10 border border-border/50">
              <h2 className="text-2xl font-black mb-6 text-center text-foreground">إضافة للحظاتنا</h2>
              <div className="space-y-4">
                <button onClick={() => { setShowAddEventForm(false); setShowAddMemoryForm(true); }} className="w-full p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl flex items-center gap-4 text-indigo-500 transition-all active:scale-95 leading-none">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shrink-0"><ImageIcon className="w-6 h-6" /></div>
                  <div className="text-right"><h4 className="font-black text-lg">ذكرى جديدة</h4><p className="text-[11px] font-bold opacity-70">صورة وتفاصيل للحظة جميلة</p></div>
                </button>
                <button onClick={() => { setShowAddEventForm(false); setShowAddRealEventForm(true); }} className="w-full p-6 bg-primary/10 border border-primary/20 rounded-3xl flex items-center gap-4 text-primary transition-all active:scale-95 leading-none">
                  <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0"><CalendarIcon className="w-6 h-6" /></div>
                  <div className="text-right"><h4 className="font-black text-lg">موعد مستقبلي</h4><p className="text-[11px] font-bold opacity-70">خطط لتاريخ أو مناسبة قادمة</p></div>
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddRealEventForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddRealEventForm(false)} />
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="relative w-full max-w-sm bg-card rounded-[2.5rem] p-8 shadow-2xl z-10 border border-border/50">
              <h2 className="text-2xl font-black mb-6 text-foreground">موعد قادم</h2>
              <form onSubmit={handleCreateEvent} className="space-y-5">
                <div className="space-y-1.5"><label className="text-[11px] font-black mr-1 text-muted-foreground uppercase">العنوان</label><input required className="w-full h-14 bg-muted/30 rounded-2xl px-5 text-sm font-bold border-none text-foreground" placeholder="..." value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><label className="text-[11px] font-black mr-1 text-muted-foreground uppercase">التاريخ</label><input type="date" required className="w-full h-14 bg-muted/30 rounded-2xl px-4 text-sm font-bold border-none text-foreground font-sans" value={eventForm.event_date} onChange={e => setEventForm({ ...eventForm, event_date: e.target.value })} /></div>
                  <div className="space-y-1.5"><label className="text-[11px] font-black mr-1 text-muted-foreground uppercase">الوقت</label><input type="time" className="w-full h-14 bg-muted/30 rounded-2xl px-4 text-sm font-bold border-none text-foreground font-sans" value={eventForm.event_time} onChange={e => setEventForm({ ...eventForm, event_time: e.target.value })} /></div>
                </div>
                <Button type="submit" className="w-full h-15 rounded-2xl text-md font-black shadow-lg shadow-primary/20">تأكيد الموعد</Button>
              </form>
            </motion.div>
          </div>
        )}

        {showAddMemoryForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddMemoryForm(false)} />
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="relative w-full max-w-sm bg-card rounded-[2.5rem] p-8 shadow-2xl z-10 max-h-[90vh] overflow-y-auto border border-border/50">
              <h2 className="text-2xl font-black mb-6 text-foreground">إضافة ذكرى</h2>
              <form onSubmit={handleCreateMemory} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black mr-1 text-muted-foreground uppercase">الصورة</label>
                  {selectedImages.length > 0 ? (
                    <div className="aspect-square relative rounded-[2rem] overflow-hidden border-2 border-primary/20 shadow-md">
                      <img src={selectedImages[0].preview} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setSelectedImages([])} className="absolute top-4 right-4 bg-rose-500 text-white rounded-full p-2 shadow-lg"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <label className="aspect-square rounded-[2rem] bg-muted/30 border-2 border-dashed border-border/50 flex items-center justify-center flex-col cursor-pointer hover:border-primary/50 text-muted-foreground transition-all">
                      <Upload className="w-8 h-8 mb-2" /><span className="text-xs font-black">اضغط لرفع الصورة</span>
                      <input type="file" accept="image/*" className="hidden" onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => setSelectedImages([{ file, preview: ev.target?.result as string }]);
                          reader.readAsDataURL(file);
                        }
                      }} />
                    </label>
                  )}
                </div>
                <div className="space-y-1.5"><label className="text-[11px] font-black mr-1 text-muted-foreground uppercase">العنوان</label><input required className="w-full h-14 bg-muted/30 rounded-2xl px-5 text-sm font-bold border-none text-foreground" placeholder="..." value={memoryForm.title} onChange={e => setMemoryForm({ ...memoryForm, title: e.target.value })} /></div>
                <div className="space-y-1.5"><label className="text-[11px] font-black mr-1 text-muted-foreground uppercase">التفاصيل</label><textarea className="w-full h-28 bg-muted/30 rounded-[1.5rem] p-5 text-sm font-bold border-none resize-none text-foreground" placeholder="..." value={memoryForm.description} onChange={e => setMemoryForm({ ...memoryForm, description: e.target.value })} /></div>
                <Button type="submit" className="w-full h-15 rounded-2xl text-md font-black shadow-lg shadow-indigo-500/20 bg-indigo-500 hover:bg-indigo-600">حفظ اللحظة</Button>
              </form>
            </motion.div>
          </div>
        )}

        {viewImage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/95 flex flex-col p-5 backdrop-blur-xl">
            <button onClick={() => setViewImage(null)} className="absolute top-5 right-5 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white z-50 transition-transform active:scale-95"><X className="w-6 h-6" /></button>
            <div className="flex-1 flex items-center justify-center"><img src={viewImage} className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl" /></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}