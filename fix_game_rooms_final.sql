-- ═══════════════════════════════════════════════════════════════
-- سكريبت إصلاح غرف الألعاب (الشطرنج وبوم بوم)
-- ═══════════════════════════════════════════════════════════════

-- 1. تفعيل خاصية الزمن الحقيقي (Realtime) لجدول غرف الألعاب
-- نتحقق أولاً إذا كان الجدول موجوداً في المنشور، وإذا لم يكن، نضيفه
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'game_rooms'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE game_rooms;
    END IF;
END $$;

-- 2. فتح صلاحيات الوصول (RLS) للجميع (بما أننا لا نستخدم Supabase Auth حالياً)
-- هذا ضروري لأن الحسابات في التطبيق تعتمد على جدول مستخدمين مخصص وليس نظام التعريف الافتراضي لـ Supabase
ALTER TABLE game_rooms DISABLE ROW LEVEL SECURITY;
-- أو بدلاً من التعطيل، يمكن استخدام سياسات تسمح للكل (أكثر أماناً بقليل)
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active rooms" ON game_rooms;
DROP POLICY IF EXISTS "Players can view their room" ON game_rooms;
DROP POLICY IF EXISTS "Players can update their room" ON game_rooms;
DROP POLICY IF EXISTS "Users can create rooms" ON game_rooms;

CREATE POLICY "Game Rooms Permissive Select" ON game_rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Game Rooms Permissive Insert" ON game_rooms FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Game Rooms Permissive Update" ON game_rooms FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Game Rooms Permissive Delete" ON game_rooms FOR DELETE TO anon, authenticated USING (true);

-- 3. التأكد من هيكلة عمود حالة اللعبة
-- نتأكد أن game_state هو من نوع JSONB وله قيمة افتراضية
ALTER TABLE game_rooms ALTER COLUMN game_state SET DEFAULT '{}'::jsonb;

-- 4. منح الصلاحيات
GRANT ALL ON game_rooms TO anon;
GRANT ALL ON game_rooms TO authenticated;
GRANT ALL ON game_rooms TO postgres;
GRANT ALL ON game_rooms TO service_role;
