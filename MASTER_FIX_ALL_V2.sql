-- ═══════════════════════════════════════════════════════════════
-- سكريبت شامل لإصلاح كل المشاكل - النسخة المصححة
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 1. تحديث جدول الحوارات (Dialogues)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE dialogues ADD COLUMN IF NOT EXISTS problem TEXT;
ALTER TABLE dialogues ADD COLUMN IF NOT EXISTS my_opinion TEXT;
ALTER TABLE dialogues ADD COLUMN IF NOT EXISTS partner_opinion TEXT;

-- ═══════════════════════════════════════════════════════════════
-- 2. تحديث جدول الاتفاقات (Agreements)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS origin_dialogue_id UUID REFERENCES dialogues(id) ON DELETE CASCADE;
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS breach_count INTEGER DEFAULT 0;
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS last_breach_at TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════════
-- 3. تحديث جدول الالتزامات (Commitments)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS punishment TEXT;
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS current_count INTEGER DEFAULT 0;
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS target_count INTEGER DEFAULT 5;
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS period_type TEXT DEFAULT 'weekly';
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'on-track';

-- ═══════════════════════════════════════════════════════════════
-- 4. إنشاء جدول المشاعر (Mood Logs)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS mood_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    mood_date DATE DEFAULT CURRENT_DATE NOT NULL,
    mood TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, mood_date)
);

ALTER TABLE mood_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own mood logs" ON mood_logs;
CREATE POLICY "Users can manage their own mood logs"
ON mood_logs FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- 5. إصلاح صلاحيات الحذف والتعديل (RLS Policies)
-- ═══════════════════════════════════════════════════════════════

-- Dialogues - السماح بالحذف لأي شخص في الشراكة
DROP POLICY IF EXISTS "Users can delete dialogues" ON dialogues;
CREATE POLICY "Users can delete dialogues"
ON dialogues FOR DELETE
USING (
    auth.uid() IN (
        SELECT user1_id FROM partnerships WHERE id = partnership_id
        UNION
        SELECT user2_id FROM partnerships WHERE id = partnership_id
    )
);

-- Agreements - السماح بالتحديث والحذف
DROP POLICY IF EXISTS "Users can update agreements" ON agreements;
CREATE POLICY "Users can update agreements"
ON agreements FOR UPDATE
USING (
    auth.uid() IN (
        SELECT user1_id FROM partnerships WHERE id = partnership_id
        UNION
        SELECT user2_id FROM partnerships WHERE id = partnership_id
    )
);

DROP POLICY IF EXISTS "Users can delete agreements" ON agreements;
CREATE POLICY "Users can delete agreements"
ON agreements FOR DELETE
USING (
    auth.uid() IN (
        SELECT user1_id FROM partnerships WHERE id = partnership_id
        UNION
        SELECT user2_id FROM partnerships WHERE id = partnership_id
    )
);

-- Commitments - السماح بالتحديث والحذف
DROP POLICY IF EXISTS "Users can update commitments" ON commitments;
CREATE POLICY "Users can update commitments"
ON commitments FOR UPDATE
USING (
    auth.uid() IN (
        SELECT user1_id FROM partnerships WHERE id = partnership_id
        UNION
        SELECT user2_id FROM partnerships WHERE id = partnership_id
    )
);

DROP POLICY IF EXISTS "Users can delete commitments" ON commitments;
CREATE POLICY "Users can delete commitments"
ON commitments FOR DELETE
USING (
    auth.uid() IN (
        SELECT user1_id FROM partnerships WHERE id = partnership_id
        UNION
        SELECT user2_id FROM partnerships WHERE id = partnership_id
    )
);

-- ═══════════════════════════════════════════════════════════════
-- 6. منح الصلاحيات النهائية
-- ═══════════════════════════════════════════════════════════════
GRANT ALL ON dialogues TO authenticated;
GRANT ALL ON agreements TO authenticated;
GRANT ALL ON commitments TO authenticated;
GRANT ALL ON mood_logs TO authenticated;
