import { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Logo } from './Logo';
import { supabase } from '../../lib/supabase';
import bcrypt from 'bcryptjs';
import { motion } from 'motion/react';
import { Sparkles, User, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';

interface AuthSignupProps {
  onSignup: (userId: string) => void;
  onNavigateToLogin: () => void;
  isDarkMode: boolean;
}

export function AuthSignup({ onSignup, onNavigateToLogin, isDarkMode }: AuthSignupProps) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signup' | 'login'>('signup');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !username || !password || !confirmPassword) {
      setError('الرجاء ملء جميع الحقول');
      return;
    }

    if (password !== confirmPassword) {
      setError('كلمة المرور غير متطابقة');
      return;
    }

    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .single();

      if (existingUser) {
        setError('اسم المستخدم موجود بالفعل');
        setLoading(false);
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{ name: name, username: username, password_hash: hashedPassword }])
        .select()
        .single();

      if (insertError) throw insertError;

      if (newUser && newUser.id) {
        onSignup(newUser.id);
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError('حدث خطأ أثناء إنشاء الحساب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-screen flex flex-col items-center justify-center p-6 relative bg-background">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10 bg-background">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent/20 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-card rounded-[3.5rem] shadow-2xl shadow-black/[0.03] border border-border/50 p-10 relative overflow-hidden"
      >
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-primary/5 rounded-[2.2rem] flex items-center justify-center">
              <Logo size="xl" />
            </div>
          </div>
          <h1 className="text-3xl font-black mb-2 text-foreground tracking-tight">أُلْفَة</h1>
          <p className="text-muted-foreground text-[11px] font-black uppercase tracking-[0.3em]">انضم لعالم المودة</p>
        </div>

        <div className="bg-muted/30 p-1.5 rounded-[2rem] border border-border/20 mb-10 flex relative">
          <motion.div
            className="absolute top-1.5 bottom-1.5 bg-card rounded-[1.8rem] shadow-sm z-0"
            animate={{ x: mode === 'signup' ? '0%' : '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ width: 'calc(50% - 6px)', left: '3px' }}
          />
          <button
            onClick={() => { setMode('signup'); setError(''); }}
            className={`flex-1 py-3 text-xs font-black relative z-10 transition-colors ${mode === 'signup' ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            إنشاء حساب
          </button>
          <button
            onClick={onNavigateToLogin}
            className={`flex-1 py-3 text-xs font-black relative z-10 transition-colors ${mode === 'login' ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            تسجيل الدخول
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2 text-right">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-1">الاسم</label>
            <div className="relative">
              <Input required type="text" placeholder="ياسين" value={name} onChange={e => setName(e.target.value)} className="w-full h-15 rounded-2xl bg-muted/30 border-none text-sm font-bold px-5 text-right transition-all outline-none focus:bg-muted/50" />
              <CheckCircle2 className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
            </div>
          </div>

          <div className="space-y-2 text-right">
            <label className="text-[10px) font-black text-muted-foreground uppercase tracking-widest mr-1">اسم المستخدم</label>
            <div className="relative">
              <Input required type="text" placeholder="username" value={username} onChange={e => setUsername(e.target.value)} className="w-full h-15 rounded-2xl bg-muted/30 border-none text-sm font-bold px-5 pl-12 text-right transition-all outline-none focus:bg-muted/50" dir="ltr" />
              <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
            </div>
          </div>

          <div className="space-y-2 text-right">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-1">كلمة المرور</label>
            <div className="relative">
              <Input required type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full h-15 rounded-2xl bg-muted/30 border-none text-sm font-bold px-5 pl-12 text-right transition-all outline-none focus:bg-muted/50" dir="ltr" />
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
            </div>
          </div>

          <div className="space-y-2 text-right">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-1">تأكيد كلمة المرور</label>
            <Input required type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full h-15 rounded-2xl bg-muted/30 border-none text-sm font-bold px-5 text-right transition-all outline-none focus:bg-muted/50" dir="ltr" />
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-4 rounded-2xl bg-rose-500/10 text-rose-500 text-[10px] font-black text-center">{error}</motion.div>
          )}

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full h-16 bg-foreground text-background rounded-3xl text-sm font-black shadow-2xl shadow-black/10 transition-all disabled:opacity-50 flex items-center justify-center gap-3 overflow-hidden group relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-background/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            {loading ? 'جاري الإنشاء...' : (
              <>
                إنشاء حساب
                <Sparkles className="w-4 h-4 text-primary" />
              </>
            )}
          </motion.button>
        </form>

        <div className="mt-10 text-center">
          <button onClick={onNavigateToLogin} className="inline-flex items-center gap-2 text-[11px] font-black text-muted-foreground uppercase tracking-widest hover:text-primary transition-colors">
            لديك حساب؟ سجل دخولك الآن
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}