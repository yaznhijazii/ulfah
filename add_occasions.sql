CREATE TABLE if not exists occasion_greetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  target_date TIMESTAMPTZ NOT NULL,
  message TEXT NOT NULL,
  is_opened BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: Since the app uses custom authentication without Supabase Auth,
-- we'll allow all operations so the client can query and insert normally.
-- If you want to enable RLS later, you can add custom logic here.

ALTER TABLE occasion_greetings ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (since we don't have Supabase Auth tokens)
CREATE POLICY "Allow all select" ON occasion_greetings FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON occasion_greetings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON occasion_greetings FOR UPDATE USING (true);
CREATE POLICY "Allow all delete" ON occasion_greetings FOR DELETE USING (true);
