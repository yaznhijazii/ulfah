-- Add last_reset_at column to commitments to track auto-resets
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMPTZ DEFAULT NOW();

-- Initialize last_reset_at for existing commitments
UPDATE commitments SET last_reset_at = created_at WHERE last_reset_at IS NULL;
