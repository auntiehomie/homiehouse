-- Curated Lists Table
CREATE TABLE IF NOT EXISTS curated_lists (
  id SERIAL PRIMARY KEY,
  fid INTEGER NOT NULL,
  list_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(fid, list_name)
);

-- Curated List Items Table
CREATE TABLE IF NOT EXISTS curated_list_items (
  id SERIAL PRIMARY KEY,
  list_id INTEGER NOT NULL REFERENCES curated_lists(id) ON DELETE CASCADE,
  cast_hash VARCHAR(100) NOT NULL,
  cast_author_fid INTEGER,
  cast_text TEXT,
  cast_timestamp TIMESTAMP,
  added_by_fid INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(list_id, cast_hash)
);

-- Bot Conversation State Table (for multi-turn conversations)
CREATE TABLE IF NOT EXISTS bot_conversations (
  id SERIAL PRIMARY KEY,
  user_fid INTEGER NOT NULL,
  conversation_type VARCHAR(50) NOT NULL,
  state VARCHAR(50) NOT NULL,
  context_data JSONB,
  parent_cast_hash VARCHAR(100),
  last_interaction_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_curated_lists_fid ON curated_lists(fid);
CREATE INDEX IF NOT EXISTS idx_curated_list_items_list_id ON curated_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_curated_list_items_cast_hash ON curated_list_items(cast_hash);
CREATE INDEX IF NOT EXISTS idx_bot_conversations_user_fid ON bot_conversations(user_fid);
CREATE INDEX IF NOT EXISTS idx_bot_conversations_expires_at ON bot_conversations(expires_at);

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_curated_lists_updated_at BEFORE UPDATE ON curated_lists
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
