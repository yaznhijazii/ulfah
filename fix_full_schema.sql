-- 1. تحديث جدول جلسات الحوار (Dialogues)
-- إضافة الأعمدة الجديدة لدعم الويزارد (المشكلة، الرأيين)
ALTER TABLE dialogues ADD COLUMN IF NOT EXISTS problem TEXT;
ALTER TABLE dialogues ADD COLUMN IF NOT EXISTS my_opinion TEXT;
ALTER TABLE dialogues ADD COLUMN IF NOT EXISTS partner_opinion TEXT;

-- 2. تحديث جدول الاتفاقات (Agreements)
-- إضافة أعمدة لتتبع مخالفة الوعد وربطه بالجلسة
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS origin_dialogue_id UUID REFERENCES dialogues(id) ON DELETE SET NULL;
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS breach_count INTEGER DEFAULT 0;
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS last_breach_at TIMESTAMPTZ;

-- 3. تحديث جدول الالتزامات (Commitments)
-- إضافة عمود العقوبة (النهفة)
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS punishment TEXT;
-- التأكد من وجود الأعمدة الأساسية
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS current_count INTEGER DEFAULT 0;
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS target_count INTEGER DEFAULT 5;
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS period_type TEXT DEFAULT 'weekly'; 
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'on-track';

-- 4. إعطاء صلاحيات (احتياطاً)
GRANT ALL ON dialogues TO authenticated;
GRANT ALL ON agreements TO authenticated;
GRANT ALL ON commitments TO authenticated;
