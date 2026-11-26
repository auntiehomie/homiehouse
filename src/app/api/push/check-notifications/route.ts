import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { getDb } from '@/lib/db';
import webpush from 'web-push';
import { verifyCronSecret } from '@/lib/auth';
import { AuthError } from '@/lib/errors';
import { safeFetchPublicUrl } from '@/lib/safe-public-fetch';
import { fetchFeed, fetchNotifications } from '@/lib/hypersnap';
import { ensurePushTable } from '@/lib/push-storage';
import { DEFAULT_PUSH_PREFERENCES, parsePushPreferences } from '@/lib/push-preferences';
import { selectPushDigest } from '@/lib/push-events';

export const maxDuration = 60;
let vapidInitialized = false;
function initVapid() {
  if (vapidInitialized) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error('VAPID keys not configured');
  webpush.setVapidDetails('mailto:hello@homiehouse.lol', pub, priv);
  vapidInitialized = true;
}

export async function GET(req: NextRequest) {
  try { verifyCronSecret(req, process.env.CRON_SECRET); }
  catch (error) {
    if (!(error instanceof AuthError)) throw error;
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!(await rateLimit(`push-check-notifications:${ip}`, 30, 60)).success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }
  try { initVapid(); }
  catch { return NextResponse.json({ ok: true, sent: 0, errors: 0, note: 'VAPID not configured' }); }

  const db = getDb();
  await ensurePushTable(db);
  const { rows: subs } = await db.query(
    `SELECT id, user_fid, subscription, preferences, last_notified_at, last_cast_notified_at
     FROM push_subscriptions WHERE processing_until IS NULL OR processing_until < NOW() ORDER BY COALESCE(processing_until, created_at), id LIMIT 100`
  );
  let sent = 0;
  let errors = 0;
  const deadline = Date.now() + 30_000;
  for (const sub of subs) {
    if (Date.now() > deadline) break;
    const { rows: claimed } = await db.query(`UPDATE push_subscriptions
      SET processing_until = NOW() + INTERVAL '2 minutes'
      WHERE id = $1 AND (processing_until IS NULL OR processing_until < NOW()) RETURNING id`, [sub.id]);
    if (!claimed.length) continue;
    try {
      const preferences = parsePushPreferences(sub.preferences) || DEFAULT_PUSH_PREFERENCES;
      const [notificationResult, castResult] = await Promise.allSettled([
        fetchNotifications({ fid: sub.user_fid, limit: 25 }),
        preferences.newCasts ? fetchFeed({ feed_type: 'following', fid: sub.user_fid, limit: 25 }) : Promise.resolve({ casts: [] }),
      ]);
      const notifications = notificationResult.status === 'fulfilled'
        ? notificationResult.value?.notifications ?? notificationResult.value?.data?.notifications : null;
      const notificationOk = Array.isArray(notifications) && notificationResult.status === 'fulfilled' && notificationResult.value?._source !== 'empty';
      const castOk = castResult.status === 'fulfilled' && Array.isArray(castResult.value?.casts);
      if (!notificationOk || !castOk) errors++;
      // Independent sources can deliver independently. A failed source never advances its watermark.
      const digest = selectPushDigest(
        notificationOk ? notifications : [],
        castOk && castResult.status === 'fulfilled' ? castResult.value.casts : [], preferences,
        new Date(sub.last_notified_at).toISOString(), new Date(sub.last_cast_notified_at).toISOString(), sub.user_fid,
      );
      if (digest.payload) {
        const endpoint = new URL(sub.subscription.endpoint);
        if (endpoint.protocol !== 'https:') throw new Error('Push endpoint must use HTTPS');
        const details = webpush.generateRequestDetails(sub.subscription, JSON.stringify(digest.payload), { TTL: 300, urgency: 'normal' });
        const response = await safeFetchPublicUrl(endpoint, {
          method: 'POST', headers: details.headers, body: details.body,
          maxRedirects: 0, maxBytes: 16 * 1024, timeoutMs: 5000,
        });
        if (response.status === 404 || response.status === 410) {
          await db.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
          continue;
        }
        if (!response.ok) { errors++; continue; }
        sent++;
      }
      await db.query(`UPDATE push_subscriptions SET last_notified_at = GREATEST(last_notified_at, $2::timestamptz),
        last_cast_notified_at = GREATEST(last_cast_notified_at, $3::timestamptz) WHERE id = $1`,
        [sub.id, digest.notificationWatermark, digest.castWatermark]);
    } catch { errors++; }
    finally {
      // Keep a last-processed time for fair scheduling beyond the bounded batch.
      await db.query('UPDATE push_subscriptions SET processing_until = NOW() WHERE id = $1', [sub.id]);
    }
  }
  return NextResponse.json({ ok: true, sent, errors }, { headers: { 'Cache-Control': 'no-store' } });
}
