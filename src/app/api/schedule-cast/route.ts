import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifySignerAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';

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

    const body = await req.json();
    const { text, signerUuid, embeds = [], scheduled_time, channelKey } = body;

    if (!text || !signerUuid || !scheduled_time) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const verifiedFid = await verifySignerAuth(signerUuid);

    const scheduledDate = new Date(scheduled_time);
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { ok: false, error: 'Scheduled time must be in the future' },
        { status: 400 }
      );
    }

    const db = getDb();
    const { rows } = await db.query(
      `INSERT INTO scheduled_casts
        (user_fid, signer_uuid, text, embeds, channel_id, scheduled_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [
        verifiedFid,
        signerUuid,
        text,
        JSON.stringify(embeds),
        channelKey || null,
        scheduledDate.toISOString(),
      ]
    );

    return NextResponse.json({
      ok: true,
      scheduled_cast: rows[0],
      message: `Cast scheduled for ${scheduledDate.toLocaleString()}`,
    });
  } catch (error: any) {
    console.error('Error in schedule-cast POST:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to schedule cast' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const signerUuid = searchParams.get('signerUuid');

    if (!signerUuid) {
      return NextResponse.json(
        { ok: false, error: 'signerUuid is required for authentication' },
        { status: 401 }
      );
    }

    const verifiedFid = await verifySignerAuth(signerUuid);
    const db = getDb();

    const { rows } = await db.query(
      `SELECT * FROM scheduled_casts
       WHERE user_fid = $1 AND status IN ('pending', 'failed')
       ORDER BY scheduled_time ASC`,
      [verifiedFid]
    );

    return NextResponse.json({ ok: true, scheduled_casts: rows });
  } catch (error: any) {
    console.error('Error in schedule-cast GET:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch scheduled casts' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const signerUuid = searchParams.get('signerUuid');

    if (!id || !signerUuid) {
      return NextResponse.json(
        { ok: false, error: 'Missing id or signerUuid parameter' },
        { status: 400 }
      );
    }

    const verifiedFid = await verifySignerAuth(signerUuid);
    const db = getDb();

    const { rows } = await db.query(
      `UPDATE scheduled_casts
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND user_fid = $2 AND status IN ('pending', 'failed')
       RETURNING *`,
      [parseInt(id), verifiedFid]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Scheduled cast not found or already published' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, message: 'Scheduled cast cancelled' });
  } catch (error: any) {
    console.error('Error in schedule-cast DELETE:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to cancel scheduled cast' },
      { status: 500 }
    );
  }
}
