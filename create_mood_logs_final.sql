-- إنشاء جدول المشاعر (mood_logs) من الصفر
CREATE TABLE IF NOT EXISTS mood_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    mood_date DATE DEFAULT CURRENT_DATE NOT NULL,
    mood TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- قيد لمنع تكرار التسجيل في نفس اليوم لنفس المستخدم
    UNIQUE(user_id, mood_date)
);

-- تفعيل الحماية
ALTER TABLE mood_logs ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول (Policies)

-- السماح للمستخدم بإدارة مشاعره (إضافة، تعديل، عرض، حذف)
DROP POLICY IF EXISTS "Users can manage their own mood logs" ON mood_logs;
CREATE POLICY "Users can manage their own mood logs"
ON mood_logs
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- السماح للشريك برؤية مشاعر شريكه
DROP POLICY IF EXISTS "Partners can view partner mood logs" ON mood_logs;
CREATE POLICY "Partners can view partner mood logs"
ON mood_logs
FOR SELECT
USING (
    auth.uid() IN (
        SELECT user1_id FROM partnerships WHERE user2_id = user_id AND status = 'active'
        UNION
        SELECT user2_id FROM partnerships WHERE user1_id = user_id AND status = 'active'
    )
);

-- منح الصلاحيات
GRANT ALL ON mood_logs TO authenticated;
