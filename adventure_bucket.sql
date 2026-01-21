-- Adventure Bucket Schema
-- جدول الأشياء التي نود القيام بها (Bucket List / Adventures)

CREATE TABLE IF NOT EXISTS adventure_bucket (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL, -- 'trip' (طلعة), 'travel' (سفرة)
  location TEXT,
  budget_level TEXT, -- 'low', 'medium', 'high'
  estimated_cost DECIMAL(12, 2) DEFAULT 0,
  image_url TEXT,
  status TEXT DEFAULT 'dream', -- 'dream' (نفسنا نعملها), 'planned' (خططنالها), 'done' (سويناها)
  planned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure a special jar exists for adventures
-- Note: We'll handle the creation of the jar in the application code if not found

-- Enable RLS
ALTER TABLE adventure_bucket ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all operations on adventure_bucket" ON adventure_bucket
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
