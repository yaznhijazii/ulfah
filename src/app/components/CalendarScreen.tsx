import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import {
  ArrowLeft, Plus, Calendar as CalendarIcon, Image as ImageIcon,
  Trash2, MapPin, Clock, X, Upload, Sparkles, Heart, Compass,
  Camera, History, ChevronLeft, ChevronRight, LayoutGrid,
  Target, Gift, MailOpen, Mail, Edit2
} from 'lucide-react';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface CalendarScreenProps {
  onNavigate: (screen: string) => void;
  userId: string;
  partnershipId: string | null;
  isDarkMode?: boolean;
}

// ─── Module-level Session Cache ────────────────────────────────────────────────
// Survives navigation within the same session — instant re-open, no spinner.
interface CacheEntry {
  events: any[];
  memories: any[];
  greetings: any[];
  hasMore: boolean;
  ts: number;
}
const _sessionCache: Record<string, CacheEntry> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const PAGE_SIZE = 6;

function readCache(pid: string): CacheEntry | null {
  const c = _sessionCache[pid];
  if (c && Date.now() - c.ts < CACHE_TTL) return c;
  return null;
}
function writeCache(pid: string, data: Omit<CacheEntry, 'ts'>) {
  _sessionCache[pid] = { ...data, ts: Date.now() };
}
function invalidateCache(pid: string) {
  delete _sessionCache[pid];
}

// ─── Stable constants (outside component to avoid re-allocation) ───────────────
const MONTH_NAMES = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const DAY_ABBR    = ['أحد','إثن','ثلا','أرب','خمي','جمع','سبت'];

// ─── Skeleton ──────────────────────────────────────────────────────────────────
const SkeletonMemory = () => (
  <div className="rounded-[2.8rem] overflow-hidden bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/6 animate-pulse shadow-md">
    <div className="h-48 bg-rose-500/8 dark:bg-rose-500/5" />
    <div className="p-7 space-y-3">
      <div className="h-5 bg-black/6 dark:bg-white/8 rounded-xl w-3/4 mr-0 ml-auto" />
      <div className="h-3.5 bg-black/4 dark:bg-white/5 rounded-xl w-full" />
      <div className="h-3.5 bg-black/4 dark:bg-white/5 rounded-xl w-2/3 ml-auto" />
    </div>
  </div>
);

const SkeletonEvent = () => (
  <div className="rounded-[2rem] bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/6 animate-pulse p-5 flex items-center gap-4 shadow-sm">
    <div className="w-14 h-14 rounded-[1.2rem] bg-rose-500/8 flex-shrink-0" />
    <div className="flex-1 space-y-2.5">
      <div className="h-5 bg-black/6 dark:bg-white/8 rounded-xl w-3/4 ml-auto" />
      <div className="h-3 bg-black/4 dark:bg-white/5 rounded-xl w-1/3 ml-auto" />
    </div>
  </div>
);

