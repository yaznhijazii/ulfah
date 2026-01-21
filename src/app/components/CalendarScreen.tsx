import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Plus,
  Calendar as CalendarIcon,
  Image as ImageIcon,
  Trash2,
  MapPin,
  Clock,
  X,
  Upload,
  Sparkles,
  Heart,
  Compass,
  Camera,
  CalendarDays,
  History,
  ChevronDown,
  LayoutGrid,
  Target
} from 'lucide-react';
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

  const [eventForm, setEventForm] = useState({ title: '', event_date: '', event_time: '', location: '', event_type: 'other' });
  const [memoryForm, setMemoryForm] = useState({ title: '', memory_date: new Date().toISOString().split('T')[0], description: '' });
  const [selectedImages, setSelectedImages] = useState<{ file: File, preview: string }[]>([]);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [limit, setLimit] = useState(15);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const activeDateRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeDateRef.current) {
      activeDateRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedDate, viewMode]);

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
    setIsSubmitting(true);
    const { error } = await supabase.from('calendar_events').insert({
      partnership_id: partnershipId,
      created_by_user_id: userId,
      ...eventForm
    });

    if (!error) {
      setShowAddRealEventForm(false);
      fetchEvents();
      setEventForm({ title: '', event_date: '', event_time: '', location: '', event_type: 'other' });
    }
    setIsSubmitting(false);
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
          const { error: uploadError } = await supabase.storage.from('memories').upload(filePath, img.file);
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('memories').getPublicUrl(filePath);
            uploadedUrls.push({ memory_id: memory.id, image_url: publicUrl });
          }
        }
        if (uploadedUrls.length > 0) await supabase.from('memory_images').insert(uploadedUrls);
      }

      if (!mError) {
        setShowAddMemoryForm(false);
        fetchMemories();
        setMemoryForm({ title: '', memory_date: new Date().toISOString().split('T')[0], description: '' });
        setSelectedImages([]);
      }
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
    return isPast ? `منذ ${diffDays} يوم` : `بعد ${diffDays} يوم`;
  };

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
    <div className="flex-1 bg-background flex flex-col relative h-full mood-love">
      {/* Memories Atmospheric Aura */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[100%] h-[70%] bg-rose-500/10 blur-[150px] rounded-full opacity-60" />
      </div>

      <header className="px-8 pt-10 pb-6 sticky top-0 bg-background/40 backdrop-blur-3xl z-30">
        <div className="flex items-center justify-between mb-8">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onNavigate('home')}
            className="w-12 h-12 flex items-center justify-center glass rounded-2xl border-white/60 shadow-xl text-foreground/40"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <div className="text-center">
            <h1 className="text-xl font-black text-foreground tracking-tighter">سجل المسافات</h1>
            <p className="text-[9px] font-black text-rose-600/40 uppercase tracking-[0.4em]">أثر الخطوات.. ومرفأ الذكريات</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowAddEventForm(true)}
            className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-rose-500/20"
          >
            <Plus className="w-6 h-6" />
          </motion.button>
        </div>

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
                ref={isSelected ? activeDateRef as any : null}
                onClick={() => {
                  setSelectedDate(day);
                  setViewMode('grid');
                }}
                whileTap={{ scale: 0.95 }}
                className={`flex flex-col items-center min-w-[50px] py-3 rounded-2xl transition-all border ${isSelected ? 'bg-rose-500 border-rose-500 shadow-xl shadow-rose-500/20 text-white' : 'glass border-white/20 text-muted-foreground'
                  }`}
              >
                <span className="text-[8px] font-black uppercase opacity-60 mb-1">{monthNames[day.getMonth()]}</span>
                <span className="text-base font-black">{day.getDate()}</span>
                <div className="mt-2 flex gap-1">
                  {dayEvents.slice(0, 3).map((_, idx) => (
                    <div key={idx} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-rose-500'}`} />
                  ))}
                </div>
              </motion.button>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-2 mt-2">
          <button
            onClick={() => setViewMode(viewMode === 'timeline' ? 'grid' : 'timeline')}
            className="flex items-center gap-2 text-[10px] font-black text-rose-500 glass border-rose-500/20 px-5 py-3 rounded-2xl transition-all hover:bg-rose-500 hover:text-white"
          >
            {viewMode === 'timeline' ? <LayoutGrid className="w-3.5 h-3.5" /> : <History className="w-3.5 h-3.5" />}
            {viewMode === 'timeline' ? 'استعراض باليوم' : 'الوثيقة الكاملة'}
          </button>
          <div className="text-[10px] font-black text-rose-600/30 tracking-[0.2em] uppercase">
            {viewMode === 'timeline' ? 'كرونولوجيا المودة' : `${monthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-8 pb-40 scrollbar-hide">
        <div className="relative">
          {viewMode === 'timeline' && timelineItems.length > 0 && (
            <div className="absolute right-7 top-0 bottom-0 w-[1px] bg-gradient-to-b from-primary/40 via-primary/10 to-transparent rounded-full" />
          )}

          <div className="space-y-16">
            {filteredItems.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-28 text-center space-y-8 opacity-20">
                <Compass className="w-20 h-20" />
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-foreground">بقعة بيضاء في السجل</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] max-w-[240px] leading-relaxed">لم يخط قلم المودة أثراً في هذه المحطة بعد.. ربما حان وقت المبادرة؟</p>
                </div>
              </div>
            )}

            {filteredItems.map((item, idx) => (
              <div key={item.id} className={`flex ${viewMode === 'timeline' ? 'flex-row-reverse' : 'flex-col'} gap-12 relative items-start`}>
                {viewMode === 'timeline' && (
                  <div className="flex flex-col items-center w-14 shrink-0 pt-1 relative z-10 text-center">
                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{monthNames[item.date.getMonth()]}</span>
                    <span className="text-4xl font-black text-foreground tracking-tighter my-2">{item.date.getDate()}</span>
                    <motion.div initial={{ scale: 0 }} whileInView={{ scale: 1 }} className={`mt-6 w-5 h-5 rounded-full border-[4px] border-background shadow-xl ${item.type === 'event' ? 'bg-primary' : 'bg-rose-500'}`} />
                  </div>
                )}

                <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex-1 min-w-0 w-full mb-4">
                  {item.type === 'memory' ? (
                    <div className="glass rounded-[3rem] overflow-hidden border-white/20 group transition-all duration-700 hover:shadow-2xl">
                      {item.images && item.images.length > 0 && (
                        <div className="aspect-[1.5] relative overflow-hidden bg-muted/5">
                          <motion.img
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            src={item.images[0].image_url}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[3s]"
                            onClick={() => setViewImage(item.images![0].image_url)}
                          />
                          <div className="absolute bottom-6 left-6 glass-dark border-white/5 text-white px-4 py-2 rounded-xl text-[9px] font-black flex items-center gap-2.5 backdrop-blur-xl"><ImageIcon className="w-3.5 h-3.5 text-primary" /><span>{item.images.length} مشهد</span></div>
                        </div>
                      )}
                      <div className="p-8 space-y-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-right">
                            <History className="w-4 h-4 text-rose-500/40" />
                            <h3 className="font-black text-xl text-foreground tracking-tight">{item.title}</h3>
                          </div>
                          <button onClick={() => deleteItem(item.id, 'memory')} className="w-10 h-10 flex items-center justify-center glass border-white/10 text-rose-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        <p className="text-[13px] text-muted-foreground font-bold leading-[1.7] opacity-80 text-right">{item.description}</p>
                        <div className="pt-6 flex items-center justify-between border-t border-white/10">
                          <div className="flex items-center gap-2.5 text-muted-foreground/60">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-black uppercase tracking-widest">{getRelativeTime(item.date)}</span>
                          </div>
                          <div className="w-10 h-10 rounded-xl glass border-white/20 flex items-center justify-center text-rose-500 shadow-inner group-hover:scale-110 transition-transform"><Heart className="w-5 h-5 fill-rose-500/10" /></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="glass rounded-[2.5rem] p-6 border-white/20 flex items-center justify-between group hover:shadow-xl transition-all duration-500">
                      <div className="flex items-center gap-6">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-2xl ${item.event_type === 'special' ? 'bg-primary shadow-primary/20' : 'bg-muted/10 text-muted-foreground'}`}>
                          {item.event_type === 'special' ? <Sparkles className="w-7 h-7" /> : <CalendarIcon className="w-7 h-7" />}
                        </div>
                        <div className="text-right">
                          <h3 className="font-black text-lg text-foreground mb-1 tracking-tight">{item.title}</h3>
                          <div className="flex flex-col gap-1.5">
                            {item.event_time && <span className="text-[9px] font-black text-muted-foreground/40 flex items-center gap-2 justify-end uppercase tracking-widest"><Clock className="w-3 h-3" />{item.event_time}</span>}
                            {item.location && <span className="text-[9px] font-black text-muted-foreground/40 flex items-center gap-2 justify-end uppercase tracking-widest"><MapPin className="w-3 h-3" />{item.location}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-4 shrink-0">
                        <button onClick={() => deleteItem(item.id, 'event')} className="w-9 h-9 flex items-center justify-center glass border-white/10 text-rose-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
                        <span className="px-5 py-2.5 glass border-primary/20 rounded-xl text-[9px] font-black text-primary uppercase tracking-widest">{getRelativeTime(item.date)}</span>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            ))}

            {timelineItems.length >= limit && (
              <div className="flex justify-center pt-10">
                <Button variant="outline" onClick={() => setLimit(prev => prev + 10)} className="rounded-[2.5rem] px-12 h-16 font-black text-[11px] border-primary/20 text-primary uppercase tracking-[0.3em] hover:bg-primary hover:text-white transition-all shadow-lg">تعقب الأثر الأقدم</Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showAddEventForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={() => setShowAddEventForm(false)} />
            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }} className="relative w-full max-w-sm glass rounded-[3.5rem] p-12 shadow-2xl z-10 border-white/30">
              <h2 className="text-2xl font-black mb-10 text-center text-foreground tracking-tighter">تدوين أثر جديد</h2>
              <div className="space-y-8">
                <button onClick={() => { setShowAddEventForm(false); setShowAddMemoryForm(true); }} className="w-full p-10 glass border-white/20 rounded-[3rem] flex items-center gap-7 transition-all hover:border-rose-500/30 group">
                  <div className="w-16 h-16 rounded-[1.8rem] bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"><Camera className="w-8 h-8" /></div>
                  <div className="text-right">
                    <h4 className="font-black text-xl text-foreground mb-1">مشهد للذكرى</h4>
                    <p className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest leading-relaxed">توثيق بصري للحظة عابرة</p>
                  </div>
                </button>
                <button onClick={() => { setShowAddEventForm(false); setShowAddRealEventForm(true); }} className="w-full p-10 glass border-white/20 rounded-[3rem] flex items-center gap-7 transition-all hover:border-primary/30 group">
                  <div className="w-16 h-16 rounded-[1.8rem] bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"><Target className="w-8 h-8" /></div>
                  <div className="text-right">
                    <h4 className="font-black text-xl text-foreground mb-1">وعد قادم</h4>
                    <p className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest leading-relaxed">تخطيط لمسافة لم نقطعها بعد</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddRealEventForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={() => setShowAddRealEventForm(false)} />
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="relative w-full max-w-sm glass rounded-[3.5rem] p-12 border-white/30">
              <h2 className="text-3xl font-black mb-10 text-foreground tracking-tighter">وعد مشترك</h2>
              <form onSubmit={handleCreateEvent} className="space-y-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-black mr-2 text-muted-foreground/40 uppercase tracking-[0.2em]">ماهية الوعد</label>
                  <input required className="w-full h-18 glass rounded-2xl px-6 text-lg font-black border-white/10 text-foreground focus:border-primary transition-all" placeholder="عنوان يلمس القلب..." value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3"><label className="text-[10px] font-black mr-2 text-muted-foreground/40 uppercase tracking-[0.2em]">اليوم</label><input type="date" required className="w-full h-16 glass rounded-2xl px-5 text-sm font-black border-white/10 text-foreground font-sans focus:border-primary transition-all" value={eventForm.event_date} onChange={e => setEventForm({ ...eventForm, event_date: e.target.value })} /></div>
                  <div className="space-y-3"><label className="text-[10px] font-black mr-2 text-muted-foreground/40 uppercase tracking-[0.2em]">الساعة</label><input type="time" className="w-full h-16 glass rounded-2xl px-5 text-sm font-black border-white/10 text-foreground font-sans focus:border-primary transition-all" value={eventForm.event_time} onChange={e => setEventForm({ ...eventForm, event_time: e.target.value })} /></div>
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full h-18 rounded-[2rem] text-lg font-black shadow-2xl shadow-primary/20 bg-primary">تثبيت في السجل</Button>
              </form>
            </motion.div>
          </div>
        )}

        {showAddMemoryForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={() => setShowAddMemoryForm(false)} />
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="relative w-full max-w-md glass rounded-[3.5rem] p-12 border-white/30 max-h-[90vh] overflow-y-auto scrollbar-hide">
              <h2 className="text-3xl font-black mb-10 text-foreground tracking-tighter text-center">تخليد مشهد</h2>
              <form onSubmit={handleCreateMemory} className="space-y-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black mr-2 text-muted-foreground/40 uppercase tracking-[0.2em]">النافذة البصرية</label>
                  {selectedImages.length > 0 ? (
                    <div className="aspect-[1.5] relative rounded-[3rem] overflow-hidden border-2 border-primary/20 shadow-2xl group">
                      <img src={selectedImages[0].preview} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setSelectedImages([])} className="absolute top-8 right-8 glass-dark text-white rounded-2xl p-4 shadow-xl active:scale-90 transition-all"><X className="w-6 h-6" /></button>
                    </div>
                  ) : (
                    <label className="aspect-[1.5] rounded-[3rem] glass border-dashed border-2 border-white/10 flex items-center justify-center flex-col cursor-pointer hover:border-primary/40 transition-all text-muted-foreground/20 group">
                      <Upload className="w-12 h-12 mb-4 group-hover:scale-110 group-hover:text-primary transition-all" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">استحضار مشهد من الذاكرة</span>
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
                <div className="space-y-3"><label className="text-[10px] font-black mr-2 text-muted-foreground/40 uppercase tracking-[0.2em]">مسمى اللحظة</label><input required className="w-full h-18 glass rounded-2xl px-6 text-lg font-black border-white/10 text-foreground focus:border-primary transition-all" placeholder="عنوان يختصر الشعور..." value={memoryForm.title} onChange={e => setMemoryForm({ ...memoryForm, title: e.target.value })} /></div>
                <div className="space-y-3"><label className="text-[10px] font-black mr-2 text-muted-foreground/40 uppercase tracking-[0.2em]">أثر مكتوب</label><textarea className="w-full h-40 glass rounded-[2.5rem] p-8 text-base font-black border-white/10 resize-none text-foreground focus:border-primary transition-all leading-relaxed" placeholder="كيف كانت دقات القلب حينها؟" value={memoryForm.description} onChange={e => setMemoryForm({ ...memoryForm, description: e.target.value })} /></div>
                <Button type="submit" disabled={isSubmitting} className="w-full h-18 rounded-[2.5rem] text-xl font-black shadow-2xl shadow-rose-500/20 bg-rose-500">حفظ في خزانة العمر</Button>
              </form>
            </motion.div>
          </div>
        )}

        {viewImage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/98 flex flex-col p-8 backdrop-blur-3xl">
            <button onClick={() => setViewImage(null)} className="absolute top-10 right-10 w-16 h-16 glass-dark rounded-2xl flex items-center justify-center text-white z-50 transition-transform active:scale-95 border-white/10 shadow-2xl"><X className="w-8 h-8" /></button>
            <div className="flex-1 flex items-center justify-center"><img src={viewImage} className="max-w-full max-h-full object-contain rounded-[4rem] shadow-2xl border border-white/5" /></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}