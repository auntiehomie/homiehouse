/**
 * Persistent memory for the @homiehouselol agent.
 *
 * Stores every post/reply the agent makes so it can:
 * - Avoid repeating recent topics
 * - Build conversational continuity
 * - Give Claude context about its recent activity
 *
 * Self-initializes the agent_posts table on first use.
 */

import { getDb } from '@/lib/db';

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS agent_posts (
    id        SERIAL PRIMARY KEY,
    fid       INTEGER      NOT NULL,
    cast_hash TEXT,
    text      TEXT         NOT NULL,
    source    TEXT         NOT NULL DEFAULT 'tip',
    topic     TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS agent_posts_fid_created ON agent_posts (fid, created_at DESC);
`;

async function ensureTable(): Promise<void> {
  const db = getDb();
  await db.query(CREATE_TABLE_SQL);
}

export interface AgentPost {
  id: number;
  fid: number;
  cast_hash: string | null;
  text: string;
  source: string;
  topic: string | null;
  created_at: string;
}

/**
 * Fetch the N most recent posts by this agent FID.
 * Returns [] (not throws) if DB is unavailable.
 */
export async function getRecentPosts(fid: number, limit = 10): Promise<AgentPost[]> {
  try {
    await ensureTable();
    const db = getDb();
    const { rows } = await db.query<AgentPost>(
      `SELECT id, fid, cast_hash, text, source, topic, created_at
       FROM agent_posts
       WHERE fid = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [fid, limit]
    );
    return rows;
  } catch (err) {
    console.warn('[agent-memory] getRecentPosts failed (DB unavailable?):', (err as Error).message);
    return [];
  }
}

/**
 * Persist a post the agent just made.
 * Fails silently so a DB hiccup never breaks the posting path.
 */
export async function savePost(params: {
  fid: number;
  castHash?: string;
  text: string;
  source: 'tip' | 'trend' | 'reply' | string;
  topic?: string;
}): Promise<void> {
  try {
    await ensureTable();
    const db = getDb();
    await db.query(
      `INSERT INTO agent_posts (fid, cast_hash, text, source, topic)
       VALUES ($1, $2, $3, $4, $5)`,
      [params.fid, params.castHash ?? null, params.text, params.source, params.topic ?? null]
    );
  } catch (err) {
    console.warn('[agent-memory] savePost failed:', (err as Error).message);
  }
}

/**
 * Build a short memory context string suitable for injecting into a Claude prompt.
 * Returns an empty string if there are no recent posts.
 */
export function buildMemoryContext(posts: AgentPost[]): string {
  if (!posts.length) return '';

  const lines = posts
    .slice(0, 8)
    .map((p) => {
      const age = formatAge(new Date(p.created_at));
      const label = p.topic ? `[${p.topic}]` : `[${p.source}]`;
      return `• ${age} ${label}: "${p.text.slice(0, 100)}${p.text.length > 100 ? '…' : ''}"`;
    })
    .join('\n');

  return `\nYour recent posts (avoid repeating these topics/ideas):\n${lines}\n`;
}

function formatAge(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
