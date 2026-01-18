-- Create a bucket for memory images
-- إنشاء حاوية لصور الذكريات
insert into storage.buckets (id, name, public)
values ('memories', 'memories', true)
on conflict (id) do nothing;

-- Set up storage policies for memories
-- إعداد سياسات الوصول لحاوية الذكريات
CREATE POLICY "Public Access Memories"
ON storage.objects FOR SELECT
USING ( bucket_id = 'memories' );

CREATE POLICY "Allow all operations for memories anon/auth"
ON storage.objects FOR ALL
TO anon, authenticated
USING ( bucket_id = 'memories' )
WITH CHECK ( bucket_id = 'memories' );
