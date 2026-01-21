-- Ulfah App - Finance Module Schema
-- مخطط نظام الإدارة المالية (حصالة وتوزيع الرواتب)

-- Finance Jars (Hassala)
-- جدول الحصالات
CREATE TABLE IF NOT EXISTS finance_jars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_amount DECIMAL(12, 2) NOT NULL,
  current_amount DECIMAL(12, 2) DEFAULT 0,
  deadline DATE,
  is_shared BOOLEAN DEFAULT TRUE,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Finance Jar Contributions
-- جدول المساهمات في الحصالة
CREATE TABLE IF NOT EXISTS jar_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  jar_id UUID NOT NULL REFERENCES finance_jars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Salary Distribution Plans
-- جدول خطط توزيع الرواتب
CREATE TABLE IF NOT EXISTS salary_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  salary_amount DECIMAL(12, 2) NOT NULL,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Salary Plan Items (Categories)
-- جدول بنود توزيع الرواتب
CREATE TABLE IF NOT EXISTS salary_plan_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES salary_plans(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  allocated_amount DECIMAL(12, 2) NOT NULL,
  jar_id UUID REFERENCES finance_jars(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE finance_jars ENABLE ROW LEVEL SECURITY;
ALTER TABLE jar_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_plan_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all operations on finance_jars" ON finance_jars
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on jar_contributions" ON jar_contributions
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on salary_plans" ON salary_plans
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on salary_plan_items" ON salary_plan_items
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_finance_jars_updated_at BEFORE UPDATE ON finance_jars
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_salary_plans_updated_at BEFORE UPDATE ON salary_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
