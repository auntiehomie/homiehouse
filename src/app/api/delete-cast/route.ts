import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';
import { buildSignedMessage, hexToBytes, MessageType } from '@/lib/fc-message-builder';
import { ed25519 } from '@noble/curves/ed25519';

const HYPERSNAP_BASE =
  process.env.NEXT_PUBLIC_HYPERSNAP_URL || 'https://haatz.quilibrium.com';

// POST /api/delete-cast
// Auth: x-farcaster-fid + x-signer-key headers (verified server-side)
// Body: { cast_hash: string }  — cast_hash is hex (with or without 0x)
// Uses the verified signer key to sign and submit the CAST_REMOVE message.
export async function POST(req: NextRequest) {
  try {
    const verifiedFid = await verifyFarcasterSignerAuth(req);
    const signerKey = req.headers.get('x-signer-key');

    // Rate limit: 30 requests/minute per IP
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`delete-cast:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const { cast_hash } = await req.json();

    if (!cast_hash) {
      return NextResponse.json({ error: 'cast_hash required' }, { status: 400 });
    }

    if (!signerKey) {
      return NextResponse.json({ error: 'x-signer-key header required' }, { status: 401 });
    }

    // Use the verified signer key directly for signing the delete message
    const privateKeyHex = signerKey.startsWith('0x') ? signerKey.slice(2) : signerKey;
    try {
      const privateKeyBytes = hexToBytes(privateKeyHex);
      const publicKeyBytes = ed25519.getPublicKey(privateKeyBytes);
      const signer = {
        publicKey: publicKeyBytes,
        sign: async (hash: Uint8Array) => ed25519.sign(hash, privateKeyBytes),
      };

      const targetHash = hexToBytes(cast_hash);

      const message = await buildSignedMessage(
        {
          type: MessageType.CAST_REMOVE,
          fid: verifiedFid,
          body: {
            castRemoveBody: { targetHash },
          },
        },
        signer,
      );

      const hubRes = await fetch(`${HYPERSNAP_BASE}/v1/submitMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream', accept: 'application/json' },
        body: message as unknown as BodyInit,
      });

      if (!hubRes.ok) {
        const errData = await hubRes.json().catch(() => ({}));
        const errMsg = errData.message || errData.errMsg || errData.error || `Hub error ${hubRes.status}`;
        console.error('[delete-cast] hub error:', errMsg);
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } catch (signErr: any) {
      console.error('[delete-cast] sign error:', signErr?.message);
      return NextResponse.json({ error: 'Signer key validation failed' }, { status: 401 });
    }
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[delete-cast] error:', err?.message);
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
