import { ArrowLeft, Lock, Bell, Calendar, Gamepad2, Link as LinkIcon, Copy, Check, LogOut, ChevronLeft, ShieldCheck, Mail, Heart, Plus, User, Upload, Camera, Moon, Sun, Sparkles, Settings as SettingsIcon, Shield, CreditCard, HelpCircle, Palette, UserCircle2, ExternalLink, Zap } from 'lucide-react';
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
  const [partnerAvatar, setPartnerAvatar] = useState('');
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
        const partner = isUser1 ? partnership.user2 : partnership.user1;
        const pDetails = Array.isArray(partner) ? partner[0] : partner;

        if (nickname) {
          setPartnerName(nickname);
        } else if (pDetails) {
          setPartnerName(pDetails.name || '');
        }

        if (pDetails) {
          setPartnerAvatar(pDetails.avatar_url || '');
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

  const SettingRow = ({ icon: Icon, title, subtitle, onClick, badge, destructive }: any) => (
    <motion.button
      whileHover={{ scale: 1.01, backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full flex items-center justify-between p-6 rounded-[2rem] border transition-all duration-300 group ${
        destructive 
          ? 'border-rose-500/20 bg-rose-500/5 text-rose-500' 
          : isDarkMode 
            ? 'border-white/10 bg-white/5 text-white' 
            : 'border-slate-200 bg-white text-slate-900'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-500 group-hover:scale-110 ${
          destructive ? 'bg-rose-500 text-white' : 'bg-primary/10 text-primary'
        }`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            {badge && <span className="px-2 py-0.5 bg-primary/20 text-primary text-[8px] font-black rounded-lg uppercase tracking-wider">{badge}</span>}
            <p className="font-bold text-sm tracking-tight">{title}</p>
          </div>
          <p className={`text-[10px] font-medium leading-tight mt-0.5 ${destructive ? 'text-rose-500/60' : isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
            {subtitle}
          </p>
        </div>
      </div>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
        destructive ? 'bg-rose-500/10 text-rose-500' : isDarkMode ? 'bg-white/5 text-white/20 group-hover:text-primary' : 'bg-slate-100 text-slate-300 group-hover:text-primary'
      }`}>
        <ChevronLeft className="w-4 h-4" />
      </div>
    </motion.button>
  );

  return (
    <div className={`flex-1 flex flex-col relative h-screen overflow-hidden font-outfit transition-colors duration-500 ${isDarkMode ? 'bg-[#050505] text-white' : 'bg-[#f8f9fa] text-slate-900'}`}>
      {/* Premium Background Effects */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className={`absolute top-0 left-0 w-full h-full ${isDarkMode ? 'bg-[radial-gradient(circle_at_50%_-20%,rgba(244,63,94,0.15),transparent_50%)]' : 'bg-[radial-gradient(circle_at_50%_-20%,rgba(244,63,94,0.05),transparent_50%)]'}`} />
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: isDarkMode ? [0.3, 0.5, 0.3] : [0.1, 0.2, 0.1] }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute top-1/4 -left-1/4 w-[60%] h-[60%] bg-primary/10 blur-[120px] rounded-full"
        />
        <motion.div
          animate={{ scale: [1.1, 1, 1.1], opacity: isDarkMode ? [0.2, 0.4, 0.2] : [0.05, 0.1, 0.05] }}
          transition={{ duration: 12, repeat: Infinity }}
          className="absolute bottom-1/4 -right-1/4 w-[50%] h-[50%] bg-amber-500/5 blur-[100px] rounded-full"
        />
        {isDarkMode && <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />}
      </div>

      <header className={`px-8 pt-14 pb-6 flex items-center justify-between sticky top-0 backdrop-blur-3xl z-40 border-b transition-colors duration-500 ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-white/60 border-slate-200'}`}>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onNavigate('home')}
          className={`w-10 h-10 flex items-center justify-center glass rounded-xl border transition-all ${isDarkMode ? 'border-white/10 text-white/50 hover:text-white' : 'border-slate-200 text-slate-400 hover:text-slate-900'}`}
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div className="text-center">
          <div className="flex items-center gap-2 justify-center mb-0.5">
            <SettingsIcon className={`w-3.5 h-3.5 text-primary animate-spin-slow opacity-50`} />
            <h1 className="text-lg font-black tracking-tighter uppercase">إعدادات الألفة</h1>
          </div>
          <p className="text-[7px] font-black text-primary/60 uppercase tracking-[0.4em]">Elite Control Center</p>
        </div>
        <div className="w-10 h-10" />
      </header>

      <div className="flex-1 px-8 py-8 space-y-10 overflow-y-auto pb-40 scrollbar-hide">
        {/* Profile Identity Card */}
        <section className="relative">
          <motion.div
            whileHover={{ y: -5 }}
            className={`relative p-1 rounded-[3rem] shadow-2xl overflow-hidden transition-colors duration-500 ${isDarkMode ? 'bg-gradient-to-br from-white/10 to-transparent' : 'bg-gradient-to-br from-slate-200 to-transparent'}`}
          >
            <div className={`absolute inset-0 backdrop-blur-2xl rounded-[3rem] transition-colors duration-500 ${isDarkMode ? 'bg-black/60' : 'bg-white/80'}`} />
            <div className="relative p-6 flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="relative group">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className={`w-20 h-20 rounded-[2rem] overflow-hidden border shadow-2xl flex items-center justify-center relative transition-colors ${isDarkMode ? 'bg-white/5 border-white/20' : 'bg-slate-50 border-slate-200'}`}
                  >
                    {myAvatar ? (
                      <img src={myAvatar} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <UserCircle2 className={`w-10 h-10 ${isDarkMode ? 'text-white/10' : 'text-slate-200'}`} />
                    )}
                    <button 
                      onClick={() => setShowEditProfile(true)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white/80"
                    >
                      <Camera className="w-5 h-5" />
                    </button>
                  </motion.div>
                  <div className={`absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-4 rounded-full shadow-lg transition-colors ${isDarkMode ? 'border-[#050505]' : 'border-white'}`} />
                </div>
                <div className="text-right">
                  <p className={`text-xl font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{myName || 'ضيف الألفة'}</p>
                  <div className="flex items-center gap-1.5 justify-end mt-1">
                    <span className="text-[8px] font-black text-primary uppercase tracking-widest">Active Member</span>
                    <Zap className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                  </div>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowEditProfile(true)}
                className={`w-12 h-12 border rounded-2xl flex items-center justify-center transition-all duration-300 ${isDarkMode ? 'bg-white/5 border-white/10 text-white/40 hover:text-primary hover:border-primary/40' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-primary hover:border-primary/20'}`}
              >
                <Palette className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.div>
        </section>

        {/* Connection Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 px-4">
            <div className="w-1 h-4 bg-primary rounded-full shadow-[0_0_10px_#f43f5e]" />
            <h4 className={`text-[10px] font-black uppercase tracking-[0.3em] text-right ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>ارتباط الأرواح</h4>
          </div>

          {isLinked ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`relative p-6 rounded-[2.5rem] border overflow-hidden group transition-colors duration-500 ${isDarkMode ? 'bg-primary/5 border-primary/20' : 'bg-primary/[0.03] border-primary/10'}`}
            >
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl border overflow-hidden shadow-xl ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-100'}`}>
                    {partnerAvatar ? (
                      <img src={partnerAvatar} alt="Partner" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/20">
                        <Heart className="w-6 h-6 text-primary fill-primary" />
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>متصل بـ {partnerName}</p>
                    <p className="text-[9px] font-bold text-primary/60 uppercase tracking-widest mt-0.5">Secure Partnership</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-black text-emerald-500 uppercase">Linked</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => { setShowLinkingSection(true); generateCode(); }}
              className="w-full p-6 rounded-[2.5rem] bg-gradient-to-br from-primary to-rose-600 text-white flex flex-col items-center gap-4 shadow-2xl shadow-primary/20 border border-white/10"
            >
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <LinkIcon className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="font-black text-lg">اربط حسابك الآن</p>
                <p className="text-[9px] font-bold opacity-70 uppercase tracking-widest mt-1">ابدأ الرحلة المشتركة</p>
              </div>
            </motion.button>
          )}

          <AnimatePresence>
            {showLinkingSection && !isLinked && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className={`border rounded-[2.5rem] p-8 space-y-8 mt-4 transition-colors ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                  <div className="text-center space-y-4">
                    <p className={`text-[9px] font-black uppercase tracking-[0.4em] ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>رمزك الخاص</p>
                    <div className="flex items-center gap-4 justify-center">
                      <div className={`px-6 py-4 rounded-2xl border transition-colors ${isDarkMode ? 'bg-black/40 border-primary/30' : 'bg-slate-50 border-primary/20'}`}>
                        <p className="text-4xl font-black tracking-[0.2em] text-primary">{myCode || '------'}</p>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={handleCopy}
                        className={`w-12 h-12 flex items-center justify-center rounded-2xl border transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 hover:bg-primary/20' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                      >
                        {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className={`w-5 h-5 ${isDarkMode ? 'text-primary' : 'text-slate-400'}`} />}
                      </motion.button>
                    </div>
                  </div>

                  <div className="relative py-2 flex items-center justify-center">
                    <div className={`w-full h-px ${isDarkMode ? 'bg-white/5' : 'bg-slate-200'}`} />
                    <span className={`absolute px-4 text-[8px] font-black uppercase tracking-[0.5em] transition-colors ${isDarkMode ? 'bg-[#0a0a0a] text-white/20' : 'bg-white text-slate-300'}`}>OR LINK</span>
                  </div>

                  <form onSubmit={handleLink} className="space-y-6">
                    <div className="space-y-3 text-right">
                      <label className={`text-[9px] font-black mr-2 uppercase tracking-[0.3em] ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>تاريخ اللقاء الأول</label>
                      <input type="date" value={relationshipDate} onChange={(e) => setRelationshipDate(e.target.value)} className={`w-full h-14 border rounded-2xl px-6 font-black outline-none focus:border-primary/50 transition-all text-center ${isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                    </div>
                    <div className="space-y-3 text-right">
                      <label className={`text-[9px] font-black mr-2 uppercase tracking-[0.3em] ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>رمز الشريك</label>
                      <input type="text" placeholder="000000" value={partnerCode} onChange={(e) => setPartnerCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className={`w-full h-16 border rounded-2xl px-6 text-center text-3xl font-black tracking-[0.3em] text-primary outline-none focus:border-primary/50 transition-all ${isDarkMode ? 'bg-black/40 border-white/10' : 'bg-slate-50 border-slate-200'}`} maxLength={6} />
                    </div>
                    {error && <p className="text-[10px] font-black text-rose-500 text-center animate-bounce">{error}</p>}
                    <Button type="submit" disabled={loading} className="w-full h-16 bg-primary hover:bg-rose-600 text-white rounded-2xl font-black text-lg transition-all active:scale-95">
                      {loading ? 'جاري التحقق...' : 'تأكيد الارتباط 💍'}
                    </Button>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Settings Group */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 px-4">
            <div className="w-1 h-4 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
            <h4 className={`text-[10px] font-black uppercase tracking-[0.3em] text-right ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>إعدادات المساحة</h4>
          </div>

          <div className="space-y-3">
            <SettingRow 
              icon={isDarkMode ? Sun : Moon} 
              title={isDarkMode ? "الوضع النهاري" : "الوضع الليلي"} 
              subtitle={isDarkMode ? "إضاءة ساطعة" : "أجواء هادئة"} 
              onClick={onToggleDarkMode} 
              badge={isDarkMode ? "Light" : "Dark"} 
              isDarkMode={isDarkMode}
            />
            <SettingRow 
              icon={Bell} 
              title="التنبيهات" 
              subtitle="إدارة إشعارات الحالة" 
              onClick={() => setShowNotifications(true)} 
              isDarkMode={isDarkMode}
            />
            <SettingRow 
              icon={Calendar} 
              title="تاريخ العهد" 
              subtitle="متى بدأت الحكاية؟" 
              onClick={() => setShowCalendar(true)} 
              isDarkMode={isDarkMode}
            />
          </div>
        </section>

        {/* Danger Zone */}
        <section className="pt-6">
          <SettingRow 
            icon={LogOut} 
            title="تسجيل الخروج" 
            subtitle="إنهاء الجلسة الحالية" 
            onClick={() => setShowLogoutConfirm(true)} 
            destructive 
            isDarkMode={isDarkMode}
          />
        </section>

        <div className={`text-center py-10 space-y-2 transition-opacity ${isDarkMode ? 'opacity-20' : 'opacity-40'}`}>
          <p className={`text-[8px] font-black uppercase tracking-[0.5em] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>ULFAH • PREMIUM CORE v2.0</p>
          <div className="flex items-center justify-center gap-2">
            <Shield className="w-2.5 h-2.5 text-primary" />
            <p className={`text-[7px] font-bold uppercase tracking-[0.2em] ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>End-to-End Secure Space</p>
          </div>
        </div>
      </div>

      {/* Popups & Modals */}
      <AnimatePresence>
        {showEditProfile && (
          <Modal title="تعديل الملف الشخصي" onClose={() => setShowEditProfile(false)} isDarkMode={isDarkMode}>
            <form onSubmit={handleUpdateProfile} className="space-y-8">
              <div className="flex flex-col items-center gap-6">
                <div className="relative group">
                  <div className={`w-28 h-28 rounded-[2.5rem] border shadow-2xl flex items-center justify-center relative overflow-hidden transition-colors ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    {isUploading ? (
                      <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                    ) : (
                      myAvatar ? <img src={myAvatar} alt="Preview" className="w-full h-full object-cover" /> : <UserCircle2 className={`w-12 h-12 ${isDarkMode ? 'text-white/10' : 'text-slate-200'}`} />
                    )}
                  </div>
                  <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-2xl cursor-pointer hover:scale-110 active:scale-95 transition-all">
                    <Camera className="w-5 h-5" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isUploading} />
                  </label>
                </div>
                <p className="text-[9px] font-black text-primary/60 uppercase tracking-widest">اضغط لتغيير الصورة</p>
              </div>

              <div className="space-y-5">
                <Field label="اسمك في المساحة" value={myName} onChange={setMyName} placeholder="..." isDarkMode={isDarkMode} />
                <Field label="لقب الشريك المفضل" value={partnerName} onChange={setPartnerName} placeholder="..." isDarkMode={isDarkMode} />
              </div>

              {error && <p className="text-rose-500 text-[10px] font-black text-center">{error}</p>}
              <div className="flex flex-col gap-3">
                <Button type="submit" disabled={loading} className="w-full h-16 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20">
                  {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </Button>
                <button type="button" onClick={() => setShowEditProfile(false)} className={`text-[10px] font-black uppercase tracking-widest hover:text-primary transition-colors py-2 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>إلغاء</button>
              </div>
            </form>
          </Modal>
        )}

        {showNotifications && (
          <Modal title="إعدادات التنبيهات" onClose={() => setShowNotifications(false)} isDarkMode={isDarkMode}>
            <div className="space-y-8">
              <Toggle 
                label="تذكير المزاج اليومي" 
                checked={notifySettings.mood_reminder_enabled} 
                onChange={val => setNotifySettings({...notifySettings, mood_reminder_enabled: val})} 
                isDarkMode={isDarkMode}
              />
              {notifySettings.mood_reminder_enabled && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <label className={`text-[9px] font-black mr-2 uppercase tracking-widest ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>وقت التنبيه</label>
                  <input type="time" value={notifySettings.daily_mood_time} onChange={e => setNotifySettings({ ...notifySettings, daily_mood_time: e.target.value })} className={`w-full h-14 border rounded-2xl px-4 font-black text-2xl text-center text-primary outline-none focus:border-primary/40 transition-all ${isDarkMode ? 'bg-black/40 border-primary/20' : 'bg-slate-50 border-slate-200'}`} />
                </motion.div>
              )}
              <Toggle 
                label="تحديثات الشريك" 
                checked={notifySettings.partner_mood_notify} 
                onChange={val => setNotifySettings({...notifySettings, partner_mood_notify: val})} 
                activeColor="bg-emerald-500"
                isDarkMode={isDarkMode}
              />
              <div className="flex flex-col gap-3 pt-4">
                <Button onClick={handleSaveNotifications} className="w-full h-16 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20">
                  {loading ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                </Button>
                <button onClick={() => setShowNotifications(false)} className={`text-[10px] font-black uppercase tracking-widest hover:text-primary transition-colors py-2 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>إغلاق</button>
              </div>
            </div>
          </Modal>
        )}

        {showCalendar && (
          <Modal title="تعديل تاريخ العهد" onClose={() => setShowCalendar(false)} isDarkMode={isDarkMode}>
            <div className="space-y-8">
              <div className="space-y-3 text-right">
                <label className={`text-[10px] font-black mr-2 uppercase tracking-widest ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>بداية الحكاية</label>
                <input type="date" value={relationshipDate} onChange={(e) => setRelationshipDate(e.target.value)} className={`w-full h-16 border rounded-2xl px-6 font-black text-xl text-primary outline-none text-center focus:border-primary/40 transition-all ${isDarkMode ? 'bg-black/40 border-white/10' : 'bg-slate-50 border-slate-200'}`} />
              </div>
              <div className="flex flex-col gap-3">
                <Button onClick={handleUpdateDate} className="w-full h-16 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20">
                  {loading ? 'جاري التحديث...' : 'تثبيت التاريخ 🥂'}
                </Button>
                <button onClick={() => setShowCalendar(false)} className={`text-[10px] font-black uppercase tracking-widest hover:text-primary transition-colors py-2 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>رجوع</button>
              </div>
            </div>
          </Modal>
        )}

        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowLogoutConfirm(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className={`relative border rounded-[3rem] p-10 max-w-xs w-full shadow-4xl z-10 text-center transition-colors duration-500 ${isDarkMode ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-slate-200'}`}>
              <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-rose-500/20">
                <LogOut className="w-8 h-8" />
              </div>
              <h3 className={`text-xl font-black mb-3 tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>تسجيل الخروج؟</h3>
              <p className={`text-[10px] font-bold leading-relaxed mb-10 px-4 uppercase tracking-wider ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>هل أنت متأكد من إنهاء جلستك الحالية؟</p>
              <div className="space-y-3">
                <Button className="w-full h-16 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-base shadow-xl shadow-rose-500/20" onClick={handleLogout}>تأكيد الخروج</Button>
                <button className={`w-full py-4 text-[10px] font-black uppercase tracking-widest hover:text-slate-900 transition-all ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`} onClick={() => setShowLogoutConfirm(false)}>إلغاء الأمر</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Internal Helper Components
const Modal = ({ title, children, onClose, isDarkMode }: any) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose} />
    <motion.div initial={{ scale: 0.9, y: 50, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 50, opacity: 0 }} className={`relative border rounded-[3.5rem] p-10 max-w-sm w-full shadow-4xl z-10 overflow-hidden transition-colors duration-500 ${isDarkMode ? 'bg-[#080808] border-white/10' : 'bg-white border-slate-200'}`}>
      <div className={`absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none transition-opacity ${isDarkMode ? 'opacity-100' : 'opacity-30'}`} />
      <div className="relative z-10">
        <div className="text-center mb-10">
          <h3 className={`text-xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
        </div>
        {children}
      </div>
    </motion.div>
  </div>
);

const Field = ({ label, value, onChange, placeholder, isDarkMode }: any) => (
  <div className="space-y-2 text-right">
    <label className={`text-[9px] font-black mr-2 uppercase tracking-widest ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>{label}</label>
    <input 
      type="text" 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      className={`w-full h-14 border rounded-2xl px-5 font-bold text-sm outline-none focus:border-primary/40 transition-all text-right ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} 
      placeholder={placeholder} 
    />
  </div>
);

const Toggle = ({ label, checked, onChange, activeColor = "bg-primary", isDarkMode }: any) => (
  <div className={`flex items-center justify-between p-6 rounded-[2rem] border group transition-colors duration-500 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
    <motion.div whileTap={{ scale: 0.8 }} className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
      <div className={`w-12 h-7 rounded-full peer peer-focus:outline-none transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all ${isDarkMode ? 'bg-white/10' : 'bg-slate-200'} peer-checked:after:translate-x-full peer-checked:${activeColor} shadow-inner`}></div>
    </motion.div>
    <div className="text-right">
      <p className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{label}</p>
    </div>
  </div>
);