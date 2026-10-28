import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { safeFetchPublicUrl } from '@/lib/safe-public-fetch';

const SNAP_MIME = 'application/vnd.farcaster.snap+json';

/** Probe a URL for Snap content — returns snap JSON or {isSnap: false}. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

  try {

    // Rate limit: 30 requests/minute per IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`snap:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
    const res = await safeFetchPublicUrl(url, {
      method: 'GET',
      headers: { Accept: SNAP_MIME },
      timeoutMs: 8000,
      maxRedirects: 2,
      maxBytes: 1024 * 1024,
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('vnd.farcaster.snap')) {
      return NextResponse.json({ isSnap: false });
    }

    const snap = await res.json();
    return NextResponse.json({ isSnap: true, snap });
  } catch (e: any) {
    return NextResponse.json({ isSnap: false, error: e.message });
  }
}

/** Forward a signed JFS token to the snap server and return the next snap page. */
export async function POST(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  const { success: rateLimitOk } = rateLimit(`snap-post:${ip}`, 20, 60);
  if (!rateLimitOk) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const body = await request.json().catch(() => null);
  if (!body?.url || !body?.jfsToken) {
    return NextResponse.json({ error: 'url and jfsToken required' }, { status: 400 });
  }

  try {
    if (typeof body.url !== 'string' || typeof body.jfsToken !== 'string' || body.jfsToken.length > 20_000) {
      return NextResponse.json({ error: 'Invalid snap request.' }, { status: 400 });
    }
    const res = await safeFetchPublicUrl(body.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        Accept: SNAP_MIME,
      },
      body: body.jfsToken,
      timeoutMs: 10000,
      maxRedirects: 0,
      maxBytes: 1024 * 1024,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `Snap server returned ${res.status}`, detail },
        { status: res.status }
      );
    }

    const snap = await res.json();
    return NextResponse.json(snap);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
