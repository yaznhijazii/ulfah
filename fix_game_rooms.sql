
-- Fix missing columns for game_rooms
-- Run this script to ensure the table has the 'grid_size' column required by the game.

-- 1. Add grid_size column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_rooms' AND column_name = 'grid_size') THEN
        ALTER TABLE game_rooms ADD COLUMN grid_size INTEGER DEFAULT 6;
    END IF;
END $$;

-- 2. Ensure game_state column exists (just in case)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_rooms' AND column_name = 'game_state') THEN
        ALTER TABLE game_rooms ADD COLUMN game_state JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 3. Reload schema cache (not strictly SQL command, but restarting the app usually fixes cache issues. 
-- However, alerting Supabase to structure changes happens automatically on DDL).

-- 4. Re-apply policies to be safe (idempotent)
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can view their room" ON game_rooms;
DROP POLICY IF EXISTS "Players can update their room" ON game_rooms;
DROP POLICY IF EXISTS "Users can create rooms" ON game_rooms;

CREATE POLICY "Players can view their room" ON game_rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Players can update their room" ON game_rooms FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Users can create rooms" ON game_rooms FOR INSERT TO anon, authenticated WITH CHECK (true);
