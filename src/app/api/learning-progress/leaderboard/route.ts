import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { enforceRateLimit, rateLimitKeyFromRequest } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';

export const maxDuration = 10;

const MAX_FIDS = 50; // leaderboard is meant to be a small follows-only list, not a global ranking
const HH2_PER_LESSON = 10; // matches learn/page.tsx's HH2_PER_LESSON — kept in sync manually, both are small/stable
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface CompletionRecord {
  completedAt: string;
}

/**
 * GET /api/learning-progress/leaderboard?fids=1,2,3
 *
 * "This week" HH2 points for each given fid — computed from
 * learning_progress.completions timestamps rather than a weekly snapshot/
 * cron job, since each completion record already carries a completedAt.
 * Opt-in on the client (Learn Hub leaderboard toggle, off by default) and
 * scoped to whatever fid list the caller provides (their own follows) —
 * this is not a global ranking endpoint.
 */
export async function GET(req: NextRequest) {
  try {
    await enforceRateLimit({ key: rateLimitKeyFromRequest(req), limit: 30, windowSeconds: 60, label: 'learning-leaderboard' });

    const { searchParams } = new URL(req.url);
    const fidsParam = searchParams.get('fids');
    if (!fidsParam) {
      return NextResponse.json({ error: 'fids required' }, { status: 400 });
    }

    const fids = fidsParam
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, MAX_FIDS);

    if (fids.length === 0) {
      return NextResponse.json({ leaderboard: [] });
    }

    const db = getDb();
    const { rows } = await db.query<{ fid: number; completions: Record<string, CompletionRecord> | null }>(
      `SELECT fid, completions FROM learning_progress WHERE fid = ANY($1::int[])`,
      [fids]
    );

    const cutoff = Date.now() - WEEK_MS;
    const leaderboard = rows
      .map((row) => {
        const completions = row.completions ?? {};
        const weeklyCompletions = Object.values(completions).filter((c) => {
          const t = Date.parse(c?.completedAt);
          return !isNaN(t) && t >= cutoff;
        }).length;
        return { fid: row.fid, weeklyPoints: weeklyCompletions * HH2_PER_LESSON };
      })
      .filter((entry) => entry.weeklyPoints > 0)
      .sort((a, b) => b.weeklyPoints - a.weeklyPoints);

    return NextResponse.json({ leaderboard });
  } catch (error: any) {
    return handleApiError(error, 'GET /learning-progress/leaderboard');
  }
}
