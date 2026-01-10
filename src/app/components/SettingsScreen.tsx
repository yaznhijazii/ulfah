import { ArrowLeft, Lock, Bell, Calendar, Gamepad2, Link as LinkIcon, Copy, Check, LogOut } from 'lucide-react';
import { Input } from './ui/input';
import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { supabase } from '../../lib/supabase';

interface SettingsScreenProps {
  onNavigate: (screen: string) => void;
  userId: string;
  onLogout?: () => void;
  onPartnershipCreated?: () => void;
}

export function SettingsScreen({ onNavigate, userId, onLogout, onPartnershipCreated }: SettingsScreenProps) {
  const [relationshipDate, setRelationshipDate] = useState('');
  const [moodTime, setMoodTime] = useState('12:00');
  const [isLinked, setIsLinked] = useState(false);
  const [myCode, setMyCode] = useState('');
  const [partnerCode, setPartnerCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLinkingSection, setShowLinkingSection] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [partnershipId, setPartnershipId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('');

  useEffect(() => {
    checkLinkStatus();
  }, [userId]);

  const checkLinkStatus = async () => {
    try {
      // التحقق من وجود شراكة نشطة
      const { data: partnership, error: partnershipError } = await supabase
        .from('partnerships')
        .select('*, users!partnerships_user1_id_fkey(name), users!partnerships_user2_id_fkey(name)')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .eq('is_active', true)
        .single();

      if (partnership && !partnershipError) {
        setIsLinked(true);
        setPartnershipId(partnership.id);
        setRelationshipDate(partnership.relationship_start_date);
        
        // تحديد اسم الشريك
        const partner = partnership.user1_id === userId 
          ? partnership['users!partnerships_user2_id_fkey']
          : partnership['users!partnerships_user1_id_fkey'];
        
        if (partner && typeof partner === 'object' && 'name' in partner) {
          setPartnerName(partner.name);
        }
      } else {
        // التحقق من وجود كود ربط محفوظ
        const { data: user } = await supabase
          .from('users')
          .select('linking_code')
          .eq('id', userId)
          .single();

        if (user && user.linking_code) {
          setMyCode(user.linking_code);
          setShowLinkingSection(true);
        }
      }
    } catch (err) {
      console.error('Error checking link status:', err);
    }
  };

  const generateCode = async () => {
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // حفظ الكود في قاعدة البيانات
      const { error: updateError } = await supabase
        .from('users')
        .update({ linking_code: code })
        .eq('id', userId);

      if (!updateError) {
        setMyCode(code);
      } else {
        console.error('Error saving code:', updateError);
      }
    } catch (err) {
      console.error('Error generating code:', err);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!partnerCode || partnerCode.length !== 6) {
      setError('الرجاء إدخال كود مكون من 6 أرقام');
      return;
    }

    if (partnerCode === myCode) {
      setError('لا يمكنك إدخال الكود الخاص بك!');
      return;
    }

    if (!relationshipDate) {
      setError('الرجاء إدخال تاريخ بداية العلاقة');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // البحث عن المستخدم الشريك باستخدام الكود
      const { data: partner, error: partnerError } = await supabase
        .from('users')
        .select('id, name')
        .eq('linking_code', partnerCode)
        .single();

      if (partnerError || !partner) {
        setError('الكود غير صحيح أو غير موجود');
        setLoading(false);
        return;
      }

      if (partner.id === userId) {
        setError('لا يمكنك الربط مع نفسك!');
        setLoading(false);
        return;
      }

      // التحقق من عدم وجود شراكة سابقة للشريك
      const { data: existingPartnership } = await supabase
        .from('partnerships')
        .select('id')
        .or(`user1_id.eq.${partner.id},user2_id.eq.${partner.id}`)
        .eq('is_active', true)
        .single();

      if (existingPartnership) {
        setError('الشريك مرتبط بالفعل بحساب آخر');
        setLoading(false);
        return;
      }

      // إنشاء الشراكة
      const { data: newPartnership, error: createError } = await supabase
        .from('partnerships')
        .insert([
          {
            user1_id: userId,
            user2_id: partner.id,
            relationship_start_date: relationshipDate,
            is_active: true,
            locked_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (createError) {
        console.error('Error creating partnership:', createError);
        setError('حدث خطأ أثناء الربط');
        setLoading(false);
        return;
      }

      // مسح أكواد الربط من كلا المستخدمين
      await supabase
        .from('users')
        .update({ linking_code: null })
        .in('id', [userId, partner.id]);

      // تحديث الحالة
      setIsLinked(true);
      setPartnershipId(newPartnership.id);
      setPartnerName(partner.name);
      setShowLinkingSection(false);
      setLoading(false);

      // استدعاء الدالة عند إنشاء الشراكة
      if (onPartnershipCreated) {
        onPartnershipCreated();
      }
    } catch (err) {
      console.error('Link error:', err);
      setError('حدث خطأ غير متوقع');
      setLoading(false);
    }
  };

  const handleRelationshipDateUpdate = async (newDate: string) => {
    setRelationshipDate(newDate);
    
    if (partnershipId) {
      // تحديث تاريخ العلاقة في قاعدة البيانات
      await supabase
        .from('partnerships')
        .update({ relationship_start_date: newDate })
        .eq('id', partnershipId);
    }
  };

  const handleLogout = () => {
    // TODO: Clear Supabase session
    if (onLogout) {
      onLogout();
    } else {
      onNavigate('login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50 pb-24">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="w-9" />
            <h1 className="text-lg text-gray-800">الإعدادات</h1>
            <button
              onClick={() => onNavigate('home')}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
        {/* Partner Linking Section */}
        {!isLinked ? (
          <div className="bg-white rounded-3xl shadow-lg p-6">
            <h3 className="text-lg text-gray-800 mb-4 flex items-center gap-2 justify-end">
              ربط الشريك
              <LinkIcon className="w-5 h-5 text-rose-500" />
            </h3>

            {!showLinkingSection ? (
              <button
                onClick={() => {
                  setShowLinkingSection(true);
                  generateCode();
                }}
                className="w-full p-4 rounded-2xl border-2 border-rose-200 bg-gradient-to-br from-pink-50 to-rose-50 hover:from-pink-100 hover:to-rose-100 transition-all text-right"
              >
                <p className="text-gray-800">ابدأ ربط الشريك</p>
                <p className="text-sm text-gray-500 mt-1">
                  احصل على كود خاص واربط حسابك مع شريكك
                </p>
              </button>
            ) : (
              <div className="space-y-4">
                {/* My Code */}
                <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl p-4">
                  <p className="text-sm text-gray-600 mb-2 text-center">كودك الخاص</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white rounded-xl p-3 text-center">
                      <p className="text-2xl font-mono tracking-wider text-gray-800">
                        {myCode || '------'}
                      </p>
                    </div>
                    <button
                      onClick={handleCopy}
                      className="p-3 bg-white rounded-xl hover:bg-gray-50 transition-colors"
                      disabled={!myCode}
                    >
                      {copied ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5 text-gray-600" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    شارك هذا الكود مع شريكك
                  </p>
                </div>

                {/* Partner Code */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500">أو</span>
                  </div>
                </div>

                <form onSubmit={handleLink} className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-600 mb-2 block text-right">
                      تاريخ بداية العلاقة
                    </label>
                    <Input
                      type="date"
                      value={relationshipDate}
                      onChange={(e) => {
                        setRelationshipDate(e.target.value);
                        setError('');
                      }}
                      className="rounded-2xl border-gray-200 focus:border-rose-300 focus:ring-rose-200"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 mb-2 block text-right">
                      أدخل كود الشريك
                    </label>
                    <Input
                      type="text"
                      placeholder="000000"
                      value={partnerCode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setPartnerCode(value);
                        setError('');
                      }}
                      className="rounded-2xl border-gray-200 focus:border-rose-300 focus:ring-rose-200 text-center text-xl font-mono tracking-wider"
                      maxLength={6}
                      dir="ltr"
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-red-500 mt-2 text-center">{error}</p>
                  )}

                  <Button
                    type="submit"
                    disabled={!partnerCode || partnerCode.length !== 6 || !relationshipDate || loading}
                    className="w-full bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white rounded-2xl h-11 shadow-md disabled:opacity-50"
                  >
                    {loading ? 'جاري الربط...' : 'ربط الشريك'}
                  </Button>
                </form>

                <p className="text-xs text-gray-500 text-center pt-2">
                  💝 هذا الربط دائم ولا يمكن إلغاؤه
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Linked Status */
          <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-3xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex-1 text-right">
                <h4 className="text-gray-800 mb-2">مرتبطان للأبد</h4>
                <p className="text-sm text-gray-600">
                  علاقتك مغلقة كرمز للالتزام. لا يمكن إزالة أو تغيير هذا الارتباط.
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                <Lock className="w-6 h-6 text-rose-500" />
              </div>
            </div>
          </div>
        )}

        {/* Relationship Settings */}
        <div className="bg-white rounded-3xl shadow-lg p-6">
          <h3 className="text-lg text-gray-800 mb-4 flex items-center gap-2 justify-end">
            العلاقة
            <Calendar className="w-5 h-5 text-rose-500" />
          </h3>
          <div>
            <label className="text-sm text-gray-600 mb-2 block text-right">تاريخ البداية</label>
            <Input
              type="date"
              value={relationshipDate}
              onChange={(e) => handleRelationshipDateUpdate(e.target.value)}
              className="rounded-2xl border-gray-200 focus:border-rose-300 focus:ring-rose-200"
              dir="ltr"
            />
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-3xl shadow-lg p-6">
          <h3 className="text-lg text-gray-800 mb-4 flex items-center gap-2 justify-end">
            الإشعارات
            <Bell className="w-5 h-5 text-rose-500" />
          </h3>
          <div>
            <label className="text-sm text-gray-600 mb-2 block text-right">وقت سؤال المزاج اليومي</label>
            <Input
              type="time"
              value={moodTime}
              onChange={(e) => setMoodTime(e.target.value)}
              className="rounded-2xl border-gray-200 focus:border-rose-300 focus:ring-rose-200"
              dir="ltr"
            />
            <p className="text-xs text-gray-500 mt-2 text-right">
              ستتلقى إشعارًا لمشاركة مزاجك
            </p>
          </div>
        </div>

        {/* Game Settings */}
        <div className="bg-white rounded-3xl shadow-lg p-6">
          <h3 className="text-lg text-gray-800 mb-4 flex items-center gap-2 justify-end">
            الألعاب
            <Gamepad2 className="w-5 h-5 text-rose-500" />
          </h3>
          <button className="w-full p-4 rounded-2xl border-2 border-gray-200 hover:border-rose-200 hover:bg-gray-50 transition-all text-right">
            <p className="text-gray-700">إضافة أسئلة مخصصة</p>
            <p className="text-sm text-gray-500 mt-1">أنشئ أسئلة لعبتك الخاصة</p>
          </button>
        </div>

        {/* Account Info */}
        {isLinked && (
          <div className="bg-white rounded-3xl shadow-lg p-6">
            <h3 className="text-lg text-gray-800 mb-4 text-right">الحساب</h3>
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gray-50 text-right">
                <p className="text-sm text-gray-500 mb-1">البريد الإلكتروني</p>
                <p className="text-gray-700" dir="ltr">you@example.com</p>
              </div>
              <div className="p-4 rounded-2xl bg-gray-50 text-right">
                <p className="text-sm text-gray-500 mb-1">الشريك</p>
                <p className="text-gray-700" dir="ltr">{partnerName}</p>
              </div>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <div className="bg-white rounded-3xl shadow-lg p-6">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full p-4 rounded-2xl border-2 border-red-200 bg-red-50 hover:bg-red-100 transition-all flex items-center justify-center gap-2 text-red-600"
          >
            <LogOut className="w-5 h-5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>

        {/* App Info */}
        <div className="text-center py-6">
          <p className="text-xs text-gray-400">أُلْفَة v1.0.0</p>
          <p className="text-xs text-gray-400 mt-1">صُنع بحب</p>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50" dir="rtl">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full">
            <h3 className="text-lg text-gray-800 mb-2 text-center">تسجيل الخروج</h3>
            <p className="text-sm text-gray-600 text-center mb-6">
              هل أنت متأكد أنك تريد تسجيل الخروج؟
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-2xl"
              >
                إلغاء
              </Button>
              <Button
                onClick={handleLogout}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-2xl"
              >
                تسجيل الخروج
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}