/**
 * Per-user memory for the @thehomie agent.
 *
 * agent-memory.ts remembers the agent's OWN posts (so it doesn't repeat
 * itself). This file is the other half: a rolling profile of each Farcaster
 * user who has mentioned the bot, so replies can build on past interactions
 * instead of starting from zero every time. This is the "training plan" —
 * the agent gets to know regulars the more they talk to it.
 *
 * Self-initializes the agent_user_memory table on first use.
 */

import { getDb } from '@/lib/db';
import { llmChat } from '@/lib/llm';

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS agent_user_memory (
    fid              INTEGER PRIMARY KEY,
    username         TEXT,
    mention_count    INTEGER      NOT NULL DEFAULT 0,
    profile_summary  TEXT,
    first_seen       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_seen        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );
`;

async function ensureTable(): Promise<void> {
  const db = getDb();
  await db.query(CREATE_TABLE_SQL);
}

export interface AgentUserMemory {
  fid: number;
  username: string | null;
  mention_count: number;
  profile_summary: string | null;
  first_seen: string;
  last_seen: string;
  updated_at: string;
}

/**
 * Fetch what the agent remembers about this user, if anything.
 * Returns null (not throws) if the DB is unavailable or the user is new.
 */
export async function getUserMemory(fid: number): Promise<AgentUserMemory | null> {
  try {
    await ensureTable();
    const db = getDb();
    const { rows } = await db.query<AgentUserMemory>(
      `SELECT * FROM agent_user_memory WHERE fid = $1`,
      [fid]
    );
    return rows[0] ?? null;
  } catch (err) {
    console.warn('[agent-user-memory] getUserMemory failed:', (err as Error).message);
    return null;
  }
}

/**
 * Record that this user just mentioned the bot — bumps mention_count and
 * last_seen, inserting a fresh row on first contact. Fails silently so a DB
 * hiccup never blocks the reply path.
 */
export async function recordMention(fid: number, username?: string): Promise<void> {
  try {
    await ensureTable();
    const db = getDb();
    await db.query(
      `INSERT INTO agent_user_memory (fid, username, mention_count, first_seen, last_seen, updated_at)
       VALUES ($1, $2, 1, NOW(), NOW(), NOW())
       ON CONFLICT (fid) DO UPDATE SET
         username = COALESCE($2, agent_user_memory.username),
         mention_count = agent_user_memory.mention_count + 1,
         last_seen = NOW(),
         updated_at = NOW()`,
      [fid, username ?? null]
    );
  } catch (err) {
    console.warn('[agent-user-memory] recordMention failed:', (err as Error).message);
  }
}

/**
 * Build a short prompt-injection string describing what the agent remembers
 * about this specific person. Returns '' if there's nothing to say yet
 * (new user, or DB unavailable) so callers can always safely append it.
 */
export async function buildUserMemoryContext(fid: number): Promise<string> {
  const memory = await getUserMemory(fid);
  if (!memory?.profile_summary) return '';

  const times = memory.mention_count === 1 ? 'once before' : `${memory.mention_count} times before`;
  return `\nWhat you remember about @${memory.username || 'this person'} (talked to them ${times}): ${memory.profile_summary}`;
}

const LEARN_SYSTEM = `You maintain a short rolling memory of ONE specific person on Farcaster that an agent talks to.

Given that person's previous profile summary (if any) and their latest message plus the agent's reply, write an UPDATED summary — 2-3 sentences max. Capture what they're interested in, what they tend to ask about, and anything notable about how they talk (tone, expertise level, recurring topics). Merge in the new information; don't just append. Drop anything no longer relevant.

Respond with ONLY the updated summary text. No preamble, no quotes, no labels.`;

/**
 * The actual "learning" step: after a reply goes out, fold the new
 * interaction into the user's rolling profile summary via a cheap LLM call.
 * Best-effort — never throws, never blocks the reply path (call this after
 * the reply has already been published).
 */
export async function learnFromInteraction(params: {
  fid: number;
  username?: string;
  userMessage: string;
  agentReply: string;
}): Promise<void> {
  try {
    const existing = await getUserMemory(params.fid);
    const previous = existing?.profile_summary || '(none yet — this is the first interaction)';

    const { message } = await llmChat({
      messages: [
        { role: 'system', content: LEARN_SYSTEM },
        {
          role: 'user',
          content: `Previous summary: ${previous}\n\nTheir latest message: "${params.userMessage.slice(0, 400)}"\nAgent's reply: "${params.agentReply.slice(0, 300)}"\n\nWrite the updated summary.`,
        },
      ],
      maxTokens: 120,
      temperature: 0.3,
    });

    const summary = (message.content || '').trim().slice(0, 600);
    if (!summary) return;

    await ensureTable();
    const db = getDb();
    await db.query(
      `UPDATE agent_user_memory SET profile_summary = $1, updated_at = NOW() WHERE fid = $2`,
      [summary, params.fid]
    );
  } catch (err) {
    console.warn('[agent-user-memory] learnFromInteraction failed:', (err as Error).message);
  }
}
