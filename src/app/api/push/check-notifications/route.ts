import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { getDb } from '@/lib/db';
import webpush from 'web-push';

// VAPID keys must be set as env vars:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
// Generate once with: npx web-push generate-vapid-keys
let vapidInitialized = false;
function initVapid() {
  if (vapidInitialized) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error('VAPID keys not configured');
  webpush.setVapidDetails('mailto:hello@homiehouse.lol', pub, priv);
  vapidInitialized = true;
}

const HYPERSNAP = process.env.NEXT_PUBLIC_HYPERSNAP_URL || 'https://haatz.quilibrium.com';

async function fetchLatestNotifications(fid: number): Promise<any[]> {
  const res = await fetch(
    `${HYPERSNAP}/v2/farcaster/notifications?fid=${fid}&limit=5`,
    { headers: { accept: 'application/json' }, cache: 'no-store' }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data?.notifications ?? data?.data?.notifications ?? [];
}

function describeNotification(notif: any): { title: string; body: string; url: string } {
  const actor =
    notif.cast?.author ||
    notif.reactions?.[0]?.user ||
    notif.recasts?.[0]?.user ||
    notif.follows?.[0]?.user ||
    notif.actor ||
    notif.user ||
    {};
  const name = actor.display_name || actor.username || 'Someone';
  const castHash = notif.cast?.hash || '';
  const url = castHash ? `/cast/${castHash}` : '/notifications';

  switch (notif.type) {
    case 'reply':
      return { title: `${name} replied`, body: notif.cast?.text?.slice(0, 80) || '', url };
    case 'mention':
      return { title: `${name} mentioned you`, body: notif.cast?.text?.slice(0, 80) || '', url };
    case 'likes':
      return { title: `${name} liked your cast`, body: notif.cast?.text?.slice(0, 60) || '', url };
    case 'recasts':
      return { title: `${name} recasted you`, body: notif.cast?.text?.slice(0, 60) || '', url };
    case 'follows':
      return {
        title: `${name} followed you`,
        body: '@' + (actor.username || ''),
        url: `/profile?user=${actor.username || actor.fid}`,
      };
    default:
      return { title: 'New notification', body: '', url: '/notifications' };
  }
}

export async function GET(req: NextRequest) {
  // Protect with cron secret
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {

    // Rate limit: 30 requests/minute per IP
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`push-check-notifications:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
    initVapid();
  } catch {
    // VAPID keys not yet configured — skip silently rather than flooding logs with 503
    return NextResponse.json({ ok: true, sent: 0, errors: 0, note: 'VAPID not configured' });
  }

  const db = getDb();
  const { rows: subs } = await db.query(
    'SELECT id, user_fid, subscription, last_notified_at FROM push_subscriptions'
  );

  let sent = 0;
  let errors = 0;

  for (const sub of subs) {
    try {
      const notifications = await fetchLatestNotifications(sub.user_fid);
      if (!notifications.length) continue;

      const lastNotified = new Date(sub.last_notified_at);
      const newNotifs = notifications.filter((n: any) => {
        const ts = new Date(n.most_recent_timestamp || n.timestamp);
        return ts > lastNotified;
      });
      if (!newNotifs.length) continue;

      const payload = describeNotification(newNotifs[0]);

      await webpush.sendNotification(sub.subscription, JSON.stringify(payload));

      await db.query(
        'UPDATE push_subscriptions SET last_notified_at = NOW() WHERE id = $1',
        [sub.id]
      );
      sent++;
    } catch (err: any) {
      if (err?.statusCode === 410) {
        // Endpoint gone — remove stale subscription
        await db.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
      }
      errors++;
    }
  }

  return NextResponse.json({ ok: true, sent, errors });
}
