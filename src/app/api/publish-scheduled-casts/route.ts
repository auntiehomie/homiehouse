import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { publishWithStoredKey } from '@/lib/scheduled-cast-publisher';

function scheduledCastAuthorization(req: NextRequest): NextResponse | undefined {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret.length < 32) {
    return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
}

async function handlePublishScheduledCasts(req: NextRequest) {
  try {
    const denied = scheduledCastAuthorization(req);
    if (denied) return denied;

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
          SET status = 'published', published_at = ${nowIso}::timestamptz, cast_hash = ${castHash}, error_message = NULL
          WHERE id = ${cast.id}
        `;

        results.push({ id: cast.id, success: true, cast_hash: castHash });
      } catch (error: any) {
        console.error(`❌ Error publishing cast ${cast.id}:`, error.message);

        await sql`
          UPDATE scheduled_casts
          SET status = 'failed', error_message = ${error.message}
          WHERE id = ${cast.id}
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
    const denied = scheduledCastAuthorization(req);
    if (denied) return denied;

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
      WHERE id = ${id} AND user_fid = ${userFid} AND status = 'pending'
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
        SET status = 'published', published_at = NOW(), cast_hash = ${castHash}, error_message = NULL
        WHERE id = ${id}
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
        WHERE id = ${id}
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
