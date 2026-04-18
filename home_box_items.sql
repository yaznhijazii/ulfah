-- Shared home furnishing / shopping checklist (e.g. preparing a home before marriage)
CREATE TABLE IF NOT EXISTS home_box_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    partnership_id UUID REFERENCES partnerships(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    notes TEXT,
    is_purchased BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE home_box_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on home_box_items" ON home_box_items
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Optional: realtime (ignore error if publication already includes the table)
-- ALTER PUBLICATION supabase_realtime ADD TABLE home_box_items;
