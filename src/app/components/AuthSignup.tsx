import { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Logo } from './Logo';
import { supabase } from '../../lib/supabase';
import bcrypt from 'bcryptjs';

interface AuthSignupProps {
  onSignup: (userId: string) => void;
  onNavigateToLogin: () => void;
}

export function AuthSignup({ onSignup, onNavigateToLogin }: AuthSignupProps) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      // التحقق من عدم وجود اسم المستخدم
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

      // تشفير كلمة المرور
      const hashedPassword = await bcrypt.hash(password, 10);

      // إنشاء المستخدم الجديد
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            name: name,
            username: username,
            password_hash: hashedPassword,
          },
        ])
        .select()
        .single();

      if (insertError) {
        console.error('Error creating user:', insertError);
        setError('حدث خطأ أثناء إنشاء الحساب');
        setLoading(false);
        return;
      }

      // تسجيل الدخول تلقائيًا بعد التسجيل
      if (newUser && newUser.id) {
        onSignup(newUser.id);
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-rose-50 p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <h1 className="text-3xl mb-2 text-gray-800">أُلْفَة</h1>
          <p className="text-gray-500">إنشاء حساب جديد</p>
        </div>

        <div className="bg-white rounded-3xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 mb-2 block text-right">
                الاسم
              </label>
              <Input
                type="text"
                placeholder="اسمك الكامل"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                className="rounded-2xl border-gray-200 focus:border-rose-300 focus:ring-rose-200"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-2 block text-right">
                اسم المستخدم
              </label>
              <Input
                type="text"
                placeholder="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                className="rounded-2xl border-gray-200 focus:border-rose-300 focus:ring-rose-200"
                dir="ltr"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-2 block text-right">
                كلمة المرور
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="rounded-2xl border-gray-200 focus:border-rose-300 focus:ring-rose-200"
                dir="ltr"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-2 block text-right">
                تأكيد كلمة المرور
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                className="rounded-2xl border-gray-200 focus:border-rose-300 focus:ring-rose-200"
                dir="ltr"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white rounded-2xl h-12 shadow-md disabled:opacity-50"
            >
              {loading ? 'جاري الإنشاء...' : 'إنشاء حساب'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              لديك حساب؟{' '}
              <button
                onClick={onNavigateToLogin}
                className="text-rose-500 hover:text-rose-600 font-medium"
              >
                تسجيل الدخول
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}