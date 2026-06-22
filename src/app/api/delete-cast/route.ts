import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { buildSignedMessage, hexToBytes, MessageType } from '@/lib/fc-message-builder';
import { ed25519 } from '@noble/curves/ed25519';

const HYPERSNAP_BASE =
  process.env.NEXT_PUBLIC_HYPERSNAP_URL || 'https://haatz.quilibrium.com';

// POST /api/delete-cast
// Body: { fid: number, cast_hash: string }  — cast_hash is hex (with or without 0x)
export async function POST(req: NextRequest) {
  try {
    const { fid, cast_hash } = await req.json();

    if (!fid || !cast_hash) {
      return NextResponse.json({ error: 'fid and cast_hash required' }, { status: 400 });
    }

    const userFid = Number(fid);
    if (isNaN(userFid)) {
      return NextResponse.json({ error: 'Invalid fid' }, { status: 400 });
    }

    // Look up the user's signer key from any recent scheduled cast
    const rows = await sql`
      SELECT signer_uuid FROM scheduled_casts
      WHERE user_fid = ${userFid}
        AND signer_uuid IS NOT NULL
        AND signer_uuid != 'app-managed'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!rows.length || !rows[0].signer_uuid) {
      return NextResponse.json({ error: 'No signer key found for this user' }, { status: 404 });
    }

    const privateKeyHex = rows[0].signer_uuid;
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
        fid: userFid,
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
  } catch (err: any) {
    console.error('[delete-cast] error:', err?.message);
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
