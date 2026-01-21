
-- Create game_rooms table for multiplayer games
CREATE TABLE IF NOT EXISTS game_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code TEXT UNIQUE NOT NULL,
  game_type TEXT NOT NULL,
  host_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guest_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'setup', 'playing', 'finished')),
  game_state JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_game_rooms_code ON game_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_game_rooms_host ON game_rooms(host_user_id);
CREATE INDEX IF NOT EXISTS idx_game_rooms_guest ON game_rooms(guest_user_id);

-- RLS Policies
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;

-- Allow anyone to create a room (authenticated)
-- CREATE POLICY "Users can create rooms" ON game_rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_user_id);

-- Allow players in the room to view it
CREATE POLICY "Players can view their room" ON game_rooms
  FOR SELECT
  TO anon, authenticated
  USING (true); -- Simplified for now, in production restrict to host_user_id or guest_user_id

-- Allow players in the room to update it
CREATE POLICY "Players can update their room" ON game_rooms
  FOR UPDATE
  TO anon, authenticated
  USING (true); -- Simplified for now

-- Trigger for updated_at
CREATE TRIGGER update_game_rooms_updated_at BEFORE UPDATE ON game_rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
