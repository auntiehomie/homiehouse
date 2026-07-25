/**
 * Hard monthly spend caps for the X integration.
 *
 * X's 2026 pricing is pay-per-use for new developers (~$0.015/post,
 * $0.20/post-with-a-link, $0.005/read) with no free tier — unlike the
 * Farcaster side of this bot, every X API call costs real money. The
 * existing security audit already flagged "uncontrolled AI costs" as a top
 * risk for this app; this module is the enforcement point so the X agent
 * can't be the thing that runs up a surprise bill.
 *
 * Usage: every caller in agent/x-post and agent/x-mention MUST call
 * checkXBudget() and get `allowed: true` BEFORE calling postToX/
 * fetchXMentions, then call recordXUsage() after a successful call.
 * Fails closed: if the DB is unreachable, checkXBudget() denies rather than
 * silently allowing unmetered spend (the opposite of every other
 * fail-open/fail-silent pattern in this codebase, deliberately).
 */

import { getDb } from '@/lib/db';

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS agent_x_usage (
    month        TEXT PRIMARY KEY,
    posts_count  INTEGER NOT NULL DEFAULT 0,
    reads_count  INTEGER NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

async function ensureTable(): Promise<void> {
  const db = getDb();
  await db.query(CREATE_TABLE_SQL);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

/** Conservative defaults — override via env once real usage patterns are known. */
const DEFAULT_MONTHLY_POST_CAP = 300; // ~10/day, well under legacy Basic-tier volume
const DEFAULT_MONTHLY_READ_CAP = 3000; // mention polling + timeline reads

function getPostCap(): number {
  return Number(process.env.X_MONTHLY_POST_CAP) || DEFAULT_MONTHLY_POST_CAP;
}
function getReadCap(): number {
  return Number(process.env.X_MONTHLY_READ_CAP) || DEFAULT_MONTHLY_READ_CAP;
}

export type XUsageKind = 'post' | 'read';

export interface BudgetCheck {
  allowed: boolean;
  used: number;
  cap: number;
  reason?: string;
}

/**
 * Check whether another call of this kind is within this month's budget.
 * Fails CLOSED (allowed: false) on any DB error — see module doc above.
 */
export async function checkXBudget(kind: XUsageKind): Promise<BudgetCheck> {
  const cap = kind === 'post' ? getPostCap() : getReadCap();
  try {
    await ensureTable();
    const db = getDb();
    const month = currentMonth();
    const { rows } = await db.query<{ posts_count: number; reads_count: number }>(
      `SELECT posts_count, reads_count FROM agent_x_usage WHERE month = $1`,
      [month]
    );
    const used = kind === 'post' ? (rows[0]?.posts_count ?? 0) : (rows[0]?.reads_count ?? 0);
    if (used >= cap) {
      return { allowed: false, used, cap, reason: `Monthly X ${kind} cap (${cap}) reached` };
    }
    return { allowed: true, used, cap };
  } catch (err) {
    console.error('[x-budget] checkXBudget failed — denying (fail closed):', (err as Error).message);
    return { allowed: false, used: 0, cap, reason: 'Budget check failed (DB unreachable) — denying by default' };
  }
}

/**
 * Record that a call actually happened. Call this AFTER a successful
 * postToX/fetchXMentions call, not before — an API error shouldn't count
 * against the budget.
 */
export async function recordXUsage(kind: XUsageKind, count = 1): Promise<void> {
  try {
    await ensureTable();
    const db = getDb();
    const month = currentMonth();
    const column = kind === 'post' ? 'posts_count' : 'reads_count';
    await db.query(
      `INSERT INTO agent_x_usage (month, ${column}, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (month) DO UPDATE SET
         ${column} = agent_x_usage.${column} + $2,
         updated_at = NOW()`,
      [month, count]
    );
  } catch (err) {
    console.error('[x-budget] recordXUsage failed:', (err as Error).message);
  }
}
