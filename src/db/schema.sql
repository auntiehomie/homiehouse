-- Users table (FID-based, populated on first login via Privy)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fid INTEGER UNIQUE NOT NULL,
  username TEXT,
  display_name TEXT,
  pfp_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved casts
CREATE TABLE IF NOT EXISTS saved_casts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cast_hash TEXT NOT NULL,
  cast_author_fid INTEGER,
  cast_author_username TEXT,
  cast_text TEXT,
  cast_timestamp TIMESTAMPTZ,
  embeds JSONB DEFAULT '[]',
  raw_cast JSONB,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, cast_hash)
);

-- Notes on saved casts
CREATE TABLE IF NOT EXISTS cast_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cast_id UUID NOT NULL REFERENCES saved_casts(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_casts_user_id ON saved_casts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_casts_cast_hash ON saved_casts(cast_hash);
CREATE INDEX IF NOT EXISTS idx_cast_notes_cast_id ON cast_notes(cast_id);
CREATE INDEX IF NOT EXISTS idx_cast_notes_user_id ON cast_notes(user_id);
