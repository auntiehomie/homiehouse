-- Migration: Create scheduled_casts table
-- Description: Store casts that are scheduled to be posted at a future time

CREATE TABLE IF NOT EXISTS scheduled_casts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_fid INTEGER NOT NULL,
  signer_uuid TEXT NOT NULL,
  text TEXT NOT NULL,
  embeds JSONB DEFAULT '[]'::jsonb,
  channel_id TEXT,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed', 'cancelled')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  cast_hash TEXT
);

-- Index for finding pending casts that need to be published
CREATE INDEX IF NOT EXISTS idx_scheduled_casts_status_time 
ON scheduled_casts(status, scheduled_time) 
WHERE status = 'pending';

-- Index for user's scheduled casts
CREATE INDEX IF NOT EXISTS idx_scheduled_casts_user_fid 
ON scheduled_casts(user_fid, created_at DESC);

-- Add comment
COMMENT ON TABLE scheduled_casts IS 'Stores casts scheduled to be published at a future time';
COMMENT ON COLUMN scheduled_casts.status IS 'pending: waiting to be published, published: successfully posted, failed: error during publish, cancelled: user cancelled';
