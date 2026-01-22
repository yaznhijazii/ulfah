import { ArrowLeft, Lock, Bell, Calendar, Gamepad2, Link as LinkIcon, Copy, Check, LogOut, ChevronLeft, ShieldCheck, Mail, Heart, Plus, User, Upload, Camera, Moon, Sun, Sparkles, Settings as SettingsIcon, Shield, CreditCard, HelpCircle, Palette } from 'lucide-react';
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

  const SettingRow = ({ icon: Icon, title, subtitle, onClick, color = "text-foreground", active = false, badge }: any) => (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full flex items-center justify-between p-7 glass rounded-[2.5rem] shadow-xl border-white/60 dark:border-white/5 transition-all duration-500 overflow-hidden relative group ${active ? 'bg-primary/5 border-primary/20' : 'bg-white/20 dark:bg-[#0a0505]/40'}`}
    >
      <div className="flex items-center gap-5 relative z-10">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg ${active ? 'bg-primary text-white' : 'bg-white/50 dark:bg-white/5 text-foreground group-hover:scale-110'}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2">
            <p className="font-bold text-base text-foreground tracking-tight">{title}</p>
            {badge && <span className="px-2 py-0.5 bg-primary/10 text-primary text-[8px] font-black rounded-lg uppercase tracking-wider">{badge}</span>}
          </div>
          <p className="text-[10px] font-medium text-muted-foreground/60 leading-tight mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="w-10 h-10 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-center text-muted-foreground/20 group-hover:text-primary transition-all duration-500">
        <ChevronLeft className="w-5 h-5" />
      </div>
    </motion.button>
  );

  return (
    <div className="flex-1 bg-background flex flex-col relative h-screen overflow-hidden font-outfit">
      {/* Settings Ambient Glow - Premium Background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <motion.div
          animate={{ scale: [1, 1.2, 1], x: [0, 50, 0], y: [0, 30, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
          className="absolute top-[-10%] left-[-10%] w-[80%] h-[50%] bg-primary/10 blur-[130px] rounded-full"
        />
        <motion.div
          animate={{ scale: [1.2, 1, 1.2], x: [0, -40, 0], y: [0, -50, 0] }}
          transition={{ duration: 18, repeat: Infinity }}
          className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[50%] bg-amber-500/5 blur-[120px] rounded-full"
        />
        <div className="absolute inset-0 bg-white/20 dark:bg-black/40 backdrop-blur-[200px]" />
      </div>

      <header className="px-8 pt-14 pb-4 flex items-center justify-between sticky top-0 bg-background/50 backdrop-blur-3xl z-40 border-b border-white/10">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onNavigate('home')}
          className="w-12 h-12 flex items-center justify-center glass rounded-2xl border-white/60 dark:border-white/10 shadow-lg text-foreground/50 hover:bg-white transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div className="text-center">
          <div className="flex items-center gap-2 justify-center mb-0.5">
            <SettingsIcon className="w-3.5 h-3.5 text-primary opacity-40 animate-spin-slow" />
            <h1 className="text-xl font-black text-foreground tracking-tighter">مركز الألفة</h1>
          </div>
          <p className="text-[8px] font-black text-primary/40 uppercase tracking-[0.6em]">Premium Space Setup</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          className="w-12 h-12 flex items-center justify-center glass rounded-2xl border-white/60 dark:border-white/10 shadow-lg text-foreground/50 hover:bg-white transition-all"
        >
          <Shield className="w-5 h-5" />
        </motion.button>
      </header>

      <div className="flex-1 px-8 py-10 space-y-12 overflow-y-auto pb-40 scrollbar-hide">
        {/* Profile Card Refined */}
        <section className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-amber-500/5 blur-3xl opacity-30 rounded-full" />
          <motion.div
            whileHover={{ y: -5 }}
            className="glass rounded-[3.5rem] p-8 shadow-2xl border-white/80 dark:border-white/5 flex items-center justify-between relative overflow-hidden bg-white/40 dark:bg-[#0a0505]/60 transition-all duration-700"
          >
            <div className="flex items-center gap-6 relative z-10">
              <div className="relative group">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="w-22 h-22 rounded-[2.2rem] bg-secondary dark:bg-white/5 overflow-hidden border-[3px] border-white dark:border-white/10 shadow-2xl flex items-center justify-center relative"
                >
                  {myAvatar ? <img src={myAvatar} alt="Profile" className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-muted-foreground/20" />}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-[2px]">
                    <Camera className="w-6 h-6" />
                  </div>
                </motion.div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 border-[3px] border-white dark:border-[#0a0505] rounded-full shadow-lg" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-foreground tracking-tighter mb-0.5">{myName || 'ضيف الألفة'}</p>
                <div className="flex items-center gap-2 justify-end">
                  <p className="text-[9px] font-black text-primary/40 uppercase tracking-[0.3em]">بصمتك الروحية</p>
                  <Sparkles className="w-3 h-3 text-amber-400" />
                </div>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowEditProfile(true)}
              className="w-14 h-14 bg-white dark:bg-white/5 border border-white dark:border-white/10 rounded-3xl flex items-center justify-center text-primary shadow-xl hover:bg-primary hover:text-white transition-all duration-700 active:bg-rose-600"
            >
              <Palette className="w-6 h-6" />
            </motion.button>
          </motion.div>
        </section>

        {/* Linking Status Section */}
        {!isLinked && !showLinkingSection ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-[#f43f5e] to-rose-600 rounded-[3.5rem] p-9 text-white text-center space-y-7 shadow-3xl shadow-rose-500/30 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] -translate-y-16 translate-x-16" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-[60px] translate-y-16 -translate-x-12" />

            <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-[2.5rem] flex items-center justify-center mx-auto relative z-10 border border-white/30 shadow-2xl">
              <LinkIcon className="w-10 h-10 text-white" />
            </div>

            <div className="space-y-3 relative z-10">
              <h3 className="text-2xl font-black tracking-tight">اكتمال المودة</h3>
              <p className="text-[10px] text-white/70 font-bold leading-relaxed px-6 tracking-wide">الرحلة الأجمل تبدأ بشخصين؛ اربط حسابك الآن لتفتح الروح لمساحتكم المشتركة.</p>
            </div>

            <Button
              onClick={() => { setShowLinkingSection(true); generateCode(); }}
              className="w-full h-16 bg-white text-rose-600 rounded-[2rem] font-black shadow-2xl mt-4 hover:scale-[1.02] active:scale-95 transition-all text-base relative z-10 border-none"
            >
              ابدأ رحلة الربط
            </Button>
          </motion.div>
        ) : !isLinked && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass bg-white/60 dark:bg-black/40 border border-white dark:border-white/5 rounded-[4rem] p-10 space-y-10 shadow-3xl"
          >
            <div className="space-y-10">
              <div className="text-center space-y-5">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.5em] opacity-50">شاركه هذا الرمز</p>
                <div className="flex items-center gap-5 justify-center">
                  <div className="px-8 py-5 bg-white dark:bg-black/20 rounded-[2rem] border-2 border-primary/20 shadow-inner">
                    <p className="text-5xl font-black tracking-[0.15em] text-primary drop-shadow-[0_0_15px_rgba(244,63,94,0.3)]">{myCode || '------'}</p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleCopy}
                    className="w-15 h-15 flex items-center justify-center bg-white dark:bg-white/5 rounded-3xl border border-white dark:border-white/10 shadow-xl hover:bg-rose-50 transition-all"
                  >
                    {copied ? <Check className="w-6 h-6 text-emerald-500" /> : <Copy className="w-6 h-6 text-primary" />}
                  </motion.button>
                </div>
              </div>

              <div className="relative py-2 flex items-center justify-center">
                <div className="w-full h-[0.5px] bg-gradient-to-r from-transparent via-border to-transparent" />
                <span className="absolute bg-background/80 dark:bg-[#0a0505] px-6 text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.5em] backdrop-blur-3xl">أو</span>
              </div>

              <form onSubmit={handleLink} className="space-y-8">
                <div className="space-y-3 text-right">
                  <label className="text-[10px] font-black text-muted-foreground/60 mr-2 uppercase tracking-[0.4em]">تاريخ اللقاء الأول 🥂</label>
                  <input type="date" value={relationshipDate} onChange={(e) => setRelationshipDate(e.target.value)} className="w-full h-16 bg-white dark:bg-black/20 border-white/50 dark:border-white/5 rounded-3xl px-6 font-black text-lg text-foreground outline-none shadow-xl focus:border-primary/40 transition-all" dir="ltr" />
                </div>
                <div className="space-y-3 text-right">
                  <label className="text-[10px] font-black text-muted-foreground/60 mr-2 uppercase tracking-[0.4em]">رمز الشريك</label>
                  <input type="text" placeholder="000000" value={partnerCode} onChange={(e) => setPartnerCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full h-18 bg-white dark:bg-black/20 border-white/50 dark:border-white/5 rounded-3xl px-6 text-center text-4xl font-black tracking-[0.3em] text-primary outline-none shadow-xl placeholder:opacity-10 focus:border-primary/40 transition-all" maxLength={6} />
                </div>
                {error && <p className="text-[10px] font-black text-rose-500 text-center animate-bounce">{error}</p>}
                <Button type="submit" disabled={loading} className="w-full h-18 bg-primary hover:bg-rose-600 text-white rounded-[2.2rem] font-black shadow-2xl shadow-rose-500/20 text-lg mt-4 transition-all active:scale-95">{loading ? 'جاري التحقق...' : 'تأكيد الربط المقدس 💍'}</Button>
              </form>
            </div>
          </motion.div>
        )}

        {isLinked && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0a0505] dark:bg-black border border-white/5 rounded-[4rem] p-10 text-white relative overflow-hidden group shadow-3xl"
          >
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-primary/20 rounded-full blur-[100px] group-hover:scale-150 transition-transform duration-[3s]" />
            <div className="absolute top-[-20%] left-[-20%] w-48 h-48 bg-amber-500/10 rounded-full blur-[80px]" />

            <div className="relative z-10 flex items-center justify-between">
              <div className="space-y-2 text-right">
                <div className="flex items-center gap-2 justify-end mb-3">
                  <div className="px-2.5 py-1 bg-primary/20 backdrop-blur-md rounded-lg border border-primary/20">
                    <span className="text-[8px] font-black uppercase tracking-[0.3em] text-primary">Sacred Connection</span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_#f43f5e]" />
                </div>
                <h3 className="text-3xl font-black tracking-tight leading-none">أنت مع {partnerName}</h3>
                <p className="text-[10px] font-bold text-white/30 leading-relaxed uppercase tracking-widest mt-2 px-1">عالمكم الخاص تحت الحماية القصوى</p>
              </div>
              <div className="w-20 h-20 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] flex items-center justify-center shadow-3xl group-hover:rotate-12 transition-transform duration-700 shrink-0">
                <Heart className="w-10 h-10 text-primary drop-shadow-[0_0_15px_rgba(244,63,94,0.6)]" fill="currentColor" />
              </div>
            </div>
          </motion.div>
        )}

        {/* Setting Groups */}
        <div className="space-y-12">
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-4 mb-3">
              <div className="w-1.5 h-6 bg-primary rounded-full" />
              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.5em] text-right">التجربة الشخصية</h4>
            </div>
            <SettingRow icon={isDarkMode ? Sun : Moon} title={isDarkMode ? "المظهر النهاري" : "المظهر الليلي"} subtitle={isDarkMode ? "إضاءة ساطعة ومنعشة" : "المظهر الداكن المريح"} onClick={onToggleDarkMode} badge={isDarkMode ? "DAY" : "OBSIDIAN"} />
            <SettingRow icon={Bell} title="نظام التنبيهات" subtitle="إدارة إشعارات سؤال المزاج" onClick={() => setShowNotifications(true)} />
            <SettingRow icon={Calendar} title="تاريخ العهد" subtitle="تعديل تاريخ رحلتكما" onClick={() => setShowCalendar(true)} />
            <SettingRow icon={Palette} title="تنسيق الواجهة" subtitle="تخصيص الألوان والمظهر" onClick={() => { }} badge="Soon" />
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 px-4 mb-3">
              <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.5em] text-right">الحماية والمساعدة</h4>
            </div>
            <SettingRow icon={ShieldCheck} title="مركز الأمن" subtitle="إدارة كلمات المرور والقفل" onClick={() => { }} />
            <SettingRow icon={CreditCard} title="الاشتراك والميزات" subtitle="التحكم في باقة المارشميلو" onClick={() => { }} badge="PRO" />
            <SettingRow icon={HelpCircle} title="الدعم التقني" subtitle="تواصل مع فريق أُلْفَة" onClick={() => { }} />
          </div>

          <div className="space-y-4 pt-4">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full p-8 rounded-[2.5rem] border border-rose-500/20 bg-rose-500/5 text-rose-500 flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all duration-500 group shadow-xl shadow-rose-500/5"
            >
              <LogOut className="w-5 h-5 transition-transform group-hover:translate-x-[-10px]" />
              <span>تسجيل الخروج من الحساب</span>
            </motion.button>
          </div>
        </div>

        <div className="text-center py-10 space-y-2 opacity-30 group">
          <p className="text-[10px] font-black uppercase text-foreground tracking-[0.6em] group-hover:tracking-[0.8em] transition-all">أُلْفَة • LUXURY APP v1.5</p>
          <div className="flex items-center justify-center gap-2">
            <Shield className="w-3 h-3 text-emerald-500" />
            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-[0.3em]">End-to-End Encrypted Space</p>
          </div>
        </div>
      </div>

      {/* Popups & Modals Redesigned */}
      <AnimatePresence>
        {showEditProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowEditProfile(false)} />
            <motion.div initial={{ scale: 0.9, y: 50, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 50, opacity: 0 }} className="relative bg-white dark:bg-[#0a0505] rounded-[3.5rem] p-10 max-w-sm w-full shadow-4xl z-10 border border-white/20">
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20"><Palette className="w-8 h-8 text-primary" /></div>
                <h3 className="text-2xl font-black text-foreground tracking-tight">تعديل الملف</h3>
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-1">تحديث هويتك البصرية</p>
              </div>
              <form onSubmit={handleUpdateProfile} className="space-y-8">
                <div className="flex flex-col items-center gap-6 mb-8">
                  <div className="relative group">
                    <div className="w-28 h-28 rounded-[2.5rem] bg-muted/20 dark:bg-white/5 overflow-hidden border-[3px] border-primary/20 shadow-inner flex items-center justify-center relative">
                      {isUploading ? <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" /> : (myAvatar ? <img src={myAvatar} alt="Preview" className="w-full h-full object-cover" /> : <User className="w-12 h-12 text-muted-foreground/20" />)}
                    </div>
                    <label className="absolute -bottom-2 -right-2 w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-2xl cursor-pointer hover:scale-110 active:scale-95 transition-all border-4 border-white dark:border-[#0a0505]">
                      <Camera className="w-6 h-6" />
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isUploading} />
                    </label>
                  </div>
                  <p className="text-[9px] font-black text-primary/40 uppercase tracking-[0.3em]">انقر لتحديث الصورة</p>
                </div>
                <div className="space-y-5">
                  <div className="space-y-2 text-right">
                    <label className="text-[9px] font-black text-muted-foreground/60 mr-2 uppercase tracking-widest leading-none">اسمك في المساحة</label>
                    <input required type="text" value={myName} onChange={e => setMyName(e.target.value)} className="w-full h-15 bg-muted/20 dark:bg-white/5 border-none rounded-2xl px-5 font-black text-sm text-foreground outline-none shadow-inner focus:bg-white dark:focus:bg-white/10 transition-all text-right" placeholder="..." />
                  </div>
                  <div className="space-y-2 text-right">
                    <label className="text-[9px] font-black text-muted-foreground/60 mr-2 uppercase tracking-widest leading-none">لقب شريكك المفضل</label>
                    <input type="text" value={partnerName} onChange={e => setPartnerName(e.target.value)} className="w-full h-15 bg-muted/20 dark:bg-white/5 border-none rounded-2xl px-5 font-black text-sm text-foreground outline-none shadow-inner focus:bg-white dark:focus:bg-white/10 transition-all text-right" placeholder="..." />
                  </div>
                </div>
                {error && <p className="text-rose-500 text-[10px] font-black text-center animate-pulse">{error}</p>}
                <div className="flex flex-col gap-3 pt-4">
                  <Button type="submit" disabled={loading} className="w-full h-16 bg-primary text-white rounded-2xl font-black shadow-3xl shadow-primary/20 text-base">{loading ? 'جاري الحفظ...' : 'حفظ التحديثات'}</Button>
                  <button type="button" onClick={() => setShowEditProfile(false)} className="h-10 text-[11px] font-black text-muted-foreground uppercase tracking-widest hover:text-primary transition-all">إلغاء الأمر</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showNotifications && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowNotifications(false)} />
            <motion.div initial={{ scale: 0.95, y: 30, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 30, opacity: 0 }} className="relative bg-white dark:bg-[#0a0505] rounded-[3.5rem] p-10 max-w-sm w-full shadow-4xl z-10 border border-white/20">
              <div className="relative z-10 space-y-10">
                <div className="text-center">
                  <div className="w-18 h-18 bg-primary/10 text-primary rounded-[1.8rem] flex items-center justify-center mx-auto mb-5 border border-primary/20"><Bell className="w-9 h-9" /></div>
                  <h3 className="text-2xl font-black text-foreground tracking-tight">إشعارات المودة</h3>
                  <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-1">نسق تنبيهات سؤال المزاج</p>
                </div>
                <div className="space-y-5">
                  <div className="flex items-center justify-between p-6 bg-muted/20 dark:bg-white/5 rounded-3xl border border-border/50 shadow-inner group transition-all hover:bg-white dark:hover:bg-white/10">
                    <motion.div whileTap={{ scale: 0.8 }} className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={notifySettings.mood_reminder_enabled} onChange={e => setNotifySettings({ ...notifySettings, mood_reminder_enabled: e.target.checked })} className="sr-only peer" />
                      <div className="w-12 h-7 bg-muted-foreground/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                    </motion.div>
                    <div className="text-right"><p className="font-black text-sm text-foreground">تذكير المزاج اليومي</p></div>
                  </div>

                  <AnimatePresence>
                    {notifySettings.mood_reminder_enabled && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-2 text-right px-2">
                        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mr-1">وقت التنبيه اليومي</label>
                        <input type="time" value={notifySettings.daily_mood_time} onChange={e => setNotifySettings({ ...notifySettings, daily_mood_time: e.target.value })} className="w-full h-15 bg-primary/5 dark:bg-primary/10 border-2 border-primary/20 rounded-2xl px-4 font-black text-2xl text-center text-primary outline-none shadow-xl" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center justify-between p-6 bg-muted/20 dark:bg-white/5 rounded-3xl border border-border/50 shadow-inner group transition-all hover:bg-white dark:hover:bg-white/10">
                    <motion.div whileTap={{ scale: 0.8 }} className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={notifySettings.partner_mood_notify} onChange={e => setNotifySettings({ ...notifySettings, partner_mood_notify: e.target.checked })} className="sr-only peer" />
                      <div className="w-12 h-7 bg-muted-foreground/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                    </motion.div>
                    <div className="text-right"><p className="font-black text-sm text-foreground">تحديثات الشريك</p></div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 pt-2">
                  <Button onClick={handleSaveNotifications} className="w-full h-16 bg-primary text-white rounded-[2rem] font-black shadow-3xl shadow-primary/20 text-lg">{loading ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</Button>
                  <Button variant="ghost" onClick={() => setShowNotifications(false)} className="h-10 text-[11px] font-black text-muted-foreground uppercase tracking-widest">إغلاق</Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showCalendar && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowCalendar(false)} />
            <motion.div initial={{ scale: 0.95, y: 30, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 30, opacity: 0 }} className="relative bg-white dark:bg-[#0a0505] rounded-[3.5rem] p-10 max-w-sm w-full shadow-4xl z-10 border border-white/20">
              <div className="text-center mb-10">
                <div className="w-18 h-18 bg-rose-500/10 text-rose-500 rounded-[1.8rem] flex items-center justify-center mx-auto mb-5 border border-rose-500/20 shadow-lg"><Calendar className="w-9 h-9" /></div>
                <h3 className="text-2xl font-black text-foreground tracking-tight">تاريخ العهد</h3>
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-1">بداية الحكاية الجميلة</p>
              </div>
              <div className="space-y-10">
                <div className="space-y-3 text-right">
                  <label className="text-[10px] font-black text-muted-foreground mr-2 uppercase tracking-[0.4em]">تاريخ البداية 🥂</label>
                  <input type="date" value={relationshipDate} onChange={(e) => setRelationshipDate(e.target.value)} className="w-full h-18 bg-muted/20 dark:bg-white/5 border-none rounded-3xl px-6 font-black text-2xl text-primary outline-none text-center shadow-inner font-sans" dir="ltr" />
                </div>
                <div className="flex flex-col gap-3 pt-2">
                  <Button onClick={handleUpdateDate} className="w-full h-16 bg-primary text-white rounded-[2rem] font-black shadow-3xl shadow-primary/20 text-lg">{loading ? 'تحديث...' : 'تثبيت التاريخ'}</Button>
                  <Button variant="ghost" onClick={() => setShowCalendar(false)} className="h-10 text-[11px] font-black text-muted-foreground uppercase tracking-widest">رجوع</Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowLogoutConfirm(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white dark:bg-[#0a0505] rounded-[3rem] p-10 max-w-xs w-full shadow-4xl z-10 border border-white/20 text-center">
              <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl"><LogOut className="w-9 h-9" /></div>
              <h3 className="text-2xl font-black mb-3 text-foreground tracking-tight">تسجيل الخروج؟</h3>
              <p className="text-muted-foreground/60 text-[11px] font-bold leading-relaxed mb-10 px-4 uppercase tracking-wider">هل أنت متأكد؟ سيتعين عليك تأكيد هويتك مرة أخرى لاحقاً.</p>
              <div className="grid grid-cols-1 gap-4">
                <Button className="h-16 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-base shadow-2xl shadow-rose-500/20" onClick={handleLogout}>تأكيد الخروج</Button>
                <button className="h-12 text-[11px] font-black text-muted-foreground uppercase tracking-widest hover:text-foreground transition-all" onClick={() => setShowLogoutConfirm(false)}>إلغاء</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}