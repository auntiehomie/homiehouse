/**
 * Active boost tracking for burn-for-boost shop items.
 *
 * When a user purchases a burn-for-boost item, an entry is recorded here
 * with an expiry timestamp. The learning-completion route checks for
 * active boosts to apply reward multipliers.
 */

import { getDb } from '@/lib/db';

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS hh2_active_boosts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fid INTEGER NOT NULL,
    boost_id TEXT NOT NULL,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_hh2_active_boosts_fid_expires ON hh2_active_boosts (fid, expires_at);
`;

let tablesReady = false;
async function ensureTable() {
  if (tablesReady) return;
  const db = getDb();
  await db.query(CREATE_TABLE_SQL);
  tablesReady = true;
}

// Boost durations in hours
const BOOST_DURATIONS: Record<string, number> = {
  'burn-double-earnings-24h': 24,
  'burn-streak-freeze': 1, // instant — but we record it for audit
  'burn-priority-queue': 168, // 7 days
};

/**
 * Record a boost purchase and return its expiry time.
 */
export async function activateBoost(fid: number, boostId: string): Promise<Date | null> {
  const hours = BOOST_DURATIONS[boostId];
  if (!hours) return null;
  await ensureTable();
  const db = getDb();
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  await db.query(
    'INSERT INTO hh2_active_boosts (fid, boost_id, expires_at) VALUES ($1, $2, $3)',
    [fid, boostId, expiresAt]
  );
  return expiresAt;
}

/**
 * Check if a user has an active boost of the given type.
 */
export async function hasActiveBoost(fid: number, boostId: string): Promise<boolean> {
  await ensureTable();
  const db = getDb();
  const { rows } = await db.query(
    "SELECT 1 FROM hh2_active_boosts WHERE fid = $1 AND boost_id = $2 AND expires_at > NOW() LIMIT 1",
    [fid, boostId]
  );
  return rows.length > 0;
}

/**
 * Get all active (non-expired) boosts for a user.
 */
export async function getActiveBoosts(fid: number): Promise<{ boost_id: string; expires_at: Date }[]> {
  await ensureTable();
  const db = getDb();
  const { rows } = await db.query(
    "SELECT boost_id, expires_at FROM hh2_active_boosts WHERE fid = $1 AND expires_at > NOW() ORDER BY expires_at ASC",
    [fid]
  );
  return rows;
}
