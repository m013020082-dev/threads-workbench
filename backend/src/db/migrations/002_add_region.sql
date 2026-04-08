-- Add region column to posts for Taiwan-specific filtering
ALTER TABLE posts ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'TW';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS author_location TEXT DEFAULT '';

-- Index for region filtering
CREATE INDEX IF NOT EXISTS idx_posts_region ON posts(region);
