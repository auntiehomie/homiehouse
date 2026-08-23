import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { rateLimit } from '@/lib/ratelimit';
import { verifyFarcasterSignerAuth, verifyFarcasterSigner } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const { success: rateLimitOk } = rateLimit(`schedule-cast:${ip}`, 10, 3600);

    if (!rateLimitOk) {
      return NextResponse.json(
        { ok: false, error: 'Rate limited. Try again later.' },
        { status: 429 }
      );
    }

    // Verify auth via signer key headers
    const authFid = await verifyFarcasterSignerAuth(req);

    const body = await req.json();
    const { text, fid, embeds = [], scheduled_time, channelKey } = body;

    if (!text || !fid || !scheduled_time) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: text, fid, scheduled_time' },
        { status: 400 }
      );
    }

    const userFid = Number(fid);
    if (!userFid || isNaN(userFid)) {
      return NextResponse.json({ ok: false, error: 'Invalid fid' }, { status: 400 });
    }

    // Verify the authenticated FID matches
    if (authFid !== userFid) {
      return NextResponse.json(
        { ok: false, error: 'FID does not match authenticated user' },
        { status: 403 }
      );
    }

    const scheduledDate = new Date(scheduled_time);
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { ok: false, error: 'Scheduled time must be in the future' },
        { status: 400 }
      );
    }

    const channelId = channelKey || null;
    const embedsJson = JSON.stringify(Array.isArray(embeds) ? embeds : []);
    const scheduledAt = scheduledDate.toISOString();

    const rows = await sql`
      INSERT INTO scheduled_casts
        (user_fid, signer_uuid, text, embeds, channel_id, scheduled_time, status)
      VALUES (${userFid}, 'app-managed', ${text}, ${embedsJson}::jsonb, ${channelId}, ${scheduledAt}::timestamptz, 'pending')
      RETURNING *
    `;

    return NextResponse.json({
      ok: true,
      scheduled_cast: rows[0],
      message: `Cast scheduled for ${scheduledDate.toLocaleString()}`,
    });
  } catch (error: any) {
    console.error('Error in schedule-cast POST:', error?.message ?? error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to schedule cast' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Verify auth via signer key headers
    const authFid = await verifyFarcasterSignerAuth(req);

    const { searchParams } = new URL(req.url);
    const fidParam = searchParams.get('fid');

    if (!fidParam) {
      return NextResponse.json(
        { ok: false, error: 'fid is required' },
        { status: 400 }
      );
    }

    const userFid = Number(fidParam);
    if (!userFid || isNaN(userFid)) {
      return NextResponse.json({ ok: false, error: 'Invalid fid' }, { status: 400 });
    }

    // Verify the authenticated FID matches
    if (authFid !== userFid) {
      return NextResponse.json(
        { ok: false, error: 'FID does not match authenticated user' },
        { status: 403 }
      );
    }

    const rows = await sql`
      SELECT * FROM scheduled_casts
      WHERE user_fid = ${userFid} AND status IN ('pending', 'processing', 'failed')
      ORDER BY scheduled_time ASC
    `;

    return NextResponse.json({ ok: true, scheduled_casts: rows });
  } catch (error: any) {
    console.error('Error in schedule-cast GET:', error?.message ?? error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to fetch scheduled casts' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // Verify auth via signer key headers
    const authFid = await verifyFarcasterSignerAuth(req);

    const body = await req.json();
    const { id, fid, cast_hash } = body;

    if (!id || !fid) {
      return NextResponse.json({ ok: false, error: 'Missing id or fid' }, { status: 400 });
    }

    const userFid = Number(fid);
    if (!userFid || isNaN(userFid)) {
      return NextResponse.json({ ok: false, error: 'Invalid fid' }, { status: 400 });
    }

    // Verify the authenticated FID matches
    if (authFid !== userFid) {
      return NextResponse.json(
        { ok: false, error: 'FID does not match authenticated user' },
        { status: 403 }
      );
    }

    const castHash = cast_hash || null;
    const rows = await sql`
      UPDATE scheduled_casts
      SET status = 'published', published_at = NOW(), cast_hash = ${castHash}
      WHERE id = ${id}::uuid AND user_fid = ${userFid} AND status IN ('pending', 'failed')
      RETURNING *
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Scheduled cast not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, cast_hash });
  } catch (error: any) {
    console.error('Error in schedule-cast PATCH:', error?.message ?? error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to mark as published' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Verify auth via signer key headers
    const authFid = await verifyFarcasterSignerAuth(req);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const fidParam = searchParams.get('fid');

    if (!fidParam) {
      return NextResponse.json({ ok: false, error: 'Missing fid parameter' }, { status: 400 });
    }

    const userFid = Number(fidParam);
    if (!userFid || isNaN(userFid)) {
      return NextResponse.json({ ok: false, error: 'Invalid fid' }, { status: 400 });
    }

    // Verify the authenticated FID matches
    if (authFid !== userFid) {
      return NextResponse.json(
        { ok: false, error: 'FID does not match authenticated user' },
        { status: 403 }
      );
    }

    const cancelAll = searchParams.get('cancelAll') === 'true';
    if (cancelAll) {
      const cancelled = await sql`
        UPDATE scheduled_casts
        SET status = 'cancelled'
        WHERE user_fid = ${userFid}
          AND status IN ('pending', 'processing', 'failed')
          AND scheduled_time <= NOW()
        RETURNING id
      `;
      return NextResponse.json({ ok: true, cancelled: cancelled.length });
    }

    if (!id) {
      return NextResponse.json({ ok: false, error: 'Missing id parameter' }, { status: 400 });
    }

    const rows = await sql`
      UPDATE scheduled_casts
      SET status = 'cancelled'
      WHERE id = ${id} AND user_fid = ${userFid}
        AND status IN ('pending', 'processing', 'failed')
      RETURNING *
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Cast not found, already published, or already cancelled' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, message: 'Scheduled cast cancelled' });
  } catch (error: any) {
    console.error('Error in schedule-cast DELETE:', error?.message ?? error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to cancel scheduled cast' },
      { status: 500 }
    );
  }
}