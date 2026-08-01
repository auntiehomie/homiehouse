import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { searchCasts } from '@/lib/hypersnap';
import { handleApiError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {

    // Rate limit: 30 requests/minute per IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`casts-search:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = Math.min(Number(searchParams.get('limit') || '20'), 50);

    if (!query) {
      return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    }

    const results = await searchCasts(query, limit);
    const casts = results.casts || results.result?.casts || [];

    return NextResponse.json({ casts, query });
  } catch (error: any) {
    return handleApiError(error, 'GET /casts/search');
  }
}
