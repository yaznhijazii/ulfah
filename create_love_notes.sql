-- Create a table for Love Notes if it doesn't exist
CREATE TABLE IF NOT EXISTS public.love_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partnership_id UUID REFERENCES public.partnerships(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    font_style TEXT DEFAULT 'lateef-regular',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    likes TEXT[] DEFAULT ARRAY[]::TEXT[], -- Array of UUID strings
    is_public BOOLEAN DEFAULT FALSE
);

-- Enable RLS
ALTER TABLE public.love_notes ENABLE ROW LEVEL SECURITY;

-- Create policies (drop explicitly if exists to avoid conflicts, or use CREATE IF NOT EXISTS logic handled manually or by clean slate, here we just create)
DROP POLICY IF EXISTS "Users can view love notes in their partnership" ON public.love_notes;
CREATE POLICY "Users can view love notes in their partnership"
    ON public.love_notes
    FOR SELECT
    USING (
        partnership_id IN (
            SELECT id FROM public.partnerships
            WHERE user1_id = auth.uid() OR user2_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create love notes in their partnership" ON public.love_notes;
CREATE POLICY "Users can create love notes in their partnership"
    ON public.love_notes
    FOR INSERT
    WITH CHECK (
        partnership_id IN (
            SELECT id FROM public.partnerships
            WHERE user1_id = auth.uid() OR user2_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete their own love notes" ON public.love_notes;
CREATE POLICY "Users can delete their own love notes"
    ON public.love_notes
    FOR DELETE
    USING (author_id = auth.uid());

DROP POLICY IF EXISTS "Users can update likes" ON public.love_notes;
CREATE POLICY "Users can update likes"
    ON public.love_notes
    FOR UPDATE
    USING (
        partnership_id IN (
            SELECT id FROM public.partnerships
            WHERE user1_id = auth.uid() OR user2_id = auth.uid()
        )
    )
    WITH CHECK (
        partnership_id IN (
            SELECT id FROM public.partnerships
            WHERE user1_id = auth.uid() OR user2_id = auth.uid()
        )
    );
