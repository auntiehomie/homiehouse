import { NextRequest } from 'next/server';
import { privateJson } from '@/lib/private-response';
import { sql } from '@/lib/db';
import { getAskHomieProStatus, isProUser } from '@/lib/pro';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';

// Re-export for backward compatibility
export { isProUser };
export const dynamic = 'force-dynamic';

// GET /api/pro-status?fid=123 — check if a user has Pro status
export async function GET(req: NextRequest) {
  try {
    const authFid = await verifyFarcasterSignerAuth(req, 'read:all');

    const { searchParams } = new URL(req.url);
    const fidParam = searchParams.get('fid');

    // If no fid param, use the authenticated FID
    if (fidParam) {
      const userFid = Number(fidParam);
      if (!userFid || isNaN(userFid) || userFid <= 0) {
        return privateJson({ ok: false, error: 'Valid FID required' }, { status: 400 });
      }
      // Verify the authenticated FID matches the requested FID
      if (authFid !== userFid) {
        return privateJson(
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

    const askHomiePro = await getAskHomieProStatus(fid);

    return privateJson({
      ok: true,
      is_pro: isPro,
      ask_homie_pro: askHomiePro,
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
      return privateJson({ ok: false, error: err.message }, { status: err.status });
    }
    console.error('[pro-status] GET error:', err?.message);
    return privateJson({ ok: false, error: 'Failed to check Pro status' }, { status: 500 });
  }
}
