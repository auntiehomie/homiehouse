/**
 * Bot reply storage — Neon DB-backed tracking for duplicate reply prevention.
 *
 * Replaces the previous in-memory cache (lost on every serverless cold start)
 * with persistent storage in the bot_replies table.
 */

import { getDb } from '@/lib/db';

export interface BotReplyRow {
  id: number;
  parent_hash: string;
  reply_hash: string;
  command_type: string;
  reply_text: string;
  created_at: string;
}

// Self-initialize / self-heal the bot_replies schema. The deployed table was
// created by an older schema missing the parent_hash column (Postgres 42703),
// which broke every dedup check and every reply-record — so the agent would
// re-reply to the same cast on every cron run once posting works. Runs the
// statements individually and idempotently so a partial/legacy table is repaired
// in place without failing the whole batch.
let _ensured = false;
async function ensureTable(): Promise<void> {
  if (_ensured) return;
  const db = getDb();
  const statements = [
    `CREATE TABLE IF NOT EXISTS bot_replies (
       id           SERIAL PRIMARY KEY,
       parent_hash  TEXT,
       reply_hash   TEXT,
       command_type TEXT DEFAULT 'mention',
       reply_text   TEXT,
       created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `ALTER TABLE bot_replies ADD COLUMN IF NOT EXISTS parent_hash  TEXT`,
    `ALTER TABLE bot_replies ADD COLUMN IF NOT EXISTS reply_hash   TEXT`,
    `ALTER TABLE bot_replies ADD COLUMN IF NOT EXISTS command_type TEXT DEFAULT 'mention'`,
    `ALTER TABLE bot_replies ADD COLUMN IF NOT EXISTS reply_text   TEXT`,
    `ALTER TABLE bot_replies ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ DEFAULT NOW()`,
    // Unique index backs the ON CONFLICT (parent_hash) upsert in recordReply.
    `CREATE UNIQUE INDEX IF NOT EXISTS bot_replies_parent_hash_key ON bot_replies (parent_hash)`,
  ];
  for (const sql of statements) {
    try {
      await db.query(sql);
    } catch (err: any) {
      console.error('[bot-reply-storage] ensureTable statement failed:', err?.message);
    }
  }
  _ensured = true;
}

/**
 * Check whether the bot has already replied to a given parent cast hash.
 * Uses the UNIQUE constraint on bot_replies.parent_hash.
 */
export async function hasRepliedTo(parentHash: string): Promise<boolean> {
  try {
    await ensureTable();
    const db = getDb();
    const { rows } = await db.query(
      `SELECT id FROM bot_replies WHERE parent_hash = $1 LIMIT 1`,
      [parentHash]
    );
    return rows.length > 0;
  } catch (err) {
    console.error('[bot-reply-storage] Error checking reply:', err);
    // Fail open: allow reply if DB is unreachable (conservative)
    return false;
  }
}

/**
 * Check whether an array of tracking keys (cast_hash, parent_hash, root_parent_url)
 * has ANY existing reply. Returns the first matching key or null.
 */
export async function hasRepliedToAny(trackingKeys: string[]): Promise<string | null> {
  try {
    await ensureTable();
    const db = getDb();
    const placeholders = trackingKeys.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await db.query(
      `SELECT parent_hash FROM bot_replies WHERE parent_hash IN (${placeholders}) LIMIT 1`,
      trackingKeys
    );
    return rows.length > 0 ? rows[0].parent_hash : null;
  } catch (err) {
    console.error('[bot-reply-storage] Error checking replies:', err);
    return null;
  }
}

/**
 * Record a bot reply in the database.
 * The UNIQUE constraint on parent_hash prevents duplicate inserts.
 */
export async function recordReply(params: {
  parentHash: string;
  replyHash: string;
  commandType?: string;
  replyText?: string;
}): Promise<boolean> {
  try {
    await ensureTable();
    const db = getDb();
    await db.query(
      `INSERT INTO bot_replies (parent_hash, reply_hash, command_type, reply_text)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (parent_hash) DO NOTHING`,
      [
        params.parentHash,
        params.replyHash,
        params.commandType ?? 'mention',
        params.replyText ?? '',
      ]
    );
    return true;
  } catch (err: any) {
    // 23505 = unique violation (already recorded) — that's fine
    if (err?.code === '23505') {
      return true;
    }
    console.error('[bot-reply-storage] Error recording reply:', err);
    return false;
  }
}

/**
 * Record replies for multiple tracking keys (cast_hash, parent_hash, root).
 * Each key gets its own row so any future notification with any of these hashes
 * will be caught.
 */
export async function recordReplyBatch(params: {
  trackingKeys: string[];
  replyHash: string;
  commandType?: string;
  replyText?: string;
}): Promise<void> {
  for (const key of params.trackingKeys) {
    await recordReply({
      parentHash: key,
      replyHash: params.replyHash,
      commandType: params.commandType,
      replyText: params.replyText,
    });
  }
}