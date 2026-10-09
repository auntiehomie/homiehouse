import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { AuthError } from '@/lib/errors';
import { verifyFarcasterSignerAuth } from '@/lib/auth';

const PURCHASES_PAUSED_MESSAGE =
  'HH2 shop purchases are paused while the reward system is secured. Existing owned items remain available.';

export async function GET(req: NextRequest) {
  try {
    const authFid = await verifyFarcasterSignerAuth(req);
    const { searchParams } = new URL(req.url);
    const userFid = Number(searchParams.get('fid'));

    if (!Number.isSafeInteger(userFid) || userFid <= 0) {
      return NextResponse.json({ ok: false, error: 'Valid FID required' }, { status: 400 });
    }
    if (authFid !== userFid) {
      return NextResponse.json(
        { ok: false, error: 'FID does not match authenticated user' },
        { status: 403 }
      );
    }

    const db = getDb();
    const result = await db.query(
      'SELECT item_id, purchased_at FROM hh2_purchases WHERE user_fid = $1 ORDER BY purchased_at ASC',
      [userFid]
    );
    const rows = result.rows as Array<{ item_id: string; purchased_at: string }>;

    return NextResponse.json({
      ok: true,
      claimsPaused: true,
      message: PURCHASES_PAUSED_MESSAGE,
      owned_items: rows.map(row => row.item_id),
      balance: 0,
      spend_summary: {
        purchase_count: rows.length,
        total_spent: 0,
        first_spent_at: rows[0]?.purchased_at ?? null,
        repeat_spender: rows.length > 1,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error('[hh2-purchase] GET error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch purchases' }, { status: 500 });
  }
}

// Fail closed. Spending based on client-authored learning completion IDs is disabled
// until the HH2 reward ledger and completion validation are rebuilt and reconciled.
export async function POST() {
  return NextResponse.json(
    { ok: false, claimsPaused: true, error: PURCHASES_PAUSED_MESSAGE },
    { status: 503 }
  );
}
