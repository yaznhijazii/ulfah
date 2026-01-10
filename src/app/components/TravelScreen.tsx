import { ArrowLeft, Plus, MapPin, Edit, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { useState } from 'react';

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
      note: 'مدينة الحب',
    },
    {
      id: 2,
      name: 'سانتوريني، اليونان',
      date: 'أغسطس 2025',
      image: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800&q=80',
      note: 'القباب الزرقاء والغروب',
    },
  ]);

  const [plannedTrips, setPlannedTrips] = useState<Place[]>([
    {
      id: 1,
      name: 'طوكيو، اليابان',
      date: 'مارس 2026',
      image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
      note: 'موسم أزهار الكرز',
    },
    {
      id: 2,
      name: 'آيسلندا',
      date: 'يونيو 2026',
      image: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=800&q=80',
      note: 'مغامرة الشفق القطبي',
    },
  ]);

  const [dreamDestinations, setDreamDestinations] = useState<Place[]>([
    {
      id: 1,
      name: 'المالديف',
      image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&q=80',
      note: 'بيوت فوق الماء',
    },
    {
      id: 2,
      name: 'نيوزيلندا',
      image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80',
      note: 'جنة المغامرات',
    },
    {
      id: 3,
      name: 'سويسرا',
      image: 'https://images.unsplash.com/photo-1527004013197-933c4bb611b3?w=800&q=80',
      note: 'جمال جبال الألب',
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50 pb-24">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              size="sm"
              className="bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl"
            >
              <Plus className="w-4 h-4 ml-1" />
              إضافة
            </Button>
            <h1 className="text-lg text-gray-800">السفر</h1>
            <button
              onClick={() => onNavigate('home')}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('traveled')}
              className={`flex-1 py-2 rounded-xl text-sm transition-all ${
                activeTab === 'traveled'
                  ? 'bg-gradient-to-r from-pink-400 to-rose-400 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              سافرنا
            </button>
            <button
              onClick={() => setActiveTab('planned')}
              className={`flex-1 py-2 rounded-xl text-sm transition-all ${
                activeTab === 'planned'
                  ? 'bg-gradient-to-r from-pink-400 to-rose-400 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              مخطط
            </button>
            <button
              onClick={() => setActiveTab('dream')}
              className={`flex-1 py-2 rounded-xl text-sm transition-all ${
                activeTab === 'dream'
                  ? 'bg-gradient-to-r from-pink-400 to-rose-400 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              أحلامنا
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6">
        <div className="space-y-4">
          {getCurrentData().map((place) => (
            <div
              key={place.id}
              className="bg-white rounded-3xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
            >
              <div className="relative h-48 overflow-hidden">
                <img src={place.image} alt={place.name} className="w-full h-full object-cover" />
                <div className="absolute top-4 right-4">
                  <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2">
                    <span className="text-sm text-gray-700">{place.name}</span>
                    <MapPin className="w-4 h-4 text-rose-500" />
                  </div>
                </div>
              </div>
              <div className="p-6 text-right">
                {'date' in place && (
                  <p className="text-sm text-gray-500 mb-2">{place.date}</p>
                )}
                <p className="text-gray-600">{place.note}</p>
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => {
                      setSelectedPlace(place);
                      setShowDeleteConfirm(true);
                    }}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      // Handle edit
                    }}
                    className="text-gray-500 hover:text-gray-600 ml-2"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && selectedPlace && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-lg font-bold mb-4">تأكيد الحذف</h2>
            <p className="text-gray-600 mb-4">هل أنت متأكد من أنك تريد حذف {selectedPlace.name}؟</p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="bg-gray-200 text-gray-600 px-4 py-2 rounded mr-2"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleDelete(selectedPlace.id)}
                className="bg-red-500 text-white px-4 py-2 rounded"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}