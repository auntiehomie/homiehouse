import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// GET /api/sponsored-cast — return a single sponsored cast for the trending feed
// Picks the sponsored cast with the most remaining budget that hasn't been shown recently.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const excludeHash = searchParams.get('exclude') || '';

    // Fetch an active sponsored cast with remaining budget
    let rows: any[];
    if (excludeHash) {
      rows = await sql`
        SELECT id, sponsor_fid, cast_hash, impression_count, click_count, budget_remaining, created_at
        FROM sponsored_casts
        WHERE budget_remaining > 0
        AND cast_hash != ${excludeHash}
        ORDER BY budget_remaining DESC, created_at DESC
        LIMIT 1
      `;
    } else {
      rows = await sql`
        SELECT id, sponsor_fid, cast_hash, impression_count, click_count, budget_remaining, created_at
        FROM sponsored_casts
        WHERE budget_remaining > 0
        ORDER BY budget_remaining DESC, created_at DESC
        LIMIT 1
      `;
    }

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, sponsored: null });
    }

    const sponsored = rows[0];

    // Increment impression count
    await sql`
      UPDATE sponsored_casts
      SET impression_count = impression_count + 1
      WHERE id = ${sponsored.id}
    `;

    return NextResponse.json({
      ok: true,
      sponsored: {
        id: sponsored.id,
        sponsor_fid: sponsored.sponsor_fid,
        cast_hash: sponsored.cast_hash,
        impressions: sponsored.impression_count + 1,
        clicks: sponsored.click_count,
        budget_remaining: sponsored.budget_remaining,
      },
    });
  } catch (err: any) {
    console.error('[sponsored-cast] GET error:', err?.message);
    return NextResponse.json({ ok: false, error: 'Failed to fetch sponsored cast' }, { status: 500 });
  }
}

// POST /api/sponsored-cast — record a click on a sponsored cast
export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
    }

    await sql`
      UPDATE sponsored_casts
      SET click_count = click_count + 1
      WHERE id = ${id}
    `;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[sponsored-cast] POST error:', err?.message);
    return NextResponse.json({ ok: false, error: 'Failed to record click' }, { status: 500 });
  }
}