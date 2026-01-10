import { ArrowLeft, Plus, Heart, Trash2, X, Upload, MapPin, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from './ui/button';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Memory, MemoryImage } from '../../lib/supabase';

interface MemoryWithImages extends Memory {
  images?: MemoryImage[];
}

interface MemoriesScreenProps {
  onNavigate: (screen: string) => void;
  userId: string;
  partnershipId: string | null;
}

export function MemoriesScreen({ onNavigate, userId, partnershipId }: MemoriesScreenProps) {
  const [memories, setMemories] = useState<MemoryWithImages[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    memory_date: '',
    location: '',
  });

  useEffect(() => {
    if (partnershipId) {
      loadMemories();
    }
  }, [partnershipId]);

  const loadMemories = async () => {
    if (!partnershipId) return;

    try {
      const { data, error } = await supabase
        .from('memories')
        .select(`
          *,
          images:memory_images(*)
        `)
        .eq('partnership_id', partnershipId)
        .order('memory_date', { ascending: false });

      if (!error && data) {
        setMemories(data);
      }
    } catch (err) {
      console.error('Error loading memories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('memories')
        .delete()
        .eq('id', id);

      if (!error) {
        setMemories(memories.filter(m => m.id !== id));
      }
    } catch (err) {
      console.error('Error deleting memory:', err);
    }
    
    setShowDeleteConfirm(false);
    setSelectedMemory(null);
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!partnershipId || !formData.title || !formData.memory_date) return;

    try {
      // إضافة الذكرى
      const { data: memoryData, error: memoryError } = await supabase
        .from('memories')
        .insert([{
          partnership_id: partnershipId,
          created_by_user_id: userId,
          title: formData.title,
          description: formData.description,
          memory_date: formData.memory_date,
          location: formData.location,
        }])
        .select()
        .single();

      if (memoryError || !memoryData) {
        console.error('Error adding memory:', memoryError);
        return;
      }

      // إضافة الصور إذا كانت موجودة
      if (selectedImages.length > 0) {
        const imageInserts = selectedImages.map((imageUrl, index) => ({
          memory_id: memoryData.id,
          image_url: imageUrl,
          order_index: index,
        }));

        const { error: imagesError } = await supabase
          .from('memory_images')
          .insert(imageInserts);

        if (imagesError) {
          console.error('Error adding images:', imagesError);
        }
      }

      // تحديث القائمة
      await loadMemories();
      
      setShowAddForm(false);
      setSelectedImages([]);
      setFormData({
        title: '',
        description: '',
        memory_date: '',
        location: '',
      });
    } catch (err) {
      console.error('Error adding memory:', err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
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
            <h1 className="text-lg text-gray-800">الذكريات</h1>
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
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">جاري التحميل...</p>
          </div>
        ) : memories.length === 0 ? (
          <div className="text-center py-12">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">لا توجد ذكريات بعد</p>
            <p className="text-sm text-gray-500">ابدأ بإضافة ذكرياتكم الجميلة</p>
          </div>
        ) : (
          <div className="space-y-4">
            {memories.map((memory) => (
              <div
                key={memory.id}
                className="bg-white rounded-3xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                {/* Image Gallery */}
                {memory.images && memory.images.length > 0 && (
                  <div className={memory.images.length === 1 ? "" : "grid grid-cols-2 gap-1"}>
                    {memory.images.slice(0, 4).map((image, index) => (
                      <div key={image.id} className="relative">
                        <img
                          src={image.image_url}
                          alt={`${memory.title} - صورة ${index + 1}`}
                          className={`w-full object-cover ${
                            memory.images!.length === 1 
                              ? 'h-72' 
                              : memory.images!.length === 2 
                              ? 'h-64' 
                              : 'h-48'
                          }`}
                        />
                        {index === 3 && memory.images!.length > 4 && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-white text-2xl">+{memory.images!.length - 4}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-6 text-right">
                  <div className="flex items-start justify-between mb-2">
                    <button
                      onClick={() => {
                        setSelectedMemory(memory.id);
                        setShowDeleteConfirm(true);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-5 h-5 text-gray-600" />
                    </button>
                    <div className="flex-1">
                      <h3 className="text-xl text-gray-800 mb-2">{memory.title}</h3>
                      <div className="flex items-center gap-2 mb-3 justify-end">
                        <span className="text-sm text-gray-500">{formatDate(memory.memory_date)}</span>
                        <CalendarIcon className="w-4 h-4 text-gray-400" />
                      </div>
                      {memory.description && (
                        <p className="text-gray-600 mb-2">{memory.description}</p>
                      )}
                      {memory.location && (
                        <div className="flex items-center gap-1 justify-end text-sm text-gray-500">
                          <span>{memory.location}</span>
                          <MapPin className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedMemory !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" dir="rtl">
          <div className="bg-white p-6 rounded-3xl shadow-lg max-w-sm w-full">
            <h2 className="text-lg mb-4 text-gray-800 text-center">تأكيد الحذف</h2>
            <p className="text-gray-600 mb-6 text-center">هل أنت متأكد من حذف هذه الذكرى؟</p>
            <div className="flex gap-3">
              <Button
                size="sm"
                className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-2xl"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedMemory(null);
                }}
              >
                إلغاء
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-2xl"
                onClick={() => handleDelete(selectedMemory)}
              >
                حذف
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Memory Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" dir="rtl">
          <div className="bg-white p-6 rounded-3xl shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl mb-4 text-gray-800 text-center">إضافة ذكرى جديدة</h2>
            
            <form onSubmit={handleAddMemory} className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 mb-2 block text-right">عنوان الذكرى</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="مثلاً: رحلة إلى البحر"
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-right"
                  required
                />
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-2 block text-right">التاريخ</label>
                <input
                  type="date"
                  value={formData.memory_date}
                  onChange={(e) => setFormData({ ...formData, memory_date: e.target.value })}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3"
                  dir="ltr"
                  required
                />
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-2 block text-right">الموقع (اختياري)</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="مثلاً: شاطئ العقير"
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-right"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-2 block text-right">الوصف (اختياري)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="اكتب تفاصيل الذكرى..."
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-right min-h-[100px]"
                  rows={4}
                />
              </div>

              {/* Image Upload Section */}
              <div>
                <label className="text-sm text-gray-600 mb-2 block text-right">الصور (اختياري)</label>
                <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:border-pink-400 transition-colors">
                  <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-2">اضغط لإضافة صور</p>
                  <p className="text-xs text-gray-500">يمكنك إضافة عدة صور</p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      files.forEach(file => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setSelectedImages(prev => [...prev, reader.result as string]);
                        };
                        reader.readAsDataURL(file);
                      });
                    }}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="inline-block mt-2 px-4 py-2 bg-pink-50 text-pink-600 rounded-xl cursor-pointer hover:bg-pink-100 transition-colors text-sm"
                  >
                    اختيار الصور
                  </label>
                </div>
                
                {/* Image Preview Grid */}
                {selectedImages.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {selectedImages.map((img, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={img}
                          alt={`صورة ${index + 1}`}
                          className="w-full h-24 object-cover rounded-xl"
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== index))}
                          className="absolute top-1 left-1 p-1 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setSelectedImages([]);
                    setFormData({
                      title: '',
                      description: '',
                      memory_date: '',
                      location: '',
                    });
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-2xl"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white rounded-2xl"
                >
                  إضافة
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}