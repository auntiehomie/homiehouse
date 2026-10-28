/**
 * Tiny key/value state for the X agent — currently just the last-seen mention
 * ID, so the mention poll uses `since_id` and never re-reads (and re-pays for)
 * mentions it already handled.
 */

import { getDb } from '@/lib/db';

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS agent_x_state (
    key        TEXT PRIMARY KEY,
    value      TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

async function ensureTable(): Promise<void> {
  const db = getDb();
  await db.query(CREATE_TABLE_SQL);
}

export async function getXState(key: string): Promise<string | null> {
  try {
    await ensureTable();
    const db = getDb();
    const { rows } = await db.query<{ value: string | null }>(
      `SELECT value FROM agent_x_state WHERE key = $1`,
      [key]
    );
    return rows[0]?.value ?? null;
  } catch (err: any) {
    console.error('[x-state] getXState failed:', err?.message);
    return null;
  }
}

export async function setXState(key: string, value: string): Promise<void> {
  try {
    await ensureTable();
    const db = getDb();
    await db.query(
      `INSERT INTO agent_x_state (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value]
    );
  } catch (err: any) {
    console.error('[x-state] setXState failed:', err?.message);
  }
}
