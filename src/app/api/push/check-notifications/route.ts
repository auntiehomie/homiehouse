import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:hello@homiehouse.lol',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const HYPERSNAP = process.env.NEXT_PUBLIC_HYPERSNAP_URL || 'https://haatz.quilibrium.com';

async function fetchLatestNotifications(fid: number) {
  const res = await fetch(
    `${HYPERSNAP}/v2/farcaster/notifications?fid=${fid}&limit=5`,
    { headers: { 'x-api-key': process.env.NEYNAR_API_KEY || '' }, next: { revalidate: 0 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data?.notifications ?? data?.data?.notifications ?? [];
}

function describeNotification(notif: any): { title: string; body: string; url: string } {
  const actor = notif.cast?.author || notif.actor || notif.user || {};
  const name = actor.display_name || actor.username || 'Someone';
  const castHash = notif.cast?.hash || '';
  const url = castHash ? `/cast/${castHash}` : '/notifications';

  switch (notif.type) {
    case 'reply':
      return { title: `${name} replied`, body: notif.cast?.text?.slice(0, 80) || 'to your cast', url };
    case 'mention':
      return { title: `${name} mentioned you`, body: notif.cast?.text?.slice(0, 80) || '', url };
    case 'likes':
      return { title: `${name} liked your cast`, body: notif.cast?.text?.slice(0, 60) || '', url };
    case 'recasts':
      return { title: `${name} recasted you`, body: notif.cast?.text?.slice(0, 60) || '', url };
    case 'follows':
      return { title: `${name} followed you`, body: '@' + (actor.username || ''), url: `/profile/${actor.fid}` };
    default:
      return { title: 'New notification on HomieHouse', body: '', url: '/notifications' };
  }
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sql = getDb();
  const subs = await sql.query(
    'SELECT id, user_fid, subscription, last_notified_at FROM push_subscriptions'
  );

  let sent = 0;
  let errors = 0;

  for (const sub of subs.rows) {
    try {
      const notifications = await fetchLatestNotifications(sub.user_fid);
      if (!notifications.length) continue;

      const lastNotified = new Date(sub.last_notified_at);
      const newNotifs = notifications.filter((n: any) => {
        const ts = new Date(n.most_recent_timestamp || n.timestamp);
        return ts > lastNotified;
      });

      if (!newNotifs.length) continue;

      const newest = newNotifs[0];
      const payload = describeNotification(newest);

      await webpush.sendNotification(
        sub.subscription,
        JSON.stringify(payload)
      );

      await sql.query(
        'UPDATE push_subscriptions SET last_notified_at = NOW() WHERE id = $1',
        [sub.id]
      );

      sent++;
    } catch (err: any) {
      // Remove stale subscriptions (410 = endpoint gone)
      if (err?.statusCode === 410) {
        await sql.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
      }
      errors++;
    }
  }

  return NextResponse.json({ ok: true, sent, errors });
}
