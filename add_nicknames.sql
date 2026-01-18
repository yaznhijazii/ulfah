-- Add nickname columns to partnerships table
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS user1_nickname TEXT;
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS user2_nickname TEXT;

-- Update RLS if needed (optional but good practice)
-- Usually partnerships table is already accessible to both users.
