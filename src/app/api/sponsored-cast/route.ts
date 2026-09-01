import { NextRequest, NextResponse } from 'next/server';
import { createApiLogger } from '@/lib/logger';
import { enforceRateLimit, rateLimitKeyFromRequest } from '@/lib/ratelimit';
import { fetchSponsoredCast, recordSponsoredCastClick } from '@/lib/sponsored';

const logger = createApiLogger('/sponsored-cast');

// GET /api/sponsored-cast — return a single sponsored cast for the trending feed
// Picks the sponsored cast with the most remaining budget that hasn't been shown recently.
export async function GET(req: NextRequest) {
  try {
    await enforceRateLimit({ key: rateLimitKeyFromRequest(req), limit: 60, windowSeconds: 60, label: 'sponsored-cast' });

    const { searchParams } = new URL(req.url);
    const excludeHash = searchParams.get('exclude') || undefined;

    const sponsored = await fetchSponsoredCast(excludeHash);

    return NextResponse.json({ ok: true, sponsored });
  } catch (err: any) {
    logger.error('GET error', err?.message);
    return NextResponse.json({ ok: false, error: 'Failed to fetch sponsored cast' }, { status: 500 });
  }
}

// POST /api/sponsored-cast — record a click on a sponsored cast
export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
    }

    await recordSponsoredCastClick(id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    logger.error('POST error', err?.message);
    return NextResponse.json({ ok: false, error: 'Failed to record click' }, { status: 500 });
  }
}