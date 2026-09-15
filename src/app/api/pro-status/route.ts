import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isProUser } from '@/lib/pro';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';

// Re-export for backward compatibility
export { isProUser };

// GET /api/pro-status?fid=123 — check if a user has Pro status
export async function GET(req: NextRequest) {
  try {
    // Verify auth via signer key headers
    let authFid: number;
    try {
      authFid = await verifyFarcasterSignerAuth(req);
    } catch (err) {
      // Return is_pro: false for unauthenticated requests
      return NextResponse.json({
        ok: true,
        is_pro: false,
        subscription: null,
      });
    }

    const { searchParams } = new URL(req.url);
    const fidParam = searchParams.get('fid');

    // If no fid param, use the authenticated FID
    if (fidParam) {
      const userFid = Number(fidParam);
      if (!userFid || isNaN(userFid) || userFid <= 0) {
        return NextResponse.json({ ok: false, error: 'Valid FID required' }, { status: 400 });
      }
      // Verify the authenticated FID matches the requested FID
      if (authFid !== userFid) {
        return NextResponse.json(
          { ok: false, error: 'FID does not match authenticated user' },
          { status: 403 }
        );
      }
    }

    const fid = authFid;

    const rows = await sql`
      SELECT id, status, subscribed_at, expires_at
      FROM pro_subscribers
      WHERE user_fid = ${fid}
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `;

    const isPro = rows.length > 0;
    const sub = rows[0] ?? null;

    return NextResponse.json({
      ok: true,
      is_pro: isPro,
      subscription: sub
        ? {
            status: (sub as any).status,
            subscribed_at: (sub as any).subscribed_at,
            expires_at: (sub as any).expires_at,
          }
        : null,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    console.error('[pro-status] GET error:', err?.message);
    return NextResponse.json({ ok: false, error: 'Failed to check Pro status' }, { status: 500 });
  }
}