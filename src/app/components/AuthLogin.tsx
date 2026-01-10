import { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Logo } from './Logo';
import { supabase } from '../../lib/supabase';
import bcrypt from 'bcryptjs';

interface AuthLoginProps {
  onLogin: (userId: string) => void;
  onNavigateToSignup: () => void;
}

export function AuthLogin({ onLogin, onNavigateToSignup }: AuthLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      setError('الرجاء إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // البحث عن المستخدم في قاعدة البيانات
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('id, username, password_hash')
        .eq('username', username)
        .single();

      if (fetchError || !user) {
        setError('اسم المستخدم أو كلمة المرور غير صحيحة');
        setLoading(false);
        return;
      }

      // التحقق من كلمة المرور
      const passwordMatch = await bcrypt.compare(password, user.password_hash);

      if (!passwordMatch) {
        setError('اسم المستخدم أو كلمة المرور غير صحيحة');
        setLoading(false);
        return;
      }

      // تسجيل الدخول بنجاح
      onLogin(user.id);
    } catch (err) {
      console.error('Login error:', err);
      setError('حدث خطأ أثناء تسجيل الدخول');
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
          <p className="text-gray-500">مرحباً بعودتك</p>
        </div>

        <div className="bg-white rounded-3xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 mb-2 block text-right">
                اسم المستخدم
              </label>
              <Input
                type="text"
                placeholder="اسم المستخدم"
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

            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white rounded-2xl h-12 shadow-md disabled:opacity-50"
            >
              {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              ليس لديك حساب؟{' '}
              <button
                onClick={onNavigateToSignup}
                className="text-rose-500 hover:text-rose-600 font-medium"
              >
                إنشاء حساب
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}