import { ArrowLeft, Plus, MapPin, Edit, Trash2, Camera, Globe, Compass, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface TravelScreenProps {
  onNavigate: (screen: string) => void;
}

type Place = {
  id: number;
  name: string;
  date?: string;
  image: string;
  note: string;
};

export function TravelScreen({ onNavigate }: TravelScreenProps) {
  const [activeTab, setActiveTab] = useState<'traveled' | 'planned' | 'dream'>('traveled');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  const [traveledPlaces, setTraveledPlaces] = useState<Place[]>([
    {
      id: 1,
      name: 'باريس، فرنسا',
      date: 'ديسمبر 2025',
      image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80',
      note: 'مدينة الحب ومطلع الذكريات الجميلة',
    },
    {
      id: 2,
      name: 'سانتوريني، اليونان',
      date: 'أغسطس 2025',
      image: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800&q=80',
      note: 'القباب الزرقاء وغروب لا ينسى',
    },
  ]);

  const [plannedTrips, setPlannedTrips] = useState<Place[]>([
    {
      id: 1,
      name: 'طوكيو، اليابان',
      date: 'مارس 2026',
      image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
      note: 'موسم أزهار الكرز الساحر',
    },
    {
      id: 2,
      name: 'آيسلندا',
      date: 'يونيو 2026',
      image: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=800&q=80',
      note: 'مغامرة الشفق القطبي وبلاد الجليد',
    },
  ]);

  const [dreamDestinations, setDreamDestinations] = useState<Place[]>([
    {
      id: 1,
      name: 'المالديف',
      image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&q=80',
      note: 'بيوت فوق الماء واسترخاء تام',
    },
    {
      id: 2,
      name: 'نيوزيلندا',
      image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80',
      note: 'جنة المغامرات والطبيعة البكر',
    },
    {
      id: 3,
      name: 'سويسرا',
      image: 'https://images.unsplash.com/photo-1527004013197-933c4bb611b3?w=800&q=80',
      note: 'جمال جبال الألب والسكينة المطلقة',
    },
  ]);

  const getCurrentData = () => {
    if (activeTab === 'traveled') return traveledPlaces;
    if (activeTab === 'planned') return plannedTrips;
    return dreamDestinations;
  };

  const handleDelete = (id: number) => {
    if (activeTab === 'traveled') {
      setTraveledPlaces(traveledPlaces.filter(p => p.id !== id));
    } else if (activeTab === 'planned') {
      setPlannedTrips(plannedTrips.filter(p => p.id !== id));
    } else {
      setDreamDestinations(dreamDestinations.filter(p => p.id !== id));
    }
    setShowDeleteConfirm(false);
    setSelectedPlace(null);
  };

  const tabs = [
    { id: 'traveled', label: 'سافرنا', icon: Globe },
    { id: 'planned', label: 'مخطط', icon: Compass },
    { id: 'dream', label: 'أحلامنا', icon: Sparkles },
  ];

  return (
    <div className="flex-1 bg-background flex flex-col relative h-full overflow-hidden">
      {/* Header */}
      <header className="px-8 pt-12 pb-6 sticky top-0 bg-background/60 backdrop-blur-3xl z-30">
        <div className="flex items-center justify-between mb-10">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => onNavigate('home')} className="w-12 h-12 flex items-center justify-center glass rounded-2xl border-white/20 shadow-sm text-foreground/70">
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <div className="text-center">
            <h1 className="text-xl font-black text-foreground tracking-tight">سجل الترحال</h1>
            <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em]">رحلاتنا.. وأحلامنا الموعودة</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
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
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-10"
          >
            {getCurrentData().map((place, idx) => (
              <motion.div
                key={place.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="group relative"
              >
                <div className="aspect-[4/5] rounded-[3.5rem] overflow-hidden relative shadow-2xl glass border-white/20">
                  <img src={place.image} alt={place.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2s]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  <div className="absolute top-8 right-8">
                    <div className="glass-dark border-white/20 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-2xl">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span className="text-xs font-black text-white tracking-tight">{place.name}</span>
                    </div>
                  </div>

                  <div className="absolute bottom-8 left-8 right-8 text-right space-y-3">
                    {'date' in place && (
                      <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">{place.date}</p>
                    )}
                    <p className="text-xl font-black text-white leading-tight tracking-tight px-2">{place.note}</p>

                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={() => { setSelectedPlace(place); setShowDeleteConfirm(true); }}
                        className="w-10 h-10 glass-dark border-rose-500/20 text-rose-500 rounded-xl flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.8 }}
                        className="w-10 h-10 glass-dark border-white/20 text-white rounded-xl flex items-center justify-center"
                      >
                        <Edit className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && selectedPlace && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-2xl" onClick={() => setShowDeleteConfirm(false)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="relative w-full max-w-[320px] glass border-white/30 rounded-[3.5rem] p-10 z-10 text-center shadow-2xl"
            >
              <div className="w-20 h-20 rounded-[2rem] glass-dark border-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-8 shadow-inner">
                <Trash2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black mb-3 tracking-tighter">حذف الذكرى؟</h3>
              <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-10 leading-relaxed px-2">هل أنتِ متأكدة من حذف مسار {selectedPlace.name} من السجل؟</p>

              <div className="flex flex-col gap-4">
                <Button
                  variant="destructive"
                  className="w-full h-16 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-rose-500/10 leading-none"
                  onClick={() => handleDelete(selectedPlace.id)}
                >
                  نعم، احذفها
                </Button>
                <button
                  className="w-full h-12 rounded-[2rem] font-black text-xs text-muted-foreground hover:bg-white/5 transition-all"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  تراجع
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}