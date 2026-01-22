-- Fix Chess Game Issues
-- This script ensures proper Realtime functionality and data structure for chess games

-- 1. Enable Realtime for game_rooms table
ALTER PUBLICATION supabase_realtime ADD TABLE game_rooms;

-- 2. Ensure game_state is properly structured as JSONB
-- Check if game_state needs type conversion
DO $$
BEGIN
    -- If game_state is TEXT, convert to JSONB
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_rooms' 
        AND column_name = 'game_state' 
        AND data_type = 'text'
    ) THEN
        -- First, update any existing text data to valid JSON
        UPDATE game_rooms 
        SET game_state = '{}'::jsonb 
        WHERE game_state IS NULL OR game_state = '';
        
        -- Then alter column type
        ALTER TABLE game_rooms 
        ALTER COLUMN game_state TYPE JSONB 
        USING game_state::jsonb;
    END IF;
END $$;

-- 3. Ensure guest_user_id can be NULL or 'AI'
-- (Already should be nullable, but let's make sure)
ALTER TABLE game_rooms ALTER COLUMN guest_user_id DROP NOT NULL;

-- 4. Add index for faster room lookups
CREATE INDEX IF NOT EXISTS idx_game_rooms_room_code ON game_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_game_rooms_status ON game_rooms(status);

-- 5. Update RLS policies to allow proper access
DROP POLICY IF EXISTS "Players can view their room" ON game_rooms;
DROP POLICY IF EXISTS "Players can update their room" ON game_rooms;
DROP POLICY IF EXISTS "Users can create rooms" ON game_rooms;
DROP POLICY IF EXISTS "Anyone can view active rooms" ON game_rooms;

-- More permissive policies for game functionality
CREATE POLICY "Anyone can view active rooms" 
ON game_rooms FOR SELECT 
TO anon, authenticated 
USING (status != 'finished' OR created_at > NOW() - INTERVAL '1 hour');

CREATE POLICY "Players can update their room" 
ON game_rooms FOR UPDATE 
TO anon, authenticated 
USING (
    host_user_id = auth.uid() 
    OR guest_user_id = auth.uid()
    OR guest_user_id = 'AI'
);

CREATE POLICY "Users can create rooms" 
ON game_rooms FOR INSERT 
TO anon, authenticated 
WITH CHECK (host_user_id = auth.uid());

-- 6. Clean up old finished games (optional, for performance)
-- DELETE FROM game_rooms WHERE status = 'finished' AND created_at < NOW() - INTERVAL '7 days';

COMMENT ON TABLE game_rooms IS 'Stores multiplayer game sessions including Chess and BoomBoom';
COMMENT ON COLUMN game_rooms.game_state IS 'JSONB field storing game-specific state (board, turn, etc)';
COMMENT ON COLUMN game_rooms.guest_user_id IS 'Second player ID or AI for single-player mode';
