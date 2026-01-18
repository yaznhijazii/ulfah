-- Create a bucket for user avatars
-- إنشاء حاوية لصور المستخدمين
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Set up storage policies
-- إعداد سياسات الوصول للحاوية
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

CREATE POLICY "Allow all operations for anon/auth"
ON storage.objects FOR ALL
TO anon, authenticated
USING ( bucket_id = 'avatars' )
WITH CHECK ( bucket_id = 'avatars' );

-- Enable all operations for users table
-- تمكين كافة العمليات على جدول المستخدمين
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on users" ON public.users
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
