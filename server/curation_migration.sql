-- User Curation Preferences Table
-- Run this SQL in your Supabase SQL Editor: https://afpxttdtxzdmaiyvnvjd.supabase.co

-- Create the user_curation_preferences table
CREATE TABLE IF NOT EXISTS user_curation_preferences (
    id BIGSERIAL PRIMARY KEY,
    fid BIGINT NOT NULL,
    preference_type TEXT NOT NULL, -- 'keyword', 'channel', 'author', 'content_type'
    preference_value TEXT NOT NULL,
    action TEXT NOT NULL, -- 'include', 'exclude'
    priority INTEGER DEFAULT 0, -- Higher priority = applied first
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_curation_fid ON user_curation_preferences(fid);
CREATE INDEX IF NOT EXISTS idx_curation_type ON user_curation_preferences(preference_type);
CREATE INDEX IF NOT EXISTS idx_curation_fid_type ON user_curation_preferences(fid, preference_type);

-- Create unique constraint to prevent duplicate preferences
CREATE UNIQUE INDEX IF NOT EXISTS idx_curation_unique 
ON user_curation_preferences(fid, preference_type, preference_value, action);

-- Add comments explaining the table
COMMENT ON TABLE user_curation_preferences IS 'Stores user preferences for curating their feed';
COMMENT ON COLUMN user_curation_preferences.fid IS 'Farcaster user ID (FID)';
COMMENT ON COLUMN user_curation_preferences.preference_type IS 'Type: keyword, channel, author, content_type, min_likes, max_length';
COMMENT ON COLUMN user_curation_preferences.preference_value IS 'The value to filter by (e.g., keyword text, channel name, author FID)';
COMMENT ON COLUMN user_curation_preferences.action IS 'include (show more like this) or exclude (hide)';
COMMENT ON COLUMN user_curation_preferences.priority IS 'Priority order for applying filters (higher = first)';

-- Verify the table was created
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM 
    information_schema.columns 
WHERE 
    table_name = 'user_curation_preferences'
ORDER BY 
    ordinal_position;
