-- Bot Replies Tracking Table
-- Run this SQL in your Supabase SQL Editor: https://afpxttdtxzdmaiyvnvjd.supabase.co

-- Create the bot_replies table
CREATE TABLE IF NOT EXISTS bot_replies (
    id BIGSERIAL PRIMARY KEY,
    parent_hash TEXT NOT NULL UNIQUE,
    reply_hash TEXT NOT NULL,
    command_type TEXT NOT NULL,
    reply_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bot_replies_parent_hash ON bot_replies(parent_hash);
CREATE INDEX IF NOT EXISTS idx_bot_replies_created_at ON bot_replies(created_at);

-- Add comment explaining the table
COMMENT ON TABLE bot_replies IS 'Tracks all replies sent by the homiehouse bot to prevent duplicate responses';
COMMENT ON COLUMN bot_replies.parent_hash IS 'The hash of the cast being replied to (unique constraint prevents duplicates)';
COMMENT ON COLUMN bot_replies.reply_hash IS 'The hash of the bot''s reply cast';
COMMENT ON COLUMN bot_replies.command_type IS 'Type of command: mention, save, opinion, etc.';

-- Verify the table was created
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM 
    information_schema.columns 
WHERE 
    table_name = 'bot_replies'
ORDER BY 
    ordinal_position;
