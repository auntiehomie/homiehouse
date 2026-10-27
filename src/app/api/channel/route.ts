import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { hypersnapFetch } from '@/lib/hypersnap';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {

    // Rate limit: 30 requests/minute per IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`channel:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
    const data = await hypersnapFetch(`/v2/farcaster/channel?id=${encodeURIComponent(id)}`);
    const channel = data?.channel ?? data;
    return NextResponse.json({ ok: true, channel }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 200 });
  }
}
