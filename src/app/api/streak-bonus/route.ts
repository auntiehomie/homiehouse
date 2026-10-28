import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';
import { getStreak } from '@/lib/learning-streak';

/**
 * Streak bonus HH2 rewards.
 *
 * Users earn bonus HH2 for hitting daily learning streak milestones.
 * Milestones: 7 days (+200), 14 days (+500), 30 days (+1000), 60 days (+2000), 90 days (+5000).
 * Each milestone can only be claimed once per user.
 */

const MILESTONES: Record<number, number> = {
  7: 200,
  14: 500,
  30: 1000,
  60: 2000,
  90: 5000,
};

async function ensureTables(db: ReturnType<typeof getDb>) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS hh2_streak_bonuses (
      fid INTEGER NOT NULL,
      milestone INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (fid, milestone)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS hh2_reward_events (
      fid INTEGER NOT NULL, module_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'earned' CHECK (status IN ('earned', 'pending', 'claimed')),
      wallet_address TEXT, claim_tx_hash TEXT,
      earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), claimed_at TIMESTAMPTZ,
      PRIMARY KEY (fid, module_id)
    )
  `);
}

/**
 * Get the user's streak bonus status — which milestones are available.
 */
export async function GET(req: NextRequest) {
  try {
    const authFid = await verifyFarcasterSignerAuth(req);
    const fid = Number(new URL(req.url).searchParams.get('fid'));
    if (!Number.isSafeInteger(fid) || fid <= 0) {
      return NextResponse.json({ ok: false, error: 'Valid FID required' }, { status: 400 });
    }
    if (authFid !== fid) {
      return NextResponse.json({ ok: false, error: 'FID does not match authenticated user' }, { status: 403 });
    }

    const db = getDb();
    await ensureTables(db);
    const streak = await getStreak(fid);
    const claimed = await db.query(
      'SELECT milestone, amount FROM hh2_streak_bonuses WHERE fid = $1 ORDER BY milestone ASC',
      [fid]
    );
    const claimedMilestones = new Set(claimed.rows.map((r: { milestone: number }) => r.milestone));

    const available: { milestone: number; bonus: number }[] = [];
    const upcoming: { milestone: number; bonus: number; daysRemaining: number }[] = [];

    for (const [milestone, bonus] of Object.entries(MILESTONES)) {
      const m = Number(milestone);
      if (claimedMilestones.has(m)) continue;
      if (streak.currentStreak >= m) {
        available.push({ milestone: m, bonus });
      } else {
        upcoming.push({ milestone: m, bonus, daysRemaining: m - streak.currentStreak });
      }
    }

    const totalClaimed = claimed.rows.reduce((sum: number, r: { amount: number }) => sum + r.amount, 0);

    return NextResponse.json({
      ok: true,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      available,
      upcoming,
      totalClaimed,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error('[streak-bonus] GET error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch streak bonus status' }, { status: 500 });
  }
}

/**
 * Claim a streak bonus for a milestone the user has reached.
 * Body: { fid, milestone }
 */
export async function POST(req: NextRequest) {
  try {
    const authFid = await verifyFarcasterSignerAuth(req);
    const body = await req.json();
    const fid = Number(body.fid);
    const milestone = Number(body.milestone);

    if (!Number.isSafeInteger(fid) || fid <= 0) {
      return NextResponse.json({ ok: false, error: 'Valid FID required' }, { status: 400 });
    }
    if (authFid !== fid) {
      return NextResponse.json({ ok: false, error: 'FID does not match authenticated user' }, { status: 403 });
    }
    if (!MILESTONES[milestone]) {
      return NextResponse.json({ ok: false, error: 'Invalid milestone' }, { status: 400 });
    }

    const db = getDb();
    await ensureTables(db);
    const streak = await getStreak(fid);

    if (streak.currentStreak < milestone) {
      return NextResponse.json({
        ok: false,
        error: `You need a ${milestone}-day streak. You're at ${streak.currentStreak}.`,
      }, { status: 400 });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [fid]);

      const existing = await client.query(
        'SELECT 1 FROM hh2_streak_bonuses WHERE fid = $1 AND milestone = $2 FOR UPDATE',
        [fid, milestone]
      );
      if (existing.rows.length > 0) {
        await client.query('COMMIT');
        return NextResponse.json({ ok: false, error: 'Bonus already claimed for this milestone.' }, { status: 409 });
      }

      const bonus = MILESTONES[milestone];
      // Record the streak bonus as a reward event with a synthetic module_id
      const moduleId = `streak-bonus-${milestone}`;
      await client.query(
        `INSERT INTO hh2_reward_events (fid, module_id, amount, status)
         VALUES ($1, $2, $3, 'earned')
         ON CONFLICT (fid, module_id) DO NOTHING`,
        [fid, moduleId, bonus]
      );
      await client.query(
        'INSERT INTO hh2_streak_bonuses (fid, milestone, amount) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [fid, milestone, bonus]
      );
      await client.query('COMMIT');

      return NextResponse.json({ ok: true, milestone, bonus, newStreak: streak.currentStreak });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error('[streak-bonus] POST error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to claim streak bonus' }, { status: 500 });
  }
}
