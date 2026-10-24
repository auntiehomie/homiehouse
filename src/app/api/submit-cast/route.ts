import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';

const DEFAULT_HYPERSNAP_URL = 'https://haatz.quilibrium.com';
const HYPERSNAP_WRITE_BASE =
  process.env.HYPERSNAP_NODE_URL?.trim() ||
  process.env.SNAPCHAIN_NODE_URL?.trim() ||
  process.env.NEXT_PUBLIC_HYPERSNAP_URL ||
  DEFAULT_HYPERSNAP_URL;
const HYPERSNAP_WRITE_FALLBACK =
  process.env.HYPERSNAP_FALLBACK_URL?.trim() ||
  process.env.SNAPCHAIN_FALLBACK_URL?.trim() ||
  DEFAULT_HYPERSNAP_URL;
const HYPERSNAP_WRITE_TARGETS = [...new Set([HYPERSNAP_WRITE_BASE, HYPERSNAP_WRITE_FALLBACK]
  .map((url) => url.replace(/\/+$/, ''))
  .filter(Boolean))];

async function submitMessage(messageBytes: ArrayBuffer): Promise<Response> {
  let lastError: unknown;

  for (const [index, baseUrl] of HYPERSNAP_WRITE_TARGETS.entries()) {
    try {
      const response = await fetch(`${baseUrl}/v1/submitMessage`, {
        method: 'POST',
        headers: {
          'content-type': 'application/octet-stream',
          accept: 'application/json',
        },
        body: messageBytes.slice(0),
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok || response.status < 500 || index === HYPERSNAP_WRITE_TARGETS.length - 1) {
        return response;
      }

      console.warn(`[submit-cast] primary Hypersnap node returned ${response.status}; trying fallback`);
    } catch (error) {
      lastError = error;
      if (index === HYPERSNAP_WRITE_TARGETS.length - 1) throw error;
      console.warn('[submit-cast] primary Hypersnap node unavailable; trying fallback:', error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No Hypersnap write target is configured');
}

/**
 * Server-side proxy for signed-message submission to a Hypersnap node.
 * The client builds and signs the protobuf message using the app-managed
 * Ed25519 signer key, then POSTs the raw bytes here.
 * Hypersnap exposes the Snapchain-compatible /v1/submitMessage API. We forward
 * server-side to the configured personal Hypersnap node, with Haatz as fallback.
 * Reads keep their separate NEXT_PUBLIC_HYPERSNAP_URL setting.
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

    const hubRes = await submitMessage(messageBytes);

    const rawText = await hubRes.text();
    let data: any = {};
    try { data = JSON.parse(rawText); } catch { /* non-JSON body */ }

    if (!hubRes.ok) {
      const errMsg = data?.message || data?.errMsg || data?.error || rawText.slice(0, 300) || `Hub error ${hubRes.status}`;
      console.error(`[submit-cast] hub ${hubRes.status}: ${errMsg}`, JSON.stringify(data));
      return NextResponse.json(
        { ok: false, error: errMsg, details: data?.error_detail || data?.errorDetail || undefined, hub: data },
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