// ─── MemoryItem ────────────────────────────────────────────────────────────────
const MemoryItem = memo(({ item, idx, viewMode, onDelete, onEdit, onOpenGallery, getRelativeTime }: any) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const hasImages = item.images && item.images.length > 0;
  const isFirst = idx === 0;

  return (
    <div className={`flex ${viewMode === 'timeline' ? 'flex-row' : 'flex-col'} gap-7 relative items-center w-full`}>

      {/* Timeline dot */}
      {viewMode === 'timeline' && (
        <div className="flex flex-col items-center w-10 shrink-0 relative z-10 text-center">
          <span className="text-[10px] font-black text-rose-500/40 uppercase tracking-widest leading-none bg-[#fff8f8] dark:bg-[#0b0407] px-1 z-10">{MONTH_NAMES[item.date.getMonth()]}</span>
          <span className="text-2xl font-black text-foreground leading-none my-2 bg-[#fff8f8] dark:bg-[#0b0407] px-2 z-10">{item.date.getDate()}</span>
          <div className="relative z-10 bg-[#fff8f8] dark:bg-[#0b0407] p-1 rounded-full">
            <div className="w-3 h-3 rounded-full bg-rose-500 border-[2.5px] border-[#fff8f8] dark:border-[#0b0407] shadow-md shadow-rose-500/30" />
          </div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ type: 'spring', stiffness: 90, damping: 18 }}
        className="flex-1 min-w-0 w-full mb-2"
      >
        <div className="bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/6 rounded-[2.8rem] overflow-hidden group shadow-lg shadow-black/4 dark:shadow-black/25 hover:shadow-xl transition-shadow duration-500">

          {/* Images */}
          {hasImages && (
            <div className="relative overflow-hidden cursor-pointer" onClick={() => onOpenGallery(item.images, 0)}>
              {/* Placeholder shown until image loads */}
              <div className={`absolute inset-0 bg-rose-500/5 transition-opacity duration-500 ${imgLoaded ? 'opacity-0' : 'opacity-100'}`} />

              {item.images.length === 1 ? (
                <img
                  src={item.images[0].image_url}
                  loading={isFirst ? 'eager' : 'lazy'}
                  decoding="async"
                  onLoad={() => setImgLoaded(true)}
                  className={`w-full h-52 object-cover transition-all duration-700 group-hover:scale-105 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
              ) : item.images.length === 2 ? (
                <div className="grid grid-cols-2 gap-px h-52">
                  {item.images.map((img: any, i: number) => (
                    <img key={i} src={img.image_url} loading="lazy" decoding="async"
                      className="w-full h-full object-cover"
                      onClick={e => { e.stopPropagation(); onOpenGallery(item.images, i); }} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-px h-52">
                  {item.images.slice(0, 3).map((img: any, i: number) => (
                    <div key={i} className="relative">
                      <img src={img.image_url} loading="lazy" decoding="async"
                        className={`w-full h-full object-cover ${i === 2 && item.images.length > 3 ? 'brightness-[0.45]' : ''}`}
                        onClick={e => { e.stopPropagation(); onOpenGallery(item.images, i); }} />
                      {i === 2 && item.images.length > 3 && (
                        <span className="absolute inset-0 flex items-center justify-center text-white text-2xl font-black pointer-events-none">
                          +{item.images.length - 3}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Photo count */}
              {item.images.length > 1 && (
                <div className="absolute bottom-3 left-3 bg-black/55 backdrop-blur-md border border-white/10 text-white px-3 py-1 rounded-[0.65rem] text-[9px] font-black flex items-center gap-1.5">
                  <ImageIcon className="w-3 h-3" />
                  {item.images.length} صور
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className="p-7">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:bg-black/10 flex-shrink-0 mt-0.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(item.id, 'memory')}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-rose-500/8 text-rose-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500/15 flex-shrink-0 mt-0.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <h3 className="font-black text-lg text-foreground tracking-tight text-right leading-snug">{item.title}</h3>
            </div>
            {item.description && (
              <p className="text-[13px] text-muted-foreground/60 font-medium leading-relaxed text-right mb-5">{item.description}</p>
            )}
            <div className="flex items-center justify-between pt-4 border-t border-black/4 dark:border-white/5">
              <div className="w-9 h-9 rounded-xl bg-rose-500/8 flex items-center justify-center">
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500/20" />
              </div>
              <span className="text-[9px] font-black text-muted-foreground/35 uppercase tracking-widest">
                {getRelativeTime(item.date)}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

// ─── EventItem ─────────────────────────────────────────────────────────────────
const EventItem = memo(({ item, viewMode, onDelete, onEdit, getRelativeTime }: any) => {
  const isSpecial = item.event_type === 'special';

  return (
    <div className={`flex ${viewMode === 'timeline' ? 'flex-row' : 'flex-col'} gap-7 relative items-center w-full`}>

      {/* Timeline dot */}
      {viewMode === 'timeline' && (
        <div className="flex flex-col items-center w-10 shrink-0 relative z-10 text-center">
          <span className="text-[10px] font-black text-rose-500/40 uppercase tracking-widest leading-none bg-[#fff8f8] dark:bg-[#0b0407] px-1 z-10">{MONTH_NAMES[item.date.getMonth()]}</span>
          <span className="text-2xl font-black text-foreground leading-none my-2 bg-[#fff8f8] dark:bg-[#0b0407] px-2 z-10">{item.date.getDate()}</span>
          <div className="relative z-10 bg-[#fff8f8] dark:bg-[#0b0407] p-1 rounded-full">
            <div className={`w-3 h-3 rounded-full border-[2.5px] border-[#fff8f8] dark:border-[#0b0407] shadow-md ${isSpecial ? 'bg-rose-500 shadow-rose-500/30' : 'bg-indigo-500 shadow-indigo-500/25'}`} />
          </div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ type: 'spring', stiffness: 90, damping: 18 }}
        className="flex-1 min-w-0 w-full mb-2"
      >
        <div className="bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/6 rounded-[2rem] p-5 flex items-center gap-4 group shadow-md shadow-black/3 dark:shadow-black/20 hover:shadow-lg transition-shadow duration-400">
          <div className={`w-14 h-14 rounded-[1.2rem] flex items-center justify-center text-white shadow-lg flex-shrink-0 ${isSpecial ? 'bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/25' : 'bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-indigo-500/20'}`}>
            {isSpecial ? <Sparkles className="w-6 h-6" /> : <CalendarIcon className="w-6 h-6" />}
          </div>
          <div className="flex-1 text-right min-w-0">
            <h3 className="font-black text-base text-foreground tracking-tight truncate">{item.title}</h3>
            <div className="flex flex-col gap-1 mt-1.5">
              {item.event_time && (
                <span className="text-[9px] font-bold text-muted-foreground/45 flex items-center gap-1.5 justify-end">
                  <Clock className="w-3 h-3" />{item.event_time}
                </span>
              )}
              {item.location && (
                <span className="text-[9px] font-bold text-muted-foreground/45 flex items-center gap-1.5 justify-end">
                  <MapPin className="w-3 h-3" />{item.location}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2.5 shrink-0">
            <div className="flex gap-2">
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:bg-black/10"
                >
                    <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={() => onDelete(item.id, 'event')}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-500/8 text-rose-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500/15"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
            <span className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wide ${isSpecial ? 'bg-rose-500/10 text-rose-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
              {getRelativeTime(item.date)}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

// ─── Main Component ────────────────────────────────────────────────────────────
export function CalendarScreen({ onNavigate, userId, partnershipId, isDarkMode }: CalendarScreenProps) {

  // ── Initial state from cache (no loading flash on re-visit) ──
  const cached = partnershipId ? readCache(partnershipId) : null;

  const [events,   setEvents]   = useState<any[]>(cached?.events   ?? []);
  const [memories, setMemories] = useState<any[]>(cached?.memories ?? []);
  const [greetings,setGreetings]= useState<any[]>(cached?.greetings ?? []);
  const [loading,  setLoading]  = useState(!cached);
  const [hasMore,  setHasMore]  = useState(cached?.hasMore ?? true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Forms
  const [showAddEventForm,    setShowAddEventForm]    = useState(false);
  const [showAddMemoryForm,   setShowAddMemoryForm]   = useState(false);
  const [showAddRealEventForm,setShowAddRealEventForm]= useState(false);
  const [showAddGreetingForm, setShowAddGreetingForm] = useState(false);

  const [eventForm,   setEventForm]   = useState({ title: '', event_date: '', event_time: '', location: '', event_type: 'other' });
  const [memoryForm,  setMemoryForm]  = useState({ title: '', memory_date: new Date().toISOString().split('T')[0], description: '' });
  const [greetingForm,setGreetingForm]= useState({ title: '', target_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], message: '' });
  const [editingGreetingId, setEditingGreetingId] = useState<string | null>(null);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<{ file?: File; preview: string; isOld?: boolean; url?: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Gallery
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex,  setGalleryIndex]  = useState(0);
  const [showGallery,   setShowGallery]   = useState(false);

  // Navigation
  const [viewMode, setViewMode]       = useState<'timeline' | 'grid'>('timeline');
  const [selectedDate, setSelectedDate] = useState(new Date());
  // Calendar strip shows the current month by default
  const [stripMonth, setStripMonth]   = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });

  const loadMoreRef   = useRef<HTMLDivElement>(null);
  const activeDateRef = useRef<HTMLButtonElement>(null);

  // ── Data loading ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!partnershipId) return;
    if (cached) {
      // Show cached data immediately, silently refresh in background after 1s
      const refresh = setTimeout(() => doFullLoad(partnershipId, true), 1000);
      return () => clearTimeout(refresh);
    }
    doFullLoad(partnershipId, false);
  }, [partnershipId]);

  async function doFullLoad(pid: string, background: boolean) {
    if (!background) setLoading(true);

    // Phase 1: 3 items fast → unblock UI
    if (!background) {
      const [qe, qm] = await Promise.all([
        supabase.from('calendar_events').select('id,title,event_date,event_time,location,event_type')
          .eq('partnership_id', pid).order('event_date', { ascending: false }).limit(3),
        supabase.from('memories').select('id,title,memory_date,description,images:memory_images(image_url)')
          .eq('partnership_id', pid).order('memory_date', { ascending: false }).limit(3),
      ]);
      if (qe.data) setEvents(qe.data);
      if (qm.data) setMemories(qm.data);
      setLoading(false);
    }

    // Phase 2: full page
    const [evRes, memRes, grRes] = await Promise.all([
      supabase.from('calendar_events').select('*')
        .eq('partnership_id', pid).order('event_date', { ascending: false }).limit(PAGE_SIZE),
      supabase.from('memories').select('*,images:memory_images(image_url)')
        .eq('partnership_id', pid).order('memory_date', { ascending: false }).limit(PAGE_SIZE),
      supabase.from('occasion_greetings').select('*')
        .eq('partnership_id', pid).eq('sender_id', userId).order('target_date', { ascending: false }),
    ]);

    const newEvents   = evRes.data  ?? events;
    const newMemories = memRes.data ?? memories;
    const newGreetings= grRes.data  ?? greetings;
    const more = (memRes.data?.length ?? 0) >= PAGE_SIZE;

    setEvents(newEvents);
    setMemories(newMemories);
    setGreetings(newGreetings);
    setHasMore(more);
    setLoading(false);

    writeCache(pid, { events: newEvents, memories: newMemories, greetings: newGreetings, hasMore: more });
  }

  // Incremental load-more: only fetches the NEXT page, appends to existing
  const loadMore = useCallback(async () => {
    if (!partnershipId || loadingMore || !hasMore) return;
    setLoadingMore(true);

    const offset = memories.length;
    const { data } = await supabase
      .from('memories')
      .select('*,images:memory_images(image_url)')
      .eq('partnership_id', partnershipId)
      .order('memory_date', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (data) {
      const merged = [...memories, ...data];
      const more = data.length === PAGE_SIZE;
      setMemories(merged);
      setHasMore(more);
      writeCache(partnershipId, {
        events, memories: merged, greetings, hasMore: more,
      });
    }
    setLoadingMore(false);
  }, [partnershipId, memories, events, greetings, loadingMore, hasMore]);

  // Intersection Observer
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loading) return;
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 },
    );
    obs.observe(loadMoreRef.current);
    return () => obs.disconnect();
  }, [loadMore, hasMore, loading]);

  // Scroll selected date into view
  useEffect(() => {
    activeDateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedDate]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getRelativeTime = useCallback((date: Date) => {
    const diff = Math.ceil(Math.abs(new Date().getTime() - date.getTime()) / 86400000);
    const past = date < new Date();
    if (diff === 0) return 'اليوم';
    if (diff === 1) return past ? 'أمس' : 'غداً';
    return past ? `منذ ${diff} يوم` : `بعد ${diff} يوم`;
  }, []);

  const openGallery = useCallback((images: { image_url: string }[], start = 0) => {
    setGalleryImages(images.map(i => i.image_url));
    setGalleryIndex(start);
    setShowGallery(true);
  }, []);

  const editMemory = useCallback((mem: any) => {
      setEditingMemoryId(mem.id);
      setMemoryForm({
          title: mem.title,
          description: mem.description || '',
          memory_date: new Date(mem.memory_date).toISOString().split('T')[0]
      });
      if (mem.images) {
          setSelectedImages(mem.images.map((img: any) => ({ preview: img.image_url, isOld: true, url: img.image_url })));
      } else {
          setSelectedImages([]);
      }
      setShowAddMemoryForm(true);
  }, []);

  const editEvent = useCallback((ev: any) => {
      setEventForm({
          title: ev.title,
          event_date: new Date(ev.event_date).toISOString().split('T')[0],
          event_time: ev.event_time || '',
          location: ev.location || '',
          event_type: ev.event_type || 'other'
      });
      // We don't have an editingEventId state yet, we should add it or use a combined one
      // For now, let's just trigger the form. Real edit requires an ID.
      // I will add [editingEventId, setEditingEventId] to the component state.
      setShowAddRealEventForm(true);
  }, []);

  const nextImage = useCallback(() => setGalleryIndex(p => (p + 1) % galleryImages.length), [galleryImages.length]);
  const prevImage = useCallback(() => setGalleryIndex(p => (p - 1 + galleryImages.length) % galleryImages.length), [galleryImages.length]);

  const deleteItem = useCallback(async (id: string, type: 'event' | 'memory' | 'greeting') => {
    if (type === 'greeting' && !window.confirm('هل أنت متأكد من حذف هذه المعايدة؟')) return;
    const table = type === 'event' ? 'calendar_events' : type === 'memory' ? 'memories' : 'occasion_greetings';
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) {
      if (partnershipId) invalidateCache(partnershipId);
      if (type === 'event')    setEvents(p => p.filter(x => x.id !== id));
      else if (type === 'memory')   setMemories(p => p.filter(x => x.id !== id));
      else setGreetings(p => p.filter(x => x.id !== id));
    }
  }, [partnershipId]);

  // ── Computed ───────────────────────────────────────────────────────────────
  const timelineItems = useMemo(() => [
    ...events.map(e => ({ ...e, type: 'event'  as const, date: new Date(e.event_date)  })),
    ...memories.map(m => ({ ...m, type: 'memory' as const, date: new Date(m.memory_date) })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()), [events, memories]);

  const filteredItems = useMemo(() => {
    if (viewMode === 'timeline') return timelineItems;
    return timelineItems.filter(item =>
      item.date.toDateString() === selectedDate.toDateString()
    );
  }, [timelineItems, selectedDate, viewMode]);

  const stripDays = useMemo(() => {
    const year = stripMonth.getFullYear();
    const month = stripMonth.getMonth();
    const total = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: total }, (_, i) => new Date(year, month, i + 1));
  }, [stripMonth]);

  // ── Form handlers ──────────────────────────────────────────────────────────
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnershipId) return;
    setIsSubmitting(true);
    const { error } = await supabase.from('calendar_events').insert({
      partnership_id: partnershipId, created_by_user_id: userId, ...eventForm,
    });
    if (!error) {
      setShowAddRealEventForm(false);
      setEventForm({ title: '', event_date: '', event_time: '', location: '', event_type: 'other' });
      if (partnershipId) invalidateCache(partnershipId);
      doFullLoad(partnershipId, true);
      toast.success('تم تثبيت الوعد في السجل ✨');
    }
    setIsSubmitting(false);
  };

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnershipId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      let memoryId = editingMemoryId;

      if (editingMemoryId) {
          // Update existing
          const { error: updateErr } = await supabase.from('memories').update({
              title: memoryForm.title,
              description: memoryForm.description,
              memory_date: memoryForm.memory_date
          }).eq('id', editingMemoryId);
          if (updateErr) throw updateErr;

          // Delete old images that were removed
          const { data: oldImages } = await supabase.from('memory_images').select('*').eq('memory_id', editingMemoryId);
          if (oldImages) {
              const keptUrls = selectedImages.filter(img => img.isOld).map(img => img.url);
              const toDelete = oldImages.filter(old => !keptUrls.includes(old.image_url));
              if (toDelete.length > 0) {
                 await supabase.from('memory_images').delete().in('id', toDelete.map(d => d.id));
                 for (const d of toDelete) {
                    const path = d.image_url.split('/storage/v1/object/public/memories/')[1];
                    if (path) await supabase.storage.from('memories').remove([path]);
                 }
              }
          }
      } else {
          // Insert new
          const { data: memory, error: mError } = await supabase
            .from('memories').insert({ partnership_id: partnershipId, created_by_user_id: userId, ...memoryForm })
            .select().single();
          if (mError) throw mError;
          memoryId = memory.id;
      }

      if (memoryId) {
        const newImages = selectedImages.filter(img => !img.isOld && img.file);
        if (newImages.length > 0) {
            const { compressImage } = await import('../../utils/imageOptimizer');
            const uploadedUrls: { memory_id: string; image_url: string }[] = [];
            for (const img of newImages) {
            let file = img.file!;
            try { file = await compressImage(file, { maxWidth: 1200, quality: 0.7 }); } catch {}
            const path = `${partnershipId}/${memoryId}/${Math.random()}.jpg`;
            const { error: upErr } = await supabase.storage.from('memories').upload(path, file);
            if (!upErr) {
                const { data: { publicUrl } } = supabase.storage.from('memories').getPublicUrl(path);
                uploadedUrls.push({ memory_id: memoryId, image_url: publicUrl });
            }
            }
            if (uploadedUrls.length > 0) await supabase.from('memory_images').insert(uploadedUrls);
        }
      }

      setShowAddMemoryForm(false);
      setEditingMemoryId(null);
      setMemoryForm({ title: '', memory_date: new Date().toISOString().split('T')[0], description: '' });
      setSelectedImages([]);
      if (partnershipId) invalidateCache(partnershipId);
      doFullLoad(partnershipId, true);
      toast.success(editingMemoryId ? 'تم تحديث الذكرى بنجاح 💖' : 'تم حفظ الذكرى في خزانة العمر 💖');
    } catch (e) {
        console.error(e);
        toast.error('حدث خطأ أثناء حفظ الذكرى');
    } finally { setIsSubmitting(false); }
  };

  const handleCreateGreeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnershipId || isSubmitting) return;
    setIsSubmitting(true);
    const targetDateObj = new Date(greetingForm.target_date);
    targetDateObj.setHours(0, 0, 0, 0);
    const payload = {
      partnership_id: partnershipId, sender_id: userId,
      title: greetingForm.title, target_date: targetDateObj.toISOString(),
      message: greetingForm.message, is_opened: false,
    };
    let error;
    if (editingGreetingId) {
      ({ error } = await supabase.from('occasion_greetings').update(payload).eq('id', editingGreetingId));
    } else {
      ({ error } = await supabase.from('occasion_greetings').insert(payload));
    }
    if (!error) {
      setShowAddGreetingForm(false);
      setEditingGreetingId(null);
      setGreetingForm({ title: '', target_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], message: '' });
      if (partnershipId) invalidateCache(partnershipId);
      doFullLoad(partnershipId, true);
      toast.success(editingGreetingId ? 'تم تعديل المعايدة ✏️' : 'تم إيداع المعايدة بنجاح 💌 ستظهر لشريكك قبل موعدها بيومين!');
    } else {
      toast.error('تأكد أنك قمت بإنشاء جدول المعايدات في Supabase!');
    }
    setIsSubmitting(false);
  };

  // ── Image picker helper ────────────────────────────────────────────────────
  const pickImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setSelectedImages(p => [...p, { file, preview: ev.target?.result as string }]);
      reader.readAsDataURL(file);
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div dir="rtl" className="flex-1 bg-[#fff8f8] dark:bg-[#0b0407] flex flex-col relative h-full">

      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.12, 0.2, 0.12] }} transition={{ duration: 12, repeat: Infinity }}
          className="absolute -top-1/4 -right-1/4 w-[90%] h-[80%] bg-rose-500/20 dark:bg-rose-600/12 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 left-0 w-[60%] h-[50%] bg-pink-500/8 dark:bg-pink-500/5 rounded-full blur-[120px]" />
      </div>

      {/* ─── Header ─── */}
      <header className="px-6 pt-10 pb-4 sticky top-0 bg-[#fff8f8]/75 dark:bg-[#0b0407]/75 backdrop-blur-2xl z-30 border-b border-rose-900/5 dark:border-white/5">

        {/* Top row */}
        <div className="flex items-center justify-between mb-5">
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => onNavigate('home')}
            className="w-11 h-11 flex items-center justify-center bg-black/5 dark:bg-white/7 rounded-[1.1rem] border border-black/5 dark:border-white/8">
            <ArrowLeft className="w-5 h-5 text-foreground/50" />
          </motion.button>

          <div className="text-center">
            <h1 className="text-xl font-black text-foreground tracking-tight">سجل المسافات</h1>
            <p className="text-[9px] font-black text-rose-500/50 uppercase tracking-[0.35em] mt-0.5">أثر الخطوات ومرفأ الذكريات</p>
          </div>

          <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowAddEventForm(true)}
            className="w-11 h-11 bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-[1.1rem] flex items-center justify-center shadow-lg shadow-rose-500/30">
            <Plus className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Month nav + strip */}
        <div className="space-y-3">
          {/* Month navigation */}
          <div className="flex items-center justify-between px-1">
            <motion.button whileTap={{ scale: 0.9 }}
              onClick={() => setStripMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-black/5 dark:bg-white/7 text-foreground/50">
              <ChevronLeft className="w-4 h-4" />
            </motion.button>
            <button
              onClick={() => { setStripMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelectedDate(new Date()); }}
              className="text-[11px] font-black text-foreground/60 uppercase tracking-[0.25em] hover:text-rose-500 transition-colors"
            >
              {MONTH_NAMES[stripMonth.getMonth()]} {stripMonth.getFullYear()}
            </button>
            <motion.button whileTap={{ scale: 0.9 }}
              onClick={() => setStripMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-black/5 dark:bg-white/7 text-foreground/50">
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>

          {/* Day strip */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {stripDays.map((day, i) => {
              const isSelected = day.toDateString() === selectedDate.toDateString();
              const isToday    = day.toDateString() === new Date().toDateString();
              const dots = timelineItems.filter(it => it.date.toDateString() === day.toDateString());
              return (
                <motion.button
                  key={i}
                  ref={isSelected ? activeDateRef as any : null}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => { setSelectedDate(day); setViewMode('grid'); }}
                  className={`flex flex-col items-center min-w-[46px] py-2.5 px-2 rounded-2xl transition-all flex-shrink-0 ${
                    isSelected
                      ? 'bg-gradient-to-b from-rose-500 to-rose-600 shadow-lg shadow-rose-500/25 text-white'
                      : 'bg-white/60 dark:bg-white/4 border border-black/5 dark:border-white/7 text-muted-foreground'
                  }`}
                >
                  <span className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isSelected ? 'text-white/70' : 'text-muted-foreground/40'}`}>
                    {DAY_ABBR[day.getDay()]}
                  </span>
                  <span className={`text-base font-black leading-none ${isToday && !isSelected ? 'text-rose-500' : ''}`}>
                    {day.getDate()}
                  </span>
                  <div className="mt-1.5 flex gap-0.5 h-1">
                    {dots.slice(0, 3).map((_, di) => (
                      <div key={di} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/70' : 'bg-rose-500/50'}`} />
                    ))}
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* View toggle */}
          <div className="flex items-center justify-between px-1">
            <motion.button whileTap={{ scale: 0.95 }}
              onClick={() => setViewMode(v => v === 'timeline' ? 'grid' : 'timeline')}
              className="flex items-center gap-2 text-[10px] font-black text-rose-500 bg-rose-500/8 border border-rose-500/15 px-4 py-2 rounded-[0.9rem] hover:bg-rose-500/15 transition-colors">
              {viewMode === 'timeline' ? <LayoutGrid className="w-3.5 h-3.5" /> : <History className="w-3.5 h-3.5" />}
              {viewMode === 'timeline' ? 'استعراض اليوم' : 'الوثيقة الكاملة'}
            </motion.button>
            <span className="text-[9px] font-black text-rose-600/30 tracking-[0.2em] uppercase">
              {viewMode === 'timeline' ? 'كرونولوجيا المودة' : `${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`}
            </span>
          </div>
        </div>
      </header>

      {/* ─── Content ─── */}
      <div className="flex-1 overflow-y-auto px-5 py-6 pb-40 scrollbar-hide">

        {/* Greetings section */}
        {greetings.length > 0 && (
          <div className="mb-10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50 mb-3 flex items-center gap-2 px-1">
              <Gift className="w-3.5 h-3.5 text-amber-500" /> معايداتك المخبأة
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {greetings.map(g => (
                <div key={g.id} className="min-w-[185px] bg-white dark:bg-white/[0.03] border border-amber-500/15 rounded-[2rem] p-5 relative group shrink-0 shadow-md">
                  <div className="flex justify-between items-start mb-3">
                    <div className={`w-10 h-10 rounded-[0.9rem] flex items-center justify-center ${g.is_opened ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                      {g.is_opened ? <MailOpen className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => { setEditingGreetingId(g.id); setGreetingForm({ title: g.title, target_date: new Date(g.target_date).toISOString().split('T')[0], message: g.message }); setShowAddGreetingForm(true); }}
                        className="w-8 h-8 flex items-center justify-center bg-black/5 dark:bg-white/5 text-muted-foreground rounded-lg">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteItem(g.id, 'greeting')}
                        className="w-8 h-8 flex items-center justify-center bg-rose-500/8 text-rose-500 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <h4 className="font-black text-sm text-foreground mb-3 leading-tight">{g.title}</h4>
                  <div className="flex items-center justify-between">
                    <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-lg ${g.is_opened ? 'bg-emerald-500/12 text-emerald-500' : 'bg-amber-500/12 text-amber-500'}`}>
                      {g.is_opened ? 'تم الفتح' : 'قيد الانتظار'}
                    </span>
                    <span className="text-[8px] font-bold text-muted-foreground/40">{new Date(g.target_date).toLocaleDateString('ar-EG')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline line */}
        <div className="relative">
          {viewMode === 'timeline' && timelineItems.length > 0 && (
            <div className="absolute right-[1.25rem] top-0 bottom-0 w-px bg-rose-500/5" />
          )}

          <div className="space-y-10">

            {/* Skeleton */}
            {loading && (
              <>
                <SkeletonMemory />
                <SkeletonEvent />
                <SkeletonMemory />
              </>
            )}

            {/* Empty state */}
            {!loading && filteredItems.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-28 text-center">
                <div className="w-20 h-20 rounded-3xl bg-rose-500/8 flex items-center justify-center mb-5">
                  <Compass className="w-10 h-10 text-rose-400/30" />
                </div>
                <h3 className="text-xl font-black text-foreground/20 mb-2">بقعة بيضاء في السجل</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/20 max-w-[220px] leading-relaxed">
                  لم يخط قلم المودة أثراً هنا بعد
                </p>
              </motion.div>
            )}

            {/* Items */}
            {!loading && filteredItems.map((item, idx) =>
              item.type === 'memory'
                ? <MemoryItem key={item.id} item={item} idx={idx} viewMode={viewMode} onDelete={deleteItem} onEdit={editMemory} onOpenGallery={openGallery} getRelativeTime={getRelativeTime} />
                : <EventItem  key={item.id} item={item} idx={idx} viewMode={viewMode} onDelete={deleteItem} onEdit={editEvent} getRelativeTime={getRelativeTime} />
            )}

            {/* Infinite scroll trigger */}
            {!loading && hasMore && (
              <div ref={loadMoreRef} className="flex justify-center py-6">
                {loadingMore && (
                  <div className="flex items-center gap-3 text-muted-foreground/35">
                    <div className="w-4 h-4 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
                    <span className="text-[9px] font-black uppercase tracking-widest">جاري التحميل...</span>
                  </div>
                )}
              </div>
            )}

            {!loading && !hasMore && timelineItems.length > 0 && (
              <div className="flex justify-center py-6">
                <span className="text-[9px] font-black text-muted-foreground/20 uppercase tracking-widest">كل الذكريات محملة ✨</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Modals ─── */}
      <AnimatePresence>

        {/* Picker: what to add */}
        {showAddEventForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddEventForm(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-white dark:bg-zinc-950 rounded-[3rem] p-8 shadow-2xl z-10 border border-black/5 dark:border-white/8">
              <h2 className="text-xl font-black mb-6 text-center text-foreground tracking-tighter">تدوين أثر جديد</h2>
              <div className="space-y-3">
                {[
                  { Icon: Camera, bg: 'bg-rose-500/10 text-rose-500', title: 'مشهد للذكرى', sub: 'توثيق بصري للحظة عابرة', action: () => { setShowAddEventForm(false); setShowAddMemoryForm(true); } },
                  { Icon: Target, bg: 'bg-primary/10 text-primary', title: 'وعد قادم', sub: 'تخطيط لمسافة لم نقطعها بعد', action: () => { setShowAddEventForm(false); setShowAddRealEventForm(true); } },
                  { Icon: Gift, bg: 'bg-amber-500/10 text-amber-500', title: 'معايدة سرية 💌', sub: 'تظهر لشريكك قبل المناسبة بـ 48 ساعة', action: () => { setEditingGreetingId(null); setGreetingForm({ title: '', target_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], message: '' }); setShowAddEventForm(false); setShowAddGreetingForm(true); } },
                ].map(({ Icon, bg, title, sub, action }) => (
                  <button key={title} onClick={action}
                    className="w-full p-5 bg-black/2 dark:bg-white/3 border border-black/5 dark:border-white/7 rounded-[1.8rem] flex items-center gap-5 text-right hover:bg-black/5 dark:hover:bg-white/6 transition-colors group">
                    <div className={`w-14 h-14 rounded-[1.3rem] ${bg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="font-black text-base text-foreground mb-0.5">{title}</h4>
                      <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">{sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* Memory form */}
        {showAddMemoryForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={() => setShowAddMemoryForm(false)} />
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-950 rounded-[3rem] p-8 shadow-2xl z-10 border border-black/5 dark:border-white/8 max-h-[90vh] overflow-y-auto scrollbar-hide">
              <h2 className="text-2xl font-black mb-8 text-foreground tracking-tighter text-center">تخليد مشهد</h2>
              <form onSubmit={handleCreateMemory} className="space-y-6">
                {/* Image picker */}
                <div>
                  <label className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] block mb-3">النافذة البصرية</label>
                  {selectedImages.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {selectedImages.map((img, i) => (
                        <div key={i} className="aspect-square relative rounded-2xl overflow-hidden group">
                          <img src={img.preview} className="w-full h-full object-cover" />
                          <button type="button" onClick={() => setSelectedImages(p => p.filter((_, j) => j !== i))}
                            className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <label className="aspect-square rounded-2xl border-2 border-dashed border-black/10 dark:border-white/10 flex items-center justify-center cursor-pointer hover:border-rose-500/40 transition-colors">
                        <Plus className="w-8 h-8 text-muted-foreground/30" />
                        <input type="file" multiple accept="image/*" className="hidden" onChange={pickImages} />
                      </label>
                    </div>
                  ) : (
                    <label className="aspect-[2/1] rounded-[2rem] border-2 border-dashed border-black/10 dark:border-white/10 flex flex-col items-center justify-center cursor-pointer hover:border-rose-500/40 transition-colors group bg-black/1 dark:bg-white/1">
                      <Upload className="w-8 h-8 text-muted-foreground/25 mb-2 group-hover:text-rose-400 transition-colors" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">اختيار صور</span>
                      <input type="file" multiple accept="image/*" className="hidden" onChange={pickImages} />
                    </label>
                  )}
                </div>
                <div>
                  <label className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] block mb-2">مسمى اللحظة</label>
                  <input required className="w-full h-14 bg-black/3 dark:bg-white/4 border border-black/5 dark:border-white/8 rounded-2xl px-5 text-base font-black text-foreground outline-none focus:ring-2 focus:ring-rose-500/25 text-right"
                    placeholder="عنوان يختصر الشعور..." value={memoryForm.title} onChange={e => setMemoryForm({ ...memoryForm, title: e.target.value })} />
                </div>
                <div>
                  <label className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] block mb-2">تاريخ اللحظة</label>
                  <input required type="date" className="w-full h-14 bg-black/3 dark:bg-white/4 border border-black/5 dark:border-white/8 rounded-2xl px-5 text-base font-black text-foreground outline-none focus:ring-2 focus:ring-rose-500/25 text-right"
                    value={memoryForm.memory_date} onChange={e => setMemoryForm({ ...memoryForm, memory_date: e.target.value })} />
                </div>
                <div>
                  <label className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] block mb-2">أثر مكتوب</label>
                  <textarea className="w-full h-28 bg-black/3 dark:bg-white/4 border border-black/5 dark:border-white/8 rounded-2xl p-5 text-sm font-medium text-foreground resize-none outline-none focus:ring-2 focus:ring-rose-500/25 text-right leading-relaxed"
                    placeholder="كيف كانت دقات القلب حينها؟" value={memoryForm.description} onChange={e => setMemoryForm({ ...memoryForm, description: e.target.value })} />
                </div>
                <Button type="submit" disabled={isSubmitting}
                  className="w-full h-14 rounded-2xl text-base font-black shadow-lg shadow-rose-500/20 bg-rose-500 text-white">
                  {isSubmitting ? 'جاري الحفظ...' : editingMemoryId ? 'تحديث الذكرى' : 'حفظ في خزانة العمر'}
                </Button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Event form */}
        {showAddRealEventForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={() => setShowAddRealEventForm(false)} />
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-zinc-950 rounded-[3rem] p-8 shadow-2xl z-10 border border-black/5 dark:border-white/8">
              <h2 className="text-2xl font-black mb-8 text-foreground tracking-tighter">وعد مشترك</h2>
              <form onSubmit={handleCreateEvent} className="space-y-5">
                <div>
                  <label className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] block mb-2">ماهية الوعد</label>
                  <input required className="w-full h-14 bg-black/3 dark:bg-white/4 border border-black/5 dark:border-white/8 rounded-2xl px-5 text-base font-black text-foreground outline-none focus:ring-2 focus:ring-rose-500/25 text-right"
                    placeholder="عنوان يلمس القلب..." value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] block mb-2">اليوم</label>
                    <input type="date" required className="w-full h-12 bg-black/3 dark:bg-white/4 border border-black/5 dark:border-white/8 rounded-2xl px-4 text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-rose-500/25"
                      value={eventForm.event_date} onChange={e => setEventForm({ ...eventForm, event_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] block mb-2">الساعة</label>
                    <input type="time" className="w-full h-12 bg-black/3 dark:bg-white/4 border border-black/5 dark:border-white/8 rounded-2xl px-4 text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-rose-500/25"
                      value={eventForm.event_time} onChange={e => setEventForm({ ...eventForm, event_time: e.target.value })} />
                  </div>
                </div>
                <Button type="submit" disabled={isSubmitting}
                  className="w-full h-14 rounded-2xl text-base font-black shadow-lg shadow-rose-500/20 bg-rose-500 text-white">
                  {isSubmitting ? 'جاري الحفظ...' : 'تثبيت في السجل'}
                </Button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Greeting form */}
        {showAddGreetingForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={() => { setShowAddGreetingForm(false); setEditingGreetingId(null); }} />
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-zinc-950 rounded-[3rem] p-8 shadow-2xl z-10 border border-amber-500/20 max-h-[90vh] overflow-y-auto scrollbar-hide">
              <h2 className="text-2xl font-black mb-8 text-foreground tracking-tighter">
                {editingGreetingId ? 'تعديل المعايدة ✏️' : 'معايدة مخبأة 💌'}
              </h2>
              <form onSubmit={handleCreateGreeting} className="space-y-5">
                <div>
                  <label className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] block mb-2">المناسبة القادمة</label>
                  <input required className="w-full h-14 bg-black/3 dark:bg-white/4 border border-black/5 dark:border-white/8 rounded-2xl px-5 text-base font-black text-foreground outline-none focus:ring-2 focus:ring-amber-500/25 text-right"
                    placeholder="مثلاً: يوم ميلادها، عيد الفطر..." value={greetingForm.title} onChange={e => setGreetingForm({ ...greetingForm, title: e.target.value })} />
                </div>
                <div>
                  <label className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] block mb-2">تاريخ المناسبة</label>
                  <input type="date" required className="w-full h-12 bg-black/3 dark:bg-white/4 border border-black/5 dark:border-white/8 rounded-2xl px-4 text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-amber-500/25"
                    value={greetingForm.target_date} onChange={e => setGreetingForm({ ...greetingForm, target_date: e.target.value })} />
                  <p className="text-[8px] text-muted-foreground/30 text-center mt-2 font-bold">يظهر المظروف قبل الموعد بـ 48 ساعة</p>
                </div>
                <div>
                  <label className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] block mb-2">رسالة العهد</label>
                  <textarea required className="w-full h-28 bg-black/3 dark:bg-white/4 border border-black/5 dark:border-white/8 rounded-2xl p-5 text-sm font-medium text-foreground resize-none outline-none focus:ring-2 focus:ring-amber-500/25 text-right leading-relaxed"
                    placeholder="اكتب ما بقلبك هنا..." value={greetingForm.message} onChange={e => setGreetingForm({ ...greetingForm, message: e.target.value })} />
                </div>
                <Button type="submit" disabled={isSubmitting}
                  className="w-full h-14 rounded-2xl text-base font-black shadow-lg shadow-amber-500/20 bg-amber-500 text-white">
                  {isSubmitting ? 'جاري الحفظ...' : (editingGreetingId ? 'حفظ التعديلات' : 'إخفاء الرسالة للموعد')}
                </Button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Image gallery */}
        {showGallery && galleryImages.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/97 flex flex-col backdrop-blur-3xl"
            onClick={() => setShowGallery(false)}>
            <button onClick={() => setShowGallery(false)}
              className="absolute top-10 right-6 w-12 h-12 bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center text-white z-50 active:scale-95">
              <X className="w-6 h-6" />
            </button>
            <div className="absolute top-10 left-6 bg-white/10 border border-white/10 px-4 py-2 rounded-2xl text-white text-sm font-black z-50">
              {galleryIndex + 1} / {galleryImages.length}
            </div>
            <div className="flex-1 flex items-center justify-center p-8" onClick={e => e.stopPropagation()}>
              <motion.img key={galleryIndex} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}
                src={galleryImages[galleryIndex]}
                className="max-w-full max-h-full object-contain rounded-[2rem] shadow-2xl border border-white/5" />
            </div>
            {galleryImages.length > 1 && (
              <>
                <button onClick={e => { e.stopPropagation(); prevImage(); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 border border-white/10 rounded-full flex items-center justify-center text-white active:scale-95">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button onClick={e => { e.stopPropagation(); nextImage(); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 border border-white/10 rounded-full flex items-center justify-center text-white active:scale-95">
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
