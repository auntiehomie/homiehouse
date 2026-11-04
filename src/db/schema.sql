-- Users table (FID-based, populated on first login via Farcaster signer)
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

-- Learning progress (FID-keyed, cross-device sync)
CREATE TABLE IF NOT EXISTS learning_progress (
  fid INTEGER PRIMARY KEY,
  plan JSONB,
  completed_ids JSONB DEFAULT '[]',
  completions JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learner-submitted corrections for generated lesson content.
CREATE TABLE IF NOT EXISTS lesson_correction_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id TEXT NOT NULL,
  module_title TEXT NOT NULL,
  step_number INTEGER NOT NULL CHECK (step_number > 0),
  card_label TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('factually_incorrect', 'outdated', 'missing_source', 'unclear', 'other')),
  report TEXT NOT NULL,
  suggested_correction TEXT,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  resolution_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_lesson_correction_reports_status_created
  ON lesson_correction_reports (status, created_at DESC);

-- Ask Homie Pro add-on subscriptions and monthly response allowance.
CREATE TABLE IF NOT EXISTS ask_homie_pro_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_fid INTEGER UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ask_homie_usage (
  user_fid INTEGER NOT NULL,
  period_start DATE NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_fid, period_start)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_casts_user_id ON saved_casts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_casts_cast_hash ON saved_casts(cast_hash);
CREATE INDEX IF NOT EXISTS idx_cast_notes_cast_id ON cast_notes(cast_id);
CREATE INDEX IF NOT EXISTS idx_cast_notes_user_id ON cast_notes(user_id);
