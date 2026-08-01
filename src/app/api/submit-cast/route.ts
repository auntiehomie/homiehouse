import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';

const HYPERSNAP_BASE =
  process.env.NEXT_PUBLIC_HYPERSNAP_URL || 'https://haatz.quilibrium.com';

/**
 * Server-side proxy for Farcaster hub submitMessage.
 * The client builds and signs the protobuf message using Privy's embedded
 * Farcaster signer (Quorum approach), then POSTs the raw bytes here.
 * We forward them to Hypersnap server-side to avoid CORS restrictions.
 */
export async function POST(request: NextRequest) {
  try {

    // Rate limit: 30 requests/minute per IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`submit-cast:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
    const messageBytes = await request.arrayBuffer();

    if (!messageBytes.byteLength) {
      return NextResponse.json({ ok: false, error: 'Empty message body' }, { status: 400 });
    }

    const hubRes = await fetch(`${HYPERSNAP_BASE}/v1/submitMessage`, {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        accept: 'application/json',
      },
      body: messageBytes,
    });

    const rawText = await hubRes.text();
    let data: any = {};
    try { data = JSON.parse(rawText); } catch { /* non-JSON body */ }

    if (!hubRes.ok) {
      const errMsg = data?.message || data?.errMsg || data?.error || rawText.slice(0, 300) || `Hub error ${hubRes.status}`;
      console.error(`[submit-cast] hub ${hubRes.status}: ${errMsg}`, JSON.stringify(data));
      return NextResponse.json(
        { ok: false, error: errMsg, hub: data },
        { status: hubRes.status }
      );
    }

    return NextResponse.json({ ok: true, ...data });
  } catch (error: any) {
    console.error('[submit-cast] proxy error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to submit message to hub' },
      { status: 500 }
    );
  }
}
