import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { publishCast } from '@/lib/farcaster-writes';

async function handlePublishScheduledCasts(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || cronSecret.length < 32) {
      console.error('❌ CRITICAL: CRON_SECRET not configured or too weak');
      return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 503 });
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('❌ Unauthorized cron request from:', ip);
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ Cron job authenticated');

    const db = getDb();
    const now = new Date();
    console.log('⏰ Current time:', now.toISOString());

    const { rows: scheduledCasts } = await db.query(
      `SELECT * FROM scheduled_casts
       WHERE status = 'pending' AND scheduled_time <= $1
       ORDER BY scheduled_time ASC`,
      [now.toISOString()]
    );

    console.log(`📋 Found ${scheduledCasts.length} casts to publish`);

    const results = [];

    for (const cast of scheduledCasts) {
      try {
        console.log(`📤 Publishing cast ${cast.id} for user ${cast.user_fid}...`);

        const embeds = Array.isArray(cast.embeds) ? cast.embeds : JSON.parse(cast.embeds || '[]');

        // Use app-managed signer via farcaster-writes
        const publishResult = await publishCast({
          text: cast.text,
          fid: cast.user_fid,
          embeds: embeds.length ? embeds : undefined,
          channelKey: cast.channel_id || undefined,
        });

        console.log(`✅ Published! Hash: ${publishResult.castHash}`);

        await db.query(
          `UPDATE scheduled_casts
           SET status = 'published', published_at = $1, cast_hash = $2, updated_at = NOW()
           WHERE id = $3`,
          [now.toISOString(), publishResult.castHash || null, cast.id]
        );

        results.push({ id: cast.id, success: true, cast_hash: publishResult.castHash });
      } catch (error: any) {
        console.error(`❌ Error publishing cast ${cast.id}:`, error.message);

        await db.query(
          `UPDATE scheduled_casts
           SET status = 'failed', error_message = $1, updated_at = NOW()
           WHERE id = $2`,
          [error.message, cast.id]
        );

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

    const db = getDb();
    const { rows } = await db.query(
      `SELECT * FROM scheduled_casts
       WHERE id = $1 AND user_fid = $2 AND status = 'pending'`,
      [id, userFid]
    );

    if (!rows.length) {
      return NextResponse.json(
        { ok: false, error: 'Scheduled cast not found or not pending' },
        { status: 404 }
      );
    }

    const cast = rows[0];
    try {
      const embeds = Array.isArray(cast.embeds) ? cast.embeds : JSON.parse(cast.embeds || '[]');
      const publishResult = await publishCast({
        text: cast.text,
        fid: cast.user_fid,
        embeds: embeds.length ? embeds : undefined,
        channelKey: cast.channel_id || undefined,
      });

      await db.query(
        `UPDATE scheduled_casts
         SET status = 'published', published_at = NOW(), cast_hash = $1, updated_at = NOW()
         WHERE id = $2`,
        [publishResult.castHash || null, id]
      );

      return NextResponse.json({
        ok: true,
        cast_hash: publishResult.castHash,
        message: 'Cast published successfully',
      });
    } catch (error: any) {
      await db.query(
        `UPDATE scheduled_casts SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
        [error.message, id]
      );
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
