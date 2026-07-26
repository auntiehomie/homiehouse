import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { enforceRateLimit, rateLimitKeyFromRequest } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';

export const maxDuration = 10;

const MAX_FIDS = 200; // matches /api/friends' fetchFollowing(fid, 100) cap with headroom

/**
 * GET /api/learning-progress/peers?fids=1,2,3&track=learner
 *
 * How many of the given fids (the caller's follows) have a learning_progress
 * row on the given track. Powers the "N people you follow are also on this
 * track" signal on the Learn Hub plan view.
 *
 * Deliberately returns only a count, not which fids matched — this is a
 * lightweight social proof signal, not a way to enumerate who's learning
 * what. No join to fetch usernames; nothing here reveals more than "some of
 * your follows are also doing this."
 */
export async function GET(req: NextRequest) {
  try {
    await enforceRateLimit({ key: rateLimitKeyFromRequest(req), limit: 30, windowSeconds: 60, label: 'learning-progress-peers' });

    const { searchParams } = new URL(req.url);
    const fidsParam = searchParams.get('fids');
    const track = searchParams.get('track');

    if (!fidsParam || !track) {
      return NextResponse.json({ error: 'fids and track are required' }, { status: 400 });
    }

    const fids = fidsParam
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, MAX_FIDS);

    if (fids.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    const db = getDb();
    const { rows } = await db.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM learning_progress
       WHERE fid = ANY($1::int[]) AND plan->>'track' = $2`,
      [fids, track]
    );

    return NextResponse.json({ count: Number(rows[0]?.count ?? 0) });
  } catch (error: any) {
    return handleApiError(error, 'GET /learning-progress/peers');
  }
}
