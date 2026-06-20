/**
 * Persistent memory for the @homiehouselol agent.
 *
 * Stores every post/reply the agent makes so it can:
 * - Avoid repeating recent topics
 * - Build conversational continuity
 * - Learn from engagement (likes, recasts, replies) over time
 *
 * Self-initializes the agent_posts table on first use.
 */

import { getDb } from '@/lib/db';

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS agent_posts (
    id                   SERIAL PRIMARY KEY,
    fid                  INTEGER      NOT NULL,
    cast_hash            TEXT,
    text                 TEXT         NOT NULL,
    source               TEXT         NOT NULL DEFAULT 'tip',
    topic                TEXT,
    likes                INTEGER,
    recasts              INTEGER,
    replies              INTEGER,
    engagement_checked_at TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS agent_posts_fid_created ON agent_posts (fid, created_at DESC);
  CREATE INDEX IF NOT EXISTS agent_posts_cast_hash   ON agent_posts (cast_hash) WHERE cast_hash IS NOT NULL;
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
  likes: number | null;
  recasts: number | null;
  replies: number | null;
  engagement_checked_at: string | null;
  created_at: string;
}

function engagementScore(p: AgentPost): number {
  return (p.likes ?? 0) + (p.recasts ?? 0) * 2 + (p.replies ?? 0);
}

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * Fetch the N most recent posts by this agent FID.
 * Returns [] (not throws) if DB is unavailable.
 */
export async function getRecentPosts(fid: number, limit = 10): Promise<AgentPost[]> {
  try {
    await ensureTable();
    const db = getDb();
    const { rows } = await db.query<AgentPost>(
      `SELECT * FROM agent_posts WHERE fid = $1 ORDER BY created_at DESC LIMIT $2`,
      [fid, limit]
    );
    return rows;
  } catch (err) {
    console.warn('[agent-memory] getRecentPosts failed:', (err as Error).message);
    return [];
  }
}

/**
 * Fetch posts that have a cast_hash but haven't had engagement checked recently.
 * Covers posts from the last 7 days — engagement still accumulates in that window.
 */
export async function getPostsNeedingEngagementCheck(
  fid: number,
  limit = 15
): Promise<AgentPost[]> {
  try {
    await ensureTable();
    const db = getDb();
    const { rows } = await db.query<AgentPost>(
      `SELECT * FROM agent_posts
       WHERE fid = $1
         AND cast_hash IS NOT NULL
         AND created_at > NOW() - INTERVAL '7 days'
         AND (
           engagement_checked_at IS NULL
           OR engagement_checked_at < NOW() - INTERVAL '12 hours'
         )
       ORDER BY created_at DESC
       LIMIT $2`,
      [fid, limit]
    );
    return rows;
  } catch (err) {
    console.warn('[agent-memory] getPostsNeedingEngagementCheck failed:', (err as Error).message);
    return [];
  }
}

/**
 * Fetch top-performing posts (by engagement score) from the last 30 days.
 */
export async function getTopPosts(fid: number, limit = 5): Promise<AgentPost[]> {
  try {
    await ensureTable();
    const db = getDb();
    const { rows } = await db.query<AgentPost>(
      `SELECT * FROM agent_posts
       WHERE fid = $1
         AND created_at > NOW() - INTERVAL '30 days'
         AND (likes IS NOT NULL OR recasts IS NOT NULL OR replies IS NOT NULL)
       ORDER BY (COALESCE(likes,0) + COALESCE(recasts,0)*2 + COALESCE(replies,0)) DESC
       LIMIT $2`,
      [fid, limit]
    );
    return rows;
  } catch (err) {
    console.warn('[agent-memory] getTopPosts failed:', (err as Error).message);
    return [];
  }
}

// ─── Write ───────────────────────────────────────────────────────────────────

/**
 * Persist a post the agent just made.
 * Fails silently so a DB hiccup never blocks the posting path.
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
 * Write engagement stats back to a post row.
 */
export async function updatePostEngagement(params: {
  castHash: string;
  likes: number;
  recasts: number;
  replies: number;
}): Promise<void> {
  try {
    const db = getDb();
    await db.query(
      `UPDATE agent_posts
       SET likes = $1, recasts = $2, replies = $3, engagement_checked_at = NOW()
       WHERE cast_hash = $4`,
      [params.likes, params.recasts, params.replies, params.castHash]
    );
  } catch (err) {
    console.warn('[agent-memory] updatePostEngagement failed:', (err as Error).message);
  }
}

// ─── Context builder ─────────────────────────────────────────────────────────

/**
 * Build a memory context string for injection into a Claude prompt.
 * Includes recent posts AND top performers so the model can see what resonates.
 */
export async function buildFullMemoryContext(fid: number): Promise<string> {
  const [recent, top] = await Promise.all([
    getRecentPosts(fid, 8),
    getTopPosts(fid, 3),
  ]);
  return buildMemoryContext(recent, top);
}

export function buildMemoryContext(recent: AgentPost[], top: AgentPost[] = []): string {
  if (!recent.length && !top.length) return '';

  const parts: string[] = [];

  if (recent.length) {
    const lines = recent.map((p) => {
      const age = formatAge(new Date(p.created_at));
      const label = p.topic ? `[${p.topic}]` : `[${p.source}]`;
      const score = engagementScore(p);
      const eng = p.likes != null ? ` — ${score} eng (${p.likes}❤️ ${p.recasts}🔁 ${p.replies}💬)` : '';
      return `• ${age} ${label}: "${p.text.slice(0, 100)}${p.text.length > 100 ? '…' : ''}"${eng}`;
    });
    parts.push(`\nYour recent posts (avoid repeating these topics/ideas):\n${lines.join('\n')}`);
  }

  if (top.length) {
    const topLines = top.map((p) => {
      const label = p.topic || p.source;
      const score = engagementScore(p);
      return `• [${label}] (${score} engagement): "${p.text.slice(0, 80)}…"`;
    });
    parts.push(`\nYour best-performing posts recently — lean into these topics and styles:\n${topLines.join('\n')}`);
  }

  return parts.join('\n') + '\n';
}

function formatAge(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
