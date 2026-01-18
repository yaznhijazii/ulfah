-- Add new columns to dialogues table to support structured conflict resolution
ALTER TABLE dialogues ADD COLUMN IF NOT EXISTS problem TEXT;
ALTER TABLE dialogues ADD COLUMN IF NOT EXISTS my_opinion TEXT;
ALTER TABLE dialogues ADD COLUMN IF NOT EXISTS partner_opinion TEXT;

-- Ensure agreements have a link back to dialogues (optional but good for tracking origin)
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS origin_dialogue_id UUID REFERENCES dialogues(id) ON DELETE SET NULL;
