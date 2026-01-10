-- Ulfah App - Supabase Database Schema
-- مخطط قاعدة البيانات لتطبيق أُلْفَة

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop all existing tables (if any)
DROP TABLE IF EXISTS notification_settings CASCADE;
DROP TABLE IF EXISTS preferences CASCADE;
DROP TABLE IF EXISTS commitment_logs CASCADE;
DROP TABLE IF EXISTS commitments CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS rules CASCADE;
DROP TABLE IF EXISTS promises CASCADE;
DROP TABLE IF EXISTS game_answers CASCADE;
DROP TABLE IF EXISTS game_questions CASCADE;
DROP TABLE IF EXISTS travel_destinations CASCADE;
DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS memory_images CASCADE;
DROP TABLE IF EXISTS memories CASCADE;
DROP TABLE IF EXISTS daily_moods CASCADE;
DROP TABLE IF EXISTS partnerships CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table (with username and password)
-- جدول المستخدمين (مع اسم المستخدم وكلمة المرور)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  linking_code TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Partnerships table
-- جدول الشراكات (العلاقات الثنائية)
CREATE TABLE partnerships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship_start_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  locked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id != user2_id)
);

-- Daily moods table
-- جدول المشاعر اليومية
CREATE TABLE daily_moods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  mood TEXT NOT NULL CHECK (mood IN ('happy', 'good', 'okay', 'sad')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Memories table
-- جدول الذكريات
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  memory_date DATE NOT NULL,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Memory images table
-- جدول صور الذكريات
CREATE TABLE memory_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Calendar events table
-- جدول أحداث التقويم
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  location TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('special', 'meeting', 'travel', 'other')),
  image_url TEXT,
  reminder_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Travel destinations table
-- جدول وجهات السفر
CREATE TABLE travel_destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  destination_name TEXT NOT NULL,
  country TEXT,
  status TEXT NOT NULL CHECK (status IN ('traveled', 'planned', 'dream')),
  travel_date DATE,
  notes TEXT,
  image_url TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game questions table
