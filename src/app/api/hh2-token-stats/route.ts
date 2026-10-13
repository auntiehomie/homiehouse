import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { buildTokenStats, type RawTokenStats } from '@/lib/hh2-token-stats';

/**
 * GET /api/hh2-token-stats — public, read-only HH2 aggregates.
 * Returns totals only (no FIDs, wallets, or per-user rows). Missing tables
 * (e.g. before any user has earned HH2) are treated as zero.
 */

async function safeRows<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    // 42P01 = undefined_table: treat as zero so the dashboard still renders.
    if ((err as { code?: string })?.code === '42P01') return fallback;
    throw err;
  }
}

export async function GET() {
  const db = getDb();

  const [earned, claimed, last24h, burns, staked] = await Promise.all([
    safeRows(async () => (await db.query('SELECT COALESCE(SUM(amount), 0) AS total FROM hh2_reward_events')).rows[0], { total: 0 }),
    safeRows(async () => (await db.query("SELECT COALESCE(SUM(amount), 0) AS total FROM hh2_reward_events WHERE status = 'claimed'")).rows[0], { total: 0 }),
    safeRows(async () => (await db.query("SELECT COALESCE(SUM(amount), 0) AS total FROM hh2_reward_events WHERE earned_at >= NOW() - INTERVAL '24 hours'")).rows[0], { total: 0 }),
    safeRows(async () => (await db.query('SELECT reason, COALESCE(SUM(amount), 0) AS total FROM hh2_burns GROUP BY reason')).rows, []),
    safeRows(async () => (await db.query("SELECT COALESCE(SUM(amount), 0) AS total FROM hh2_stakes WHERE status = 'active' AND tx_hash IS NOT NULL")).rows[0], { total: 0 }),
  ]);

  const raw: RawTokenStats = {
    totalEarned: earned.total,
    totalClaimedToWallet: claimed.total,
    earnedLast24h: last24h.total,
    burnsByReason: burns as RawTokenStats['burnsByReason'],
    stakedOnChain: staked.total,
  };

  return NextResponse.json(buildTokenStats(raw), {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
