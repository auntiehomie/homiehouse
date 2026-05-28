import { NextRequest, NextResponse } from 'next/server';

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

    const data = await hubRes.json().catch(() => ({}));

    if (!hubRes.ok) {
      return NextResponse.json(
        { ok: false, error: data?.message || data?.errMsg || `Hub error ${hubRes.status}`, hub: data },
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
