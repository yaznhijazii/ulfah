import { ArrowLeft, Lock, Bell, Calendar, Gamepad2, Link as LinkIcon, Copy, Check, LogOut, ChevronLeft, ShieldCheck, Mail, Heart, Plus, User, Upload, Camera, Moon, Sun } from 'lucide-react';
import { Input } from './ui/input';
import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsScreenProps {
  onNavigate: (screen: string) => void;
  userId: string;
  partnershipId: string | null;
  onLogout?: () => void;
  onPartnershipCreated?: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export function SettingsScreen({
  onNavigate,
  userId,
  partnershipId: initialPartnershipId,
  onLogout,
  onPartnershipCreated,
  isDarkMode,
  onToggleDarkMode
}: SettingsScreenProps) {
  const [relationshipDate, setRelationshipDate] = useState('');
  const [isLinked, setIsLinked] = useState(!!initialPartnershipId);
  const [myCode, setMyCode] = useState('');
  const [partnerCode, setPartnerCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLinkingSection, setShowLinkingSection] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [partnershipId, setPartnershipId] = useState<string | null>(initialPartnershipId);
  const [partnerName, setPartnerName] = useState('');
  const [myName, setMyName] = useState('');
  const [myAvatar, setMyAvatar] = useState('');
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // New States for Settings
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [notifySettings, setNotifySettings] = useState({
    mood_reminder_enabled: true,
    daily_mood_time: '20:00',
    partner_mood_notify: true
  });

  useEffect(() => {
    checkLinkStatus();
    loadMyProfile();
  }, [userId, initialPartnershipId]);

  const loadMyProfile = async () => {
    if (!userId) return;
    const { data } = await supabase.from('users').select('name, avatar_url').eq('id', userId).single();
    if (data) {
      setMyName(data.name || '');
      setMyAvatar(data.avatar_url || '');
    }
  };

  const checkLinkStatus = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: partnership, error: partnershipError } = await supabase
        .from('partnerships')
        .select(`
          *,
          user1:user1_id(name, avatar_url),
          user2:user2_id(name, avatar_url)
        `)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .eq('is_active', true)
        .maybeSingle();

      if (partnership && !partnershipError) {
        setIsLinked(true);
        setPartnershipId(partnership.id);
        setRelationshipDate(partnership.relationship_start_date || '');

        const isUser1 = partnership.user1_id === userId;
        const nickname = isUser1 ? partnership.user2_nickname : partnership.user1_nickname;

        if (nickname) {
          setPartnerName(nickname);
        } else {
          const partner = isUser1 ? partnership.user2 : partnership.user1;
          const pDetails = Array.isArray(partner) ? partner[0] : partner;
          if (pDetails) {
            setPartnerName(pDetails.name || '');
          }
        }
        setShowLinkingSection(false);
      } else if (!initialPartnershipId) {
        const { data: user } = await supabase.from('users').select('linking_code').eq('id', userId).single();
        if (user && user.linking_code) {
          setMyCode(user.linking_code);
          setShowLinkingSection(true);
        }
      }
    } catch (err) {
      console.error('Error checking link status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: userError } = await supabase.from('users').update({
        name: myName,
        avatar_url: myAvatar
      }).eq('id', userId);

      if (userError) throw userError;

      if (partnershipId) {
        const { data: p } = await supabase.from('partnerships').select('user1_id, user2_id').eq('id', partnershipId).single();
        if (p) {
          const isUser1 = p.user1_id === userId;
          const updateData = isUser1 ? { user2_nickname: partnerName } : { user1_nickname: partnerName };
          await supabase.from('partnerships').update(updateData).eq('id', partnershipId);
        }
      }
      setShowEditProfile(false);
    } catch (err: any) {
      setError('فشل تحديث البيانات: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setMyAvatar(publicUrl);
    } catch (err: any) {
      setError('فشل رفع الصورة: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsUploading(false);
    }
  };

  const generateCode = async () => {
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const { error: updateError } = await supabase.from('users').update({ linking_code: code }).eq('id', userId);
      if (!updateError) setMyCode(code);
    } catch (err) { console.error('Error generating code:', err); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerCode || partnerCode.length !== 6 || !relationshipDate) {
      setError('الرجاء تعبئة جميع البيانات');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const { data: partner, error: partnerError } = await supabase.from('users').select('id, name').eq('linking_code', partnerCode).single();
      if (partnerError || !partner) {
        setError('الكود غير صحيح أو انتهت صلاحيته');
        setLoading(false);
        return;
      }
      const { data: newPartnership, error: createError } = await supabase
        .from('partnerships')
        .insert([{ user1_id: userId, user2_id: partner.id, relationship_start_date: relationshipDate, is_active: true, locked_at: new Date().toISOString() }])
        .select().single();

      if (createError) throw createError;
      await supabase.from('users').update({ linking_code: null }).in('id', [userId, partner.id]);
      setIsLinked(true);
      setPartnershipId(newPartnership.id);
      setPartnerName(partner.name);
      setShowLinkingSection(false);
      setLoading(false);
      if (onPartnershipCreated) onPartnershipCreated();
    } catch (err) {
      setError('حدث خطأ أثناء الربط');
      setLoading(false);
    }
  };
  const handleLogout = () => {
    if (onLogout) onLogout();
    else onNavigate('login');
  };

  useEffect(() => {
    if (showNotifications && userId) {
      fetchNotifications();
    }
  }, [showNotifications, userId]);

  const fetchNotifications = async () => {
    const { data } = await supabase.from('notification_settings').select('*').eq('user_id', userId).single();
    if (data) {
      setNotifySettings({
        mood_reminder_enabled: data.mood_reminder_enabled,
        daily_mood_time: data.daily_mood_time,
        partner_mood_notify: data.partner_mood_notify
      });
    }
  };

  const handleSaveNotifications = async () => {
    setLoading(true);
    const { error } = await supabase.from('notification_settings').upsert({
      user_id: userId,
      ...notifySettings,
      updated_at: new Date().toISOString()
    });
    setLoading(false);
    if (!error) setShowNotifications(false);
    else setError('فشل حفظ الإعدادات');
  };

  const handleUpdateDate = async () => {
    if (!partnershipId || !relationshipDate) return;
    setLoading(true);
    const { error } = await supabase.from('partnerships').update({
      relationship_start_date: relationshipDate
    }).eq('id', partnershipId);
    setLoading(false);
    if (!error) setShowCalendar(false);
    else setError('فشل تحديث التاريخ');
  };

  const SettingRow = ({ icon: Icon, title, subtitle, onClick, color = "text-foreground" }: any) => (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full flex items-center justify-between p-6 bg-card rounded-[2rem] shadow-xl shadow-black/[0.01] border border-border/50 group transition-all hover:bg-muted/30"
    >
      <div className="flex items-center gap-5">
        <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center group-hover:bg-card transition-colors shadow-inner">
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
        <div className="text-right">
          <p className="font-black text-base text-foreground mb-0.5">{title}</p>
          <p className="text-[11px] font-bold text-muted-foreground uppercase opacity-60 tracking-tight">{subtitle}</p>
        </div>
      </div>
      <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground/30 group-hover:text-primary transition-colors">
        <ChevronLeft className="w-5 h-5" />
      </div>
    </motion.button>
  );

  return (
    <div className="flex-1 bg-background flex flex-col relative h-screen">
      <header className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-xl z-30 border-b border-border/50">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => onNavigate('home')} className="w-11 h-11 flex items-center justify-center bg-card rounded-2xl shadow-sm border border-border">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </motion.button>
        <div className="text-center">
          <h1 className="text-xl font-black text-foreground">الإعدادات</h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mt-1">تخصيص تجربتك الخاصة</p>
        </div>
        <div className="w-11" />
      </header>

      <div className="flex-1 px-6 py-8 space-y-10 overflow-y-auto pb-32">
        {/* Profile Card */}
        <div className="bg-card rounded-[3.5rem] p-8 shadow-xl shadow-black/[0.02] border border-border/50 flex items-center justify-between relative overflow-hidden group">
          <div className="flex items-center gap-6 relative z-10">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="w-20 h-20 rounded-[2.2rem] bg-muted/30 overflow-hidden border-2 border-primary/10 shadow-inner flex items-center justify-center relative"
            >
              {myAvatar ? <img src={myAvatar} alt="Profile" className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-muted-foreground" />}
              <button onClick={() => setShowEditProfile(true)} className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"><Camera className="w-5 h-5" /></button>
            </motion.div>
            <div className="text-right">
              <p className="text-xl font-black text-foreground mb-0.5">{myName || 'مستخدم جديد'}</p>
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">الملف الشخصي</p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowEditProfile(true)}
            className="w-11 h-11 bg-muted/30 rounded-2xl flex items-center justify-center text-foreground hover:bg-muted/50 transition-colors relative z-10"
          >
            <Plus className="w-5 h-5" />
          </motion.button>
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full translate-x-10 -translate-y-10" />
        </div>

        {/* Linking Status */}
        {!isLinked && !showLinkingSection ? (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-indigo-600 rounded-[3.5rem] p-10 text-white text-center space-y-6 shadow-2xl shadow-indigo-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-4 translate-x-4" />
            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-[2.2rem] flex items-center justify-center mx-auto relative z-10"><LinkIcon className="w-10 h-10 text-white" /></div>
            <div className="space-y-2 relative z-10">
              <h3 className="text-2xl font-black">أكمل الربط</h3>
              <p className="text-xs text-white/70 font-bold leading-relaxed px-4">ابدأ رحلتك مع شريكك وشارك اللحظات الجميلة معاً في مساحة خاصة بكما فقط.</p>
            </div>
            <Button onClick={() => { setShowLinkingSection(true); generateCode(); }} className="w-full h-15 bg-white text-indigo-600 rounded-3xl font-black shadow-xl mt-4 hover:bg-indigo-50 active:scale-95 transition-all text-base relative z-10">ابدأ الربط الآن</Button>
          </motion.div>
        ) : !isLinked && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border/50 rounded-[3.5rem] p-10 space-y-8 shadow-xl shadow-black/[0.02]">
            <div className="space-y-8">
              <div className="text-center space-y-4">
                <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.3em]">مودك الفريد</p>
                <div className="flex items-center gap-4 justify-center">
                  <p className="text-5xl font-black tracking-[0.2em] text-primary">{myCode || '------'}</p>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={handleCopy} className="w-12 h-12 flex items-center justify-center bg-muted/30 rounded-2xl hover:bg-muted/50 transition-colors">
                    {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-muted-foreground" />}
                  </motion.button>
                </div>
              </div>
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50"></div></div>
                <span className="relative z-10 bg-card px-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest mx-auto block w-fit">أو أدخل كود شريكك</span>
              </div>
              <form onSubmit={handleLink} className="space-y-5">
                <div className="space-y-2 text-right">
                  <label className="text-[11px] font-black text-muted-foreground mr-1 uppercase tracking-widest">تاريخ البداية 🥂</label>
                  <input type="date" value={relationshipDate} onChange={(e) => setRelationshipDate(e.target.value)} className="w-full h-15 bg-muted/30 border-none rounded-2xl px-5 font-black text-sm text-foreground outline-none font-sans" dir="ltr" />
                </div>
                <div className="space-y-2 text-right">
                  <label className="text-[11px] font-black text-muted-foreground mr-1 uppercase tracking-widest">كود الشريك</label>
                  <input type="text" placeholder="000000" value={partnerCode} onChange={(e) => setPartnerCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full h-15 bg-muted/30 border-none rounded-2xl px-5 text-center text-3xl font-black tracking-[0.3em] text-foreground outline-none placeholder:opacity-20" maxLength={6} />
                </div>
                {error && <p className="text-[11px] font-black text-rose-500 text-center">{error}</p>}
                <Button type="submit" disabled={loading} className="w-full h-16 bg-primary text-white rounded-3xl font-black shadow-xl shadow-primary/20 text-base mt-4 transition-all active:scale-95">{loading ? 'جاري التحقق...' : 'تأكيد الربط 💍'}</Button>
              </form>
            </div>
          </motion.div>
        )}

        {isLinked && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#0f172a] rounded-[3.5rem] p-10 text-white relative overflow-hidden group shadow-2xl shadow-slate-900/20">
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-primary/20 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-[2s]" />
            <div className="relative z-10 flex items-center justify-between">
              <div className="space-y-1.5 text-right">
                <div className="flex items-center gap-2 justify-end mb-2"><span className="text-[9px] font-black uppercase tracking-[0.3em] text-primary">Connected & Secure</span><div className="w-2 h-2 rounded-full bg-primary animate-pulse" /></div>
                <h3 className="text-2xl font-black">مرتبطان مع {partnerName}</h3>
                <p className="text-xs font-bold text-white/50 leading-relaxed">أنتما الآن في مساحة خاصة ومؤمنة تماماً.</p>
              </div>
              <div className="w-16 h-16 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.2rem] flex items-center justify-center shadow-2xl shrink-0"><Heart className="w-8 h-8 text-primary" fill="currentColor" /></div>
            </div>
          </motion.div>
        )}

        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1 text-right">عام</h4>
          <SettingRow icon={isDarkMode ? Sun : Moon} title={isDarkMode ? "الوضع النهاري" : "الوضع الليلي"} subtitle={isDarkMode ? "العودة للألوان الفاتحة" : "تفعيل المظهر الداكن المريح"} onClick={onToggleDarkMode} />
          <SettingRow icon={Bell} title="الإشعارات" subtitle="تنبيهات سؤال المزاج اليومي" onClick={() => setShowNotifications(true)} />
          <SettingRow icon={Calendar} title="التقويم" subtitle="تعديل تاريخ بداية العلاقة" onClick={() => setShowCalendar(true)} />
        </div>

        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1 text-right">الحساب</h4>
          <SettingRow icon={LogOut} title="تسجيل الخروج" subtitle="الخروج من حسابك الحالي" color="text-rose-500" onClick={() => setShowLogoutConfirm(true)} />
        </div>

        <div className="text-center py-4 space-y-1">
          <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.3em]">أُلْفَة v1.1.0</p>
          <p className="text-[8px] font-bold text-primary/50 uppercase tracking-[0.5em]">Deepmind Lab • Handcrafted</p>
        </div>
      </div>

      <AnimatePresence>
        {showEditProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEditProfile(false)} />
            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }} className="relative bg-card rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl z-10 border border-border/50">
              <h3 className="text-xl font-black text-right mb-6 text-foreground">تعديل الملف الشخصي</h3>
              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div className="flex flex-col items-center gap-4 mb-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-[2rem] bg-muted/30 overflow-hidden border-2 border-primary/20 shadow-inner flex items-center justify-center">
                      {isUploading ? <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" /> : (myAvatar ? <img src={myAvatar} alt="Preview" className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-muted-foreground" />)}
                    </div>
                    <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform active:scale-95">
                      <Camera className="w-5 h-5" />
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isUploading} />
                    </label>
                  </div>
                  <p className="text-[10px] font-black text-muted-foreground">اضغط على أيقونة الكاميرا لرفع صورة</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5 text-right"><label className="text-[10px] font-black text-muted-foreground mr-1">اسمك المستعار</label><input required type="text" value={myName} onChange={e => setMyName(e.target.value)} className="w-full h-14 bg-muted/30 border-none rounded-2xl px-5 font-black text-sm text-foreground outline-none" placeholder="..." /></div>
                  <div className="space-y-1.5 text-right"><label className="text-[10px] font-black text-muted-foreground mr-1">لقب شريكك (كيف تناديه؟)</label><input type="text" value={partnerName} onChange={e => setPartnerName(e.target.value)} className="w-full h-14 bg-muted/30 border-none rounded-2xl px-5 font-black text-sm text-foreground outline-none" placeholder="..." /></div>
                </div>
                {error && <p className="text-rose-500 text-[10px] font-black text-center">{error}</p>}
                <div className="flex flex-col gap-2 pt-2">
                  <Button type="submit" disabled={loading} className="w-full h-14 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20">{loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}</Button>
                  <button type="button" onClick={() => setShowEditProfile(false)} className="h-12 text-sm font-black text-muted-foreground">إلغاء</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showNotifications && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNotifications(false)} />
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="relative bg-card rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl z-10 border border-border/50">
              <div className="relative z-10 space-y-6">
                <div className="text-center space-y-1">
                  <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm"><Bell className="w-7 h-7" /></div>
                  <h3 className="text-xl font-black text-foreground">الإشعارات</h3>
                  <p className="text-[11px] font-bold text-muted-foreground">تحكم في تنبيهات التطبيق</p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border/50">
                    <input type="checkbox" checked={notifySettings.mood_reminder_enabled} onChange={e => setNotifySettings({ ...notifySettings, mood_reminder_enabled: e.target.checked })} className="w-5 h-5 accent-primary rounded-md" />
                    <div className="text-right"><p className="font-black text-sm text-foreground">تذكير المزاج اليومي</p></div>
                  </div>
                  {notifySettings.mood_reminder_enabled && (
                    <div className="space-y-2 text-right">
                      <label className="text-[10px] font-black text-muted-foreground mr-1">وقت التنبيه</label>
                      <input type="time" value={notifySettings.daily_mood_time} onChange={e => setNotifySettings({ ...notifySettings, daily_mood_time: e.target.value })} className="w-full h-12 bg-muted/50 border-none rounded-xl px-4 font-black text-sm text-center text-foreground outline-none font-sans" />
                    </div>
                  )}
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border/50">
                    <input type="checkbox" checked={notifySettings.partner_mood_notify} onChange={e => setNotifySettings({ ...notifySettings, partner_mood_notify: e.target.checked })} className="w-5 h-5 accent-primary rounded-md" />
                    <div className="text-right"><p className="font-black text-sm text-foreground">تنبيه عند تحديث شريكك</p></div>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button onClick={handleSaveNotifications} className="flex-1 h-12 bg-primary text-white rounded-xl font-black shadow-lg shadow-primary/20">{loading ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</Button>
                  <Button variant="outline" onClick={() => setShowNotifications(false)} className="flex-1 h-12 rounded-xl font-bold text-sm">إغلاق</Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showCalendar && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCalendar(false)} />
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="relative bg-card rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl z-10 border border-border/50">
              <div className="text-center space-y-1 mb-6">
                <div className="w-14 h-14 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm"><Calendar className="w-7 h-7" /></div>
                <h3 className="text-xl font-black text-foreground">تاريخ بدايتنا</h3>
                <p className="text-[11px] font-bold text-muted-foreground">متى بدأت قصتكم الجميلة؟</p>
              </div>
              <div className="space-y-6">
                <div className="space-y-2 text-right">
                  <label className="text-[10px] font-black text-muted-foreground mr-1 uppercase tracking-widest">تاريخ البداية 🥂</label>
                  <input type="date" value={relationshipDate} onChange={(e) => setRelationshipDate(e.target.value)} className="w-full h-14 bg-muted/30 border-none rounded-2xl px-5 font-black text-sm text-foreground outline-none text-center font-sans" dir="ltr" />
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleUpdateDate} className="flex-1 h-12 bg-primary text-white rounded-xl font-black shadow-lg shadow-primary/20">{loading ? 'تحديث...' : 'تحديث التاريخ'}</Button>
                  <Button variant="outline" onClick={() => setShowCalendar(false)} className="flex-1 h-12 rounded-xl font-bold text-sm">إلغاء</Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="relative bg-card rounded-3xl p-6 max-w-sm w-full shadow-2xl z-10 border border-border/50">
              <div className="w-14 h-14 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4"><LogOut className="w-7 h-7" /></div>
              <h3 className="text-lg font-black text-center mb-1.5 text-foreground">تسجيل الخروج؟</h3>
              <p className="text-center text-muted-foreground text-xs font-black mb-6 px-4">هل أنت متأكد؟ سيتعين عليك تسجيل الدخول مرة أخرى للوصول لذكرياتكما.</p>
              <div className="grid grid-cols-2 gap-2.5">
                <Button variant="outline" className="h-11 rounded-xl font-bold text-sm" onClick={() => setShowLogoutConfirm(false)}>إلغاء</Button>
                <Button className="h-11 bg-rose-500 text-white rounded-xl font-bold text-sm" onClick={handleLogout}>تأكيد</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}