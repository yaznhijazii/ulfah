-- Migration to add "Open When" Vault features to love_notes
-- إضافة أعمدة "خزانة المودة" لجدول الخواطر

ALTER TABLE public.love_notes 
ADD COLUMN IF NOT EXISTS unlock_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS unlock_condition TEXT DEFAULT NULL;

COMMENT ON COLUMN public.love_notes.unlock_at IS 'The date and time when this note becomes visible to the partner.';
COMMENT ON COLUMN public.love_notes.unlock_condition IS 'A specific condition (like mood: "sad") required to unlock the note.';