-- جدول أسئلة الألعاب
CREATE TABLE game_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partnership_id UUID REFERENCES partnerships(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('question', 'know-me', 'choice')),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game answers table
-- جدول إجابات الألعاب
CREATE TABLE game_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES game_questions(id) ON DELETE CASCADE,
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Promises table
-- جدول الوعود
CREATE TABLE promises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  promise_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rules table
-- جدول القواعد
CREATE TABLE rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks table
-- جدول المهام
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_text TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_by_user_id UUID REFERENCES users(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Commitments table
-- جدول الالتزامات
CREATE TABLE commitments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_count INTEGER NOT NULL, -- الهدف (مثلاً: 5 مرات)
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')), -- يومي، أسبوعي، شهري
  punishment TEXT NOT NULL, -- العقاب
  start_date DATE NOT NULL,
  end_date DATE, -- إذا كان محدد بفترة
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Commitment tracking table
-- جدول تتبع الالتزامات
CREATE TABLE commitment_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commitment_id UUID NOT NULL REFERENCES commitments(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(commitment_id, log_date)
);

-- User preferences table
-- جدول تفضيلات المستخدمين
CREATE TABLE preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preference_text TEXT NOT NULL,
  preference_type TEXT NOT NULL CHECK (preference_type IN ('likes', 'dislikes')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification settings table
-- جدول إعدادات الإشعارات
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  daily_mood_time TIME DEFAULT '12:00:00',
  mood_reminder_enabled BOOLEAN DEFAULT TRUE,
  event_reminder_enabled BOOLEAN DEFAULT TRUE,
  partner_mood_notify BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_partnerships_user1 ON partnerships(user1_id);
CREATE INDEX idx_partnerships_user2 ON partnerships(user2_id);
CREATE INDEX idx_daily_moods_partnership ON daily_moods(partnership_id);
CREATE INDEX idx_daily_moods_user ON daily_moods(user_id);
CREATE INDEX idx_daily_moods_date ON daily_moods(date);
CREATE INDEX idx_memories_partnership ON memories(partnership_id);
CREATE INDEX idx_memory_images_memory ON memory_images(memory_id);
CREATE INDEX idx_calendar_events_partnership ON calendar_events(partnership_id);
CREATE INDEX idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX idx_travel_destinations_partnership ON travel_destinations(partnership_id);
CREATE INDEX idx_game_answers_partnership ON game_answers(partnership_id);
CREATE INDEX idx_promises_partnership ON promises(partnership_id);
CREATE INDEX idx_rules_partnership ON rules(partnership_id);
CREATE INDEX idx_commitments_partnership ON commitments(partnership_id);
CREATE INDEX idx_commitments_owner ON commitments(owner_user_id);
CREATE INDEX idx_commitment_logs_commitment ON commitment_logs(commitment_id);
CREATE INDEX idx_commitment_logs_date ON commitment_logs(log_date);

-- Functions for automatic updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memories_updated_at BEFORE UPDATE ON memories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_travel_destinations_updated_at BEFORE UPDATE ON travel_destinations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commitments_updated_at BEFORE UPDATE ON commitments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some default game questions (optional)
INSERT INTO game_questions (question_text, question_type, is_default) VALUES
  ('ما هو أفضل شيء حدث لك اليوم؟', 'question', TRUE),
  ('ما هي ذكرتك المفضلة معي؟', 'question', TRUE),
  ('ما هو حلمك الذي تريد تحقيقه معًا؟', 'question', TRUE),
  ('ما هو مكانك المفضل في العالم؟', 'know-me', TRUE),
  ('ما هي هوايتك المفضلة؟', 'know-me', TRUE);

-- Enable Row Level Security (RLS) on all tables
-- تفعيل سياسات الأمان على مستوى الصفوف

-- ⚠️ تعطيل RLS على جدول users لأننا نستخدم custom authentication
-- سنفعله لاحقاً عندما نضيف Supabase Auth
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;

ALTER TABLE partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_moods ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE promises ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
-- سياسات الأمان لجدول المستخدمين
-- معطلة مؤقتاً - سنفعلها لاحقاً مع Supabase Auth

-- السماح لأي شخص بإنشاء حساب جديد (للتسجيل)
-- CREATE POLICY "Allow public user creation" ON users
--   FOR INSERT
--   TO anon, authenticated
--   WITH CHECK (true);

-- السماح للمستخدمين بقراءة بياناتهم الخاصة
-- CREATE POLICY "Users can read own data" ON users
--   FOR SELECT
--   TO authenticated
--   USING (true);

-- السماح للمستخدمين بتحديث بياناتهم الخاصة فقط
-- CREATE POLICY "Users can update own data" ON users
--   FOR UPDATE
--   TO authenticated
--   USING (true)
--   WITH CHECK (true);

-- RLS Policies for partnerships table
-- سياسات الأمان لجدول الشراكات

CREATE POLICY "Allow all operations on partnerships" ON partnerships
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for daily_moods table
CREATE POLICY "Allow all operations on daily_moods" ON daily_moods
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for memories table
CREATE POLICY "Allow all operations on memories" ON memories
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for memory_images table
CREATE POLICY "Allow all operations on memory_images" ON memory_images
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for calendar_events table
CREATE POLICY "Allow all operations on calendar_events" ON calendar_events
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for travel_destinations table
CREATE POLICY "Allow all operations on travel_destinations" ON travel_destinations
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for game_questions table
CREATE POLICY "Allow all operations on game_questions" ON game_questions
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for game_answers table
CREATE POLICY "Allow all operations on game_answers" ON game_answers
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for promises table
CREATE POLICY "Allow all operations on promises" ON promises
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for rules table
CREATE POLICY "Allow all operations on rules" ON rules
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for tasks table
CREATE POLICY "Allow all operations on tasks" ON tasks
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for commitments table
CREATE POLICY "Allow all operations on commitments" ON commitments
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for commitment_logs table
CREATE POLICY "Allow all operations on commitment_logs" ON commitment_logs
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for preferences table
CREATE POLICY "Allow all operations on preferences" ON preferences
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for notification_settings table
CREATE POLICY "Allow all operations on notification_settings" ON notification_settings
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);