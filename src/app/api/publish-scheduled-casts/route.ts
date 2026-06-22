import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { buildSignedMessage, hexToBytes, MessageType } from '@/lib/fc-message-builder';
import type { CastEmbed } from '@/lib/fc-message-builder';
import { ed25519 } from '@noble/curves/ed25519';

const HYPERSNAP_BASE =
  process.env.NEXT_PUBLIC_HYPERSNAP_URL || 'https://haatz.quilibrium.com';

async function publishWithStoredKey(cast: any): Promise<string> {
  const privateKeyHex = cast.signer_uuid && cast.signer_uuid !== 'app-managed' ? cast.signer_uuid : null;
  if (!privateKeyHex) {
    throw new Error('No signer key stored. Re-schedule this cast after approving posting permissions.');
  }

  const privateKeyBytes = hexToBytes(privateKeyHex);
  const publicKeyBytes = ed25519.getPublicKey(privateKeyBytes);
  const signer = {
    publicKey: publicKeyBytes,
    sign: async (hash: Uint8Array) => ed25519.sign(hash, privateKeyBytes),
  };

  const rawEmbeds: Array<{ url: string }> = Array.isArray(cast.embeds)
    ? cast.embeds
    : JSON.parse(cast.embeds || '[]');
  const castEmbeds: CastEmbed[] = rawEmbeds.map((e: { url: string }) => ({ url: e.url }));
  const parentUrl = cast.channel_id
    ? `https://warpcast.com/~/channel/${cast.channel_id}`
    : undefined;

  const message = await buildSignedMessage(
    {
      type: MessageType.CAST_ADD,
      fid: cast.user_fid,
      body: {
        castAddBody: {
          text: cast.text,
          embeds: castEmbeds.length ? castEmbeds : undefined,
          parent: parentUrl ? { url: parentUrl } : undefined,
        },
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
    throw new Error(errData.message || errData.errMsg || errData.error || `Hub error ${hubRes.status}`);
  }

  const result = await hubRes.json();
  return result.hash ?? result.cast?.hash ?? result.data?.hash ?? '';
}

async function handlePublishScheduledCasts(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = req.headers.get('x-vercel-cron') === '1';

    if (cronSecret && cronSecret.length >= 32) {
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
      if (authHeader !== `Bearer ${cronSecret}` && !isVercelCron) {
        console.warn('❌ Unauthorized cron request from:', ip);
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
      }
    } else if (!isVercelCron) {
      console.warn('⚠️ CRON_SECRET not set; add it to Vercel env vars');
    }

    console.log('✅ Cron job running');

    const now = new Date();
    const nowIso = now.toISOString();
    console.log('⏰ Current time:', nowIso);

    // Atomically claim rows by flipping status to 'processing' before publishing.
    // This prevents duplicate publishes if two cron invocations overlap.
    const scheduledCasts = await sql`
      UPDATE scheduled_casts
      SET status = 'processing'
      WHERE status = 'pending' AND scheduled_time <= ${nowIso}::timestamptz
      RETURNING *
    `;

    console.log(`📋 Claimed ${scheduledCasts.length} casts to publish`);

    const results = [];

    for (const cast of scheduledCasts) {
      try {
        console.log(`📤 Publishing cast ${cast.id} for user ${cast.user_fid}...`);

        const castHash = await publishWithStoredKey(cast);

        console.log(`✅ Published! Hash: ${castHash}`);

        await sql`
          UPDATE scheduled_casts
          SET status = 'published', published_at = ${nowIso}::timestamptz, cast_hash = ${castHash || null}
          WHERE id = ${cast.id}::uuid
        `;

        results.push({ id: cast.id, success: true, cast_hash: castHash });
      } catch (error: any) {
        console.error(`❌ Error publishing cast ${cast.id}:`, error.message);

        await sql`
          UPDATE scheduled_casts
          SET status = 'failed', error_message = ${error.message}
          WHERE id = ${cast.id}::uuid
        `;

        results.push({ id: cast.id, success: false, error: error.message });
      }
    }

    console.log(`✅ Cron complete. Processed ${results.length} casts.`);
    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (error: any) {
    console.error('Error in publish-scheduled-casts:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Unknown error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handlePublishScheduledCasts(req);
}

export async function POST(req: NextRequest) {
  return handlePublishScheduledCasts(req);
}

export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || cronSecret.length < 32) {
      return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 503 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, fid } = body;

    if (!id || !fid) {
      return NextResponse.json({ ok: false, error: 'Missing id or fid' }, { status: 400 });
    }

    const userFid = Number(fid);
    if (!userFid || isNaN(userFid)) {
      return NextResponse.json({ ok: false, error: 'Invalid fid' }, { status: 400 });
    }

    const rows = await sql`
      SELECT * FROM scheduled_casts
      WHERE id = ${id}::uuid AND user_fid = ${userFid} AND status = 'pending'
    `;

    if (!rows.length) {
      return NextResponse.json(
        { ok: false, error: 'Scheduled cast not found or not pending' },
        { status: 404 }
      );
    }

    const cast = rows[0];
    try {
      const castHash = await publishWithStoredKey(cast);

      await sql`
        UPDATE scheduled_casts
        SET status = 'published', published_at = NOW(), cast_hash = ${castHash || null}
        WHERE id = ${id}::uuid
      `;

      return NextResponse.json({
        ok: true,
        cast_hash: castHash,
        message: 'Cast published successfully',
      });
    } catch (error: any) {
      await sql`
        UPDATE scheduled_casts
        SET status = 'failed', error_message = ${error.message}
        WHERE id = ${id}::uuid
      `;
      return NextResponse.json(
        { ok: false, error: `Failed to publish cast: ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in publish-scheduled-casts PUT:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
