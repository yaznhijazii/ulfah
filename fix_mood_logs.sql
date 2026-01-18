-- إصلاح جدول المشاعر (mood_logs) ليقبل الحفظ والتعديل

-- 1. التأكد من وجود الجدول مع الأعمدة الصحيحة
CREATE TABLE IF NOT EXISTS mood_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    mood_date DATE DEFAULT CURRENT_DATE NOT NULL,
    mood TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. "مهم جداً": إضافة قيد فريد (Unique Constraint)
-- هذا ما يسمح بعملية (Upsert) - أي التحديث إذا كان موجوداً، أو الإنشاء إذا لم يكن
ALTER TABLE mood_logs DROP CONSTRAINT IF EXISTS mood_logs_user_date_key;
ALTER TABLE mood_logs ADD CONSTRAINT mood_logs_user_date_key UNIQUE (user_id, mood_date);

-- 3. تفعيل الحماية (RLS)
ALTER TABLE mood_logs ENABLE ROW LEVEL SECURITY;

-- 4. تنظيف الصلاحيات القديمة
DROP POLICY IF EXISTS "Users can view their own mood logs" ON mood_logs;
DROP POLICY IF EXISTS "Users can insert their own mood logs" ON mood_logs;
DROP POLICY IF EXISTS "Users can update their own mood logs" ON mood_logs;
DROP POLICY IF EXISTS "Users can manage their own mood logs" ON mood_logs;

-- 5. إضافة صلاحية شاملة للمستخدم لإدارة مشاعره
CREATE POLICY "Users can manage their own mood logs"
ON mood_logs
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. السماح للشريك برؤية مشاعر شريكه (اختياري، لكن مفيد يظهر في الرئيسية)
CREATE POLICY "Partners can view partner mood logs"
ON mood_logs
FOR SELECT
USING (
    auth.uid() IN (
        SELECT user1_id FROM partnerships WHERE user2_id = user_id
        UNION
        SELECT user2_id FROM partnerships WHERE user1_id = user_id
    )
);
