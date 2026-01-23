-- Optimizing Database Performance for Ulfah App

-- 1. Index for Memories (Critical for Timeline)
-- optimizing filtering by partnership and sorting by date (descending)
CREATE INDEX IF NOT EXISTS idx_memories_partnership_date 
ON memories(partnership_id, memory_date DESC);

-- 2. Index for Calendar Events
CREATE INDEX IF NOT EXISTS idx_events_partnership_date 
ON calendar_events(partnership_id, event_date DESC);

-- 3. Index for Mood Logs (used in Home Screen extensively)
-- composite index for fetching specific user's mood on specific date
CREATE INDEX IF NOT EXISTS idx_mood_logs_user_date 
ON mood_logs(user_id, mood_date);

-- 4. Index for Notifications (Love Nudges)
-- Filter by user_id is the most common operation
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON notifications(user_id, created_at DESC);

-- 5. Index for Partnerships lookup
CREATE INDEX IF NOT EXISTS idx_partnerships_users 
ON partnerships(user1_id, user2_id);
