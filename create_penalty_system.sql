-- Drop tables if they exist to start fresh
DROP TABLE IF EXISTS penalty_records;
DROP TABLE IF EXISTS penalty_rules;

-- Create penalty_rules table
CREATE TABLE penalty_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partnership_id UUID REFERENCES partnerships(id) ON DELETE CASCADE,
    created_by_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    sub_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create penalty_records table
CREATE TABLE penalty_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partnership_id UUID REFERENCES partnerships(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- The violator
    rule_id UUID REFERENCES penalty_rules(id) ON DELETE CASCADE,
    sub_rule_id TEXT NOT NULL,
    points INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security for penalty_rules
ALTER TABLE penalty_rules ENABLE ROW LEVEL SECURITY;

-- Allow all operations for custom auth
CREATE POLICY "Allow all select penalty_rules" ON penalty_rules FOR SELECT USING (true);
CREATE POLICY "Allow all insert penalty_rules" ON penalty_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update penalty_rules" ON penalty_rules FOR UPDATE USING (true);
CREATE POLICY "Allow all delete penalty_rules" ON penalty_rules FOR DELETE USING (true);

-- Row Level Security for penalty_records
ALTER TABLE penalty_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select penalty_records" ON penalty_records FOR SELECT USING (true);
CREATE POLICY "Allow all insert penalty_records" ON penalty_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update penalty_records" ON penalty_records FOR UPDATE USING (true);
CREATE POLICY "Allow all delete penalty_records" ON penalty_records FOR DELETE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE penalty_rules;
ALTER PUBLICATION supabase_realtime ADD TABLE penalty_records;
