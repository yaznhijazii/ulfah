-- Gift Wishlist table to store items partners wish to receive
CREATE TABLE IF NOT EXISTS gift_wishlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    partnership_id UUID REFERENCES partnerships(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    link_url TEXT,
    is_received BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE gift_wishlist ENABLE ROW LEVEL SECURITY;

-- Simple policy for anonymity/authenticated access during development
CREATE POLICY "Allow all on gift_wishlist" ON gift_wishlist
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE gift_wishlist;
