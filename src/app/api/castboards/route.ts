import { NextRequest, NextResponse } from 'next/server';
import { getCastboard, loadCastboard } from '@/lib/castboards';
import { fetchChannelFeed } from '@/lib/hypersnap';
import { enforceRateLimit, rateLimitKeyFromRequest } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    await enforceRateLimit({ key: rateLimitKeyFromRequest(req), limit: 30, windowSeconds: 60, label: 'castboards', allowInMemoryPreview: true });
    const board = getCastboard(req.nextUrl.searchParams.get('board') || '');
    if (!board) return NextResponse.json({ error: 'Castboard not found' }, { status: 404 });
    const result = await loadCastboard(board, fetchChannelFeed);
    const unavailable = result.failedChannels.length === board.channels.length;
    return NextResponse.json({ ...result, ...(unavailable ? { error: 'Channels are unavailable. Please retry.' } : {}) }, {
      status: unavailable ? 503 : 200,
      headers: { 'Cache-Control': result.failedChannels.length ? 'no-store' : 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    return handleApiError(error, 'GET /castboards');
  }
}
