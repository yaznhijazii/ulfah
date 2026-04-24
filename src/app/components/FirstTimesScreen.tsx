import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Plus, Calendar, Camera, Trash2, Edit2, 
  Sparkles, Heart, Clock, X, Upload, ImageIcon,
  Compass, Star, MapPin
} from 'lucide-react';
import { Button } from './ui/button';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface FirstTimesScreenProps {
  onNavigate: (screen: string) => void;
  userId: string;
  partnershipId: string | null;
  isDarkMode: boolean;
}

interface FirstTimeItem {
  id: string;
  title: string;
  description: string;
  event_date: string;
  image_url: string | null;
  created_at: string;
}

export function FirstTimesScreen({ onNavigate, userId, partnershipId, isDarkMode }: FirstTimesScreenProps) {
  const [items, setItems] = useState<FirstTimeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<FirstTimeItem | null>(null);

  // Form State
  const [form, setForm] = useState({
    title: '',
    description: '',
    event_date: new Date().toISOString().split('T')[0]
  });
  const [selectedImage, setSelectedImage] = useState<{ file?: File; preview: string } | null>(null);

  useEffect(() => {
    if (partnershipId) {
      loadItems();
    }
  }, [partnershipId]);

  const loadItems = async () => {
    if (!partnershipId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('first_times')
        .select('*')
        .eq('partnership_id', partnershipId)
        .order('event_date', { ascending: true });

      if (error) {
        // If table doesn't exist, we might need to handle it or use a fallback
        console.error('Error loading first times:', error);
      } else {
        setItems(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setSelectedImage({ file, preview: ev.target?.result as string });
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnershipId || !form.title) return;
    setIsSubmitting(true);

    try {
      let imageUrl = editingItem?.image_url || null;

      // Upload image if selected
      if (selectedImage?.file) {
        const { compressImage } = await import('../../utils/imageOptimizer');
        let file = selectedImage.file;
        try { file = await compressImage(file, { maxWidth: 1200, quality: 0.7 }); } catch {}
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${partnershipId}/${Date.now()}.${fileExt}`;
        const { error: upErr } = await supabase.storage.from('memories').upload(`first_times/${fileName}`, file);
        
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('memories').getPublicUrl(`first_times/${fileName}`);
          imageUrl = publicUrl;
        }
      }

      const payload = {
        partnership_id: partnershipId,
        created_by_user_id: userId,
        title: form.title,
        description: form.description,
        event_date: form.event_date,
        image_url: imageUrl
      };

      if (editingItem) {
        const { error } = await supabase.from('first_times').update(payload).eq('id', editingItem.id);
        if (error) throw error;
        toast.success('تم تحديث اللحظة بنجاح ✨');
      } else {
        const { error } = await supabase.from('first_times').insert([payload]);
        if (error) throw error;
        toast.success('تم تخليد اللحظة في الدفتر 💖');
      }

      setShowAddForm(false);
      setEditingItem(null);
      setForm({ title: '', description: '', event_date: new Date().toISOString().split('T')[0] });
      setSelectedImage(null);
      loadItems();
    } catch (err: any) {
      console.error(err);
      toast.error(`خطأ: ${err.message || 'حدث خطأ غير متوقع'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه اللحظة؟')) return;
    const { error } = await supabase.from('first_times').delete().eq('id', id);
    if (!error) {
      toast.success('تم الحذف');
      loadItems();
    }
  };

  const openEdit = (item: FirstTimeItem) => {
    setEditingItem(item);
    setForm({
      title: item.title,
      description: item.description || '',
      event_date: item.event_date
    });
    setSelectedImage(item.image_url ? { preview: item.image_url } : null);
    setShowAddForm(true);
  };

  return (
    <div dir="rtl" className="flex-1 bg-[#fdf2f4] dark:bg-[#0a0508] flex flex-col relative h-full overflow-hidden">
      {/* Notebook Background */}
      <div className="absolute inset-0 pointer-events-none -z-10 bg-[#fbfaf5]" />
      
      {/* Notebook Texture & Pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] -z-10" 
           style={{ backgroundImage: 'radial-gradient(#000 0.5px, transparent 0.5px)', backgroundSize: '20px 20px' }} />

      {/* Header */}
      <header className="px-6 pt-10 pb-6 flex items-center justify-between sticky top-0 bg-[#fbfaf5]/80 backdrop-blur-xl z-30 border-b border-black/5">
        <motion.button 
          whileTap={{ scale: 0.9 }} 
          onClick={() => onNavigate('home')}
          className="w-11 h-11 flex items-center justify-center bg-white rounded-2xl shadow-sm border border-black/5"
        >
          <ArrowLeft className="w-5 h-5 text-rose-500" />
        </motion.button>
        
        <div className="text-center">
          <h1 className="text-xl font-black text-rose-950 tracking-tight">دفتر ذكرياتنا</h1>
          <p className="text-[9px] font-black text-rose-500/60 uppercase tracking-[0.3em] mt-1">حكايات بدأت بـ "أول مرة"</p>
        </div>

        <motion.button 
          whileTap={{ scale: 0.9 }} 
          onClick={() => {
            setEditingItem(null);
            setForm({ title: '', description: '', event_date: new Date().toISOString().split('T')[0] });
            setSelectedImage(null);
            setShowAddForm(true);
          }}
          className="w-11 h-11 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/30"
        >
          <Plus className="w-6 h-6" />
        </motion.button>
      </header>

      {/* Spiral Binder Visual */}
      <div className="sticky top-[92px] left-0 right-0 h-8 flex justify-around px-10 z-20 pointer-events-none overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="w-2.5 h-10 bg-gradient-to-b from-zinc-400 to-zinc-200 rounded-full shadow-md -mt-4 border border-zinc-500/20" />
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-x-auto snap-x snap-mandatory flex items-center px-6 gap-6 scrollbar-hide py-4">
        {loading ? (
          <div className="w-full flex flex-col items-center justify-center py-20 opacity-30">
            <Sparkles className="w-12 h-12 animate-pulse text-rose-400" />
            <p className="mt-4 font-black text-xs uppercase tracking-widest">جاري فتح الدفتر...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center py-32 text-center snap-center">
            <div className="w-32 h-32 rounded-full bg-rose-50 flex items-center justify-center mb-6 shadow-inner border-2 border-dashed border-rose-200">
              <Star className="w-12 h-12 text-rose-200" />
            </div>
            <h3 className="text-xl font-black text-rose-950/40 font-ruqaa">الدفتر لا يزال أبيضاً</h3>
            <p className="text-xs font-bold text-rose-500/30 mt-2 max-w-[200px]">سجل أول لقاء، أول ضحكة، أو أول وعد هنا..</p>
          </div>
        ) : (
          <>
            {items.map((item, idx) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, rotate: idx % 2 === 0 ? 1 : -1 }}
                whileInView={{ opacity: 1, rotate: 0 }}
                viewport={{ once: true }}
                className="min-w-[85vw] md:min-w-[320px] aspect-[3/4] bg-white shadow-[0_10px_40px_rgba(0,0,0,0.08)] rounded-sm border border-zinc-200 p-8 flex flex-col snap-center relative overflow-hidden"
              >
                {/* Paper Texture Overlay */}
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
                
                {/* Top Tape/Clip */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-6 bg-rose-500/10 border-x border-b border-rose-500/5 backdrop-blur-sm rounded-b-lg flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-rose-500/20" />
                </div>

                <div className="flex items-center justify-between mb-8 relative z-10">
                  <div className="text-right">
                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest block mb-1">بتاريخ</span>
                    <h4 className="text-lg font-black text-rose-950 font-ruqaa">
                      {new Date(item.event_date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </h4>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(item)} className="p-2.5 bg-rose-50 text-rose-400 rounded-xl hover:bg-rose-100 transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-2.5 bg-rose-50 text-rose-400 rounded-xl hover:bg-rose-100 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Entry Content */}
                <div className="flex-1 flex flex-col gap-6 relative z-10">
                  <h3 className="text-2xl font-black text-rose-900 font-ruqaa leading-tight text-center px-4">
                    {item.title}
                  </h3>

                  {item.image_url && (
                    <div className="relative group mx-auto w-full max-w-[240px]">
                      {/* Photo "Tape" */}
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-6 bg-white/40 border border-black/5 rotate-[-2deg] z-10" />
                      
                      <div className="aspect-square w-full rounded-sm p-2 bg-white shadow-md border border-zinc-100 rotate-[1deg] overflow-hidden group-hover:rotate-0 transition-transform duration-500">
                        <img 
                          src={item.image_url} 
                          alt={item.title} 
                          className="w-full h-full object-cover grayscale-[0.2] hover:grayscale-0 transition-all" 
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="flex-1 overflow-y-auto mt-4 px-2 custom-scrollbar">
                    <p className="text-lg font-medium text-rose-900/70 font-ruqaa leading-relaxed text-center">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Page Number / Footer */}
                <div className="mt-6 flex items-center justify-between border-t border-rose-100 pt-4 opacity-40">
                  <Heart size={12} className="text-rose-300 fill-rose-300" />
                  <span className="text-[10px] font-black tabular-nums">{idx + 1} / {items.length}</span>
                  <Sparkles size={12} className="text-rose-300" />
                </div>
              </motion.div>
            ))}
            
            {/* Blank End Page */}
            <div className="min-w-[85vw] md:min-w-[320px] aspect-[3/4] bg-white/40 border-2 border-dashed border-rose-200 rounded-sm flex flex-col items-center justify-center p-8 snap-center opacity-60">
              <Plus className="w-10 h-10 text-rose-200 mb-3" />
              <p className="font-ruqaa text-rose-300 text-lg">صفحة بانتظار ذكرى جديدة..</p>
            </div>
          </>
        )}
      </div>

      {/* CSS for custom fonts and scrollbar */}
      <style>{`
        .font-ruqaa { font-family: 'Aref Ruqaa', 'Cairo', serif; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(244,63,94,0.1); border-radius: 10px; }
      `}</style>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/60 backdrop-blur-md" 
              onClick={() => setShowAddForm(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, y: 50, opacity: 0 }} 
              animate={{ scale: 1, y: 0, opacity: 1 }} 
              exit={{ scale: 0.9, y: 50, opacity: 0 }} 
              className="relative bg-white dark:bg-[#121212] border border-rose-100 dark:border-white/10 rounded-[3rem] p-8 max-w-sm w-full shadow-4xl z-10 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-rose-500/10 to-transparent pointer-events-none" />
              
              <div className="flex items-center justify-between mb-8 relative z-10">
                <h3 className="text-xl font-black text-rose-950 dark:text-white">
                  {editingItem ? 'تعديل الذكرى' : 'بداية جديدة'}
                </h3>
                <button onClick={() => setShowAddForm(false)} className="p-2 bg-rose-50 dark:bg-white/5 rounded-xl text-rose-400">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-rose-500/60 uppercase tracking-widest mr-2">العنوان</label>
                  <input 
                    required 
                    value={form.title} 
                    onChange={e => setForm({...form, title: e.target.value})}
                    placeholder="مثلاً: أول لقاء لنا.."
                    className="w-full h-14 bg-rose-50/50 dark:bg-white/5 border border-rose-100 dark:border-white/10 rounded-2xl px-5 text-sm font-bold outline-none focus:border-rose-400 transition-all text-right"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-rose-500/60 uppercase tracking-widest mr-2">التاريخ</label>
                  <input 
                    type="date"
                    required 
                    value={form.event_date} 
                    onChange={e => setForm({...form, event_date: e.target.value})}
                    className="w-full h-14 bg-rose-50/50 dark:bg-white/5 border border-rose-100 dark:border-white/10 rounded-2xl px-5 text-sm font-bold outline-none focus:border-rose-400 transition-all text-center"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-rose-500/60 uppercase tracking-widest mr-2">التفاصيل</label>
                  <textarea 
                    value={form.description} 
                    onChange={e => setForm({...form, description: e.target.value})}
                    placeholder="كيف كان الشعور؟"
                    className="w-full h-32 bg-rose-50/50 dark:bg-white/5 border border-rose-100 dark:border-white/10 rounded-[2rem] p-5 text-sm font-medium outline-none focus:border-rose-400 transition-all text-right resize-none"
                  />
                </div>

                {/* Image Picker */}
                <div className="relative group">
                  <input type="file" accept="image/*" className="hidden" id="first-time-img" onChange={handleFileChange} />
                  <label htmlFor="first-time-img" className="w-full h-40 border-2 border-dashed border-rose-200 dark:border-white/10 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer hover:bg-rose-50/50 dark:hover:bg-white/5 transition-all overflow-hidden relative">
                    {selectedImage ? (
                      <>
                        <img src={selectedImage.preview} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera className="text-white" />
                        </div>
                      </>
                    ) : (
                      <>
                        <Camera className="w-8 h-8 text-rose-200 mb-2" />
                        <span className="text-[10px] font-black text-rose-300">أضف صورة للذكرى</span>
                      </>
                    )}
                  </label>
                </div>

                <Button 
                  disabled={isSubmitting}
                  className="w-full h-16 bg-rose-500 hover:bg-rose-600 text-white rounded-[1.8rem] font-black text-base shadow-xl shadow-rose-500/30 transition-all active:scale-95"
                >
                  {isSubmitting ? 'جاري التوثيق...' : (editingItem ? 'حفظ التعديلات' : 'تخليد البداية 🥂')}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
