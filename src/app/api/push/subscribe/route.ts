import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { getDb } from '@/lib/db';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';
import { ensurePushTable } from '@/lib/push-storage';
import { parsePushPreferences } from '@/lib/push-preferences';

// POST /api/push/subscribe  { fid, subscription }
export async function POST(req: NextRequest) {
  try {
    // Verify auth via signer key headers
    const authFid = await verifyFarcasterSignerAuth(req);

    // Rate limit: 30 requests/minute per IP
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = await rateLimit(`push-subscribe:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
    const { fid, subscription, preferences: requestedPreferences } = await req.json();
    const preferences = parsePushPreferences(requestedPreferences);
    if (!fid || !subscription?.endpoint) {
      return NextResponse.json({ error: 'fid and subscription required' }, { status: 400 });
    }

    // Verify the authenticated FID matches the request FID
    if (authFid !== fid) {
      return NextResponse.json(
        { error: 'FID does not match authenticated user' },
        { status: 403 }
      );
    }

    let endpoint: URL;
    try { endpoint = new URL(subscription.endpoint); } catch {
      return NextResponse.json({ error: 'Invalid push endpoint' }, { status: 400 });
    }
    if (!Number.isSafeInteger(fid) || fid <= 0 || endpoint.protocol !== 'https:' || endpoint.username || endpoint.password ||
      endpoint.href.length > 4096 || !/^[A-Za-z0-9_-]{87}=?$/.test(subscription.keys?.p256dh || '') ||
      !/^[A-Za-z0-9_-]{22}(==)?$/.test(subscription.keys?.auth || '') || !preferences) {
      return NextResponse.json({ error: 'Invalid push subscription or preferences' }, { status: 400 });
    }
    const db = getDb();
    await ensurePushTable(db);
    // A browser endpoint belongs to the currently signed-in account, not prior logins.
    await db.query(`DELETE FROM push_subscriptions WHERE subscription->>'endpoint' = $1 AND user_fid <> $2`, [subscription.endpoint, fid]);

    await db.query(
      `INSERT INTO push_subscriptions (user_fid, subscription, preferences)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_fid, (subscription->>'endpoint')) DO UPDATE
         SET subscription = EXCLUDED.subscription,
             last_cast_notified_at = CASE
               WHEN NOT COALESCE((push_subscriptions.preferences->>'newCasts')::boolean, false)
                 AND (EXCLUDED.preferences->>'newCasts')::boolean THEN NOW()
               ELSE push_subscriptions.last_cast_notified_at END,
             preferences = EXCLUDED.preferences`,
      [fid, JSON.stringify(subscription), JSON.stringify(preferences)]
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[push/subscribe] POST error:', err);
    return NextResponse.json({ error: 'Could not update notification settings' }, { status: 500 });
  }
}

// DELETE /api/push/subscribe  { fid, endpoint }
export async function DELETE(req: NextRequest) {
  try {
    // Verify auth via signer key headers
    const authFid = await verifyFarcasterSignerAuth(req);

    const { fid, endpoint } = await req.json();
    if (!fid || !endpoint) {
      return NextResponse.json({ error: 'fid and endpoint required' }, { status: 400 });
    }

    // Verify the authenticated FID matches the request FID
    if (authFid !== fid) {
      return NextResponse.json(
        { error: 'FID does not match authenticated user' },
        { status: 403 }
      );
    }

    const db = getDb();
    await ensurePushTable(db);
    await db.query(
      `DELETE FROM push_subscriptions
       WHERE user_fid = $1 AND subscription->>'endpoint' = $2`,
      [fid, endpoint]
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[push/subscribe] DELETE error:', err);
    return NextResponse.json({ error: 'Could not update notification settings' }, { status: 500 });
  }
}
