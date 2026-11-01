import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';

const DEFAULT_HYPERSNAP_URL = 'https://haatz.quilibrium.com';
const HYPERSNAP_WRITE_BASE =
  process.env.MY_HYPERSNAP_NODE_URL?.trim() ||
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
const MAX_SIGNED_MESSAGE_BYTES = 64 * 1024;

function readVarint(bytes: Uint8Array, start: number): { value: bigint; next: number } {
  let value = 0n;
  let shift = 0n;
  for (let offset = start; offset < bytes.length && offset < start + 10; offset += 1) {
    const byte = bytes[offset];
    value |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value, next: offset + 1 };
    shift += 7n;
  }
  throw new Error('Malformed protobuf varint');
}

function findField(bytes: Uint8Array, target: number): { wire: number; value: bigint | Uint8Array } | null {
  let offset = 0;
  while (offset < bytes.length) {
    const tag = readVarint(bytes, offset);
    offset = tag.next;
    const field = Number(tag.value >> 3n);
    const wire = Number(tag.value & 7n);
    if (wire === 0) {
      const parsed = readVarint(bytes, offset);
      offset = parsed.next;
      if (field === target) return { wire, value: parsed.value };
    } else if (wire === 2) {
      const length = readVarint(bytes, offset);
      offset = length.next;
      const end = offset + Number(length.value);
      if (!Number.isSafeInteger(end) || end > bytes.length) throw new Error('Malformed protobuf field');
      const value = bytes.slice(offset, end);
      offset = end;
      if (field === target) return { wire, value };
    } else if (wire === 1) {
      offset += 8;
    } else if (wire === 5) {
      offset += 4;
    } else {
      throw new Error('Unsupported protobuf wire type');
    }
    if (offset > bytes.length) throw new Error('Malformed protobuf field');
  }
  return null;
}

/** Read the author FID from a Farcaster Message envelope without trusting JSON metadata. */
export function readSignedMessageFid(message: Uint8Array): number {
  // Hypersnap's Message envelope carries encoded MessageData in field 7.
  const dataField = findField(message, 7);
  if (!dataField || dataField.wire !== 2 || !(dataField.value instanceof Uint8Array)) {
    throw new Error('Signed message data is missing');
  }
  const fidField = findField(dataField.value, 2);
  if (!fidField || fidField.wire !== 0 || typeof fidField.value !== 'bigint') {
    throw new Error('Signed message FID is missing');
  }
  const fid = Number(fidField.value);
  if (!Number.isSafeInteger(fid) || fid <= 0) throw new Error('Signed message FID is invalid');
  return fid;
}

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
 * MY_HYPERSNAP_NODE_URL is the preferred setting. SNAPCHAIN_NODE_URL remains
 * accepted as a legacy alias for existing deployments.
 * Reads keep their separate NEXT_PUBLIC_HYPERSNAP_URL setting.
 */
export async function POST(request: NextRequest) {
  try {
    const authenticatedFid = await verifyFarcasterSignerAuth(request, 'write:casts');

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
    if (messageBytes.byteLength > MAX_SIGNED_MESSAGE_BYTES) {
      return NextResponse.json({ ok: false, error: 'Signed message is too large' }, { status: 413 });
    }
    let messageFid: number;
    try {
      messageFid = readSignedMessageFid(new Uint8Array(messageBytes));
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid signed message' }, { status: 400 });
    }
    if (messageFid !== authenticatedFid) {
      return NextResponse.json({ ok: false, error: 'Signed message FID does not match session' }, { status: 403 });
    }

    const hubRes = await submitMessage(messageBytes);

    const rawText = await hubRes.text();
    let data: any = {};
    try { data = JSON.parse(rawText); } catch { /* non-JSON body */ }

    // Some compatible nodes return a 2xx HTTP status with an application-level
    // rejection. Do not report that as a successful signed follow/reaction/cast.
    if (data?.ok === false || data?.success === false) {
      const errMsg = data?.message || data?.errMsg || data?.error || data?.error_detail || 'Hypersnap rejected the message';
      return NextResponse.json(
        { ok: false, error: errMsg, details: data?.error_detail || data?.errorDetail || undefined, hub: data },
        { status: 502 }
      );
    }

    if (!hubRes.ok) {
      const errMsg = data?.message || data?.errMsg || data?.error || rawText.slice(0, 300) || `Hub error ${hubRes.status}`;
      console.error(`[submit-cast] hub ${hubRes.status}: ${errMsg}`, JSON.stringify(data));
      return NextResponse.json(
        { ok: false, error: errMsg, details: data?.error_detail || data?.errorDetail || undefined, hub: data },
        { status: hubRes.status }
      );
    }

    return NextResponse.json({ ...data, ok: true });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error('[submit-cast] proxy error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to submit message to hub' },
      { status: 500 }
    );
  }
}
