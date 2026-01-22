-- NUCLEAR FIX V11 (إصلاح العلاقات والربط التلقائي)
-- Run this in Supabase SQL Editor

-- 1. إعادة بناء الجدول مع تعريف العلاقات (Foreign Keys)
-- العلاقات ضرورية لكي يفهم Supabase كيفية جلب بيانات المؤلف (الاسم والصورة)
DROP TABLE IF EXISTS public.love_notes CASCADE;

CREATE TABLE public.love_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partnership_id UUID NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    font_style TEXT DEFAULT 'font-normal',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    likes TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_public BOOLEAN DEFAULT FALSE
);

-- 2. تفعيل الأمان (RLS)
ALTER TABLE public.love_notes ENABLE ROW LEVEL SECURITY;

-- 3. سياسة وصول مرنة جداً (V11)
DROP POLICY IF EXISTS "love_notes_public_access" ON public.love_notes;
CREATE POLICY "love_notes_public_access" 
ON public.love_notes 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 4. منح الصلاحيات
GRANT ALL ON public.love_notes TO anon;
GRANT ALL ON public.love_notes TO authenticated;
GRANT ALL ON public.love_notes TO service_role;

-- 5. التأكد من أن جدول المستخدمين يسمح بالقراءة (للربط)
-- بما أن RLS معطل على users، فالقراءة مسموحة، لكن نؤكد الصلاحية
GRANT SELECT ON public.users TO anon;
GRANT SELECT ON public.users TO authenticated;

-- 6. توثيق النسخة
COMMENT ON TABLE public.love_notes IS 'V11 - Fixed relations for nested selects';
