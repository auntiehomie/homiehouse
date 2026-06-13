import { NextRequest, NextResponse } from 'next/server';
import { fetchNotifications, fetchCast, searchCasts } from '@/lib/hypersnap';
import { hasRepliedToAny } from '@/lib/bot-reply-storage';
import { verifyCronSecret } from '@/lib/auth';

const BOT_FID = parseInt(process.env.APP_FID || '0');
const HOMIEHOUSELOL_FID = parseInt(
  process.env.HOMIEHOUSELOL_FID || process.env.APP_FID || '0',
  10
);

export async function GET(request: NextRequest) {
  verifyCronSecret(request, process.env.CRON_SECRET);

  const results: any = {
    botFid: BOT_FID,
    homiehouselolFid: HOMIEHOUSELOL_FID,
    hasSignerKey: !!process.env.HOMIEHOUSELOL_SIGNER_KEY,
    hubUrl: process.env.FARCASTER_HUB_URL || 'https://haatz.quilibrium.com',
    notifications: [],
    searchMentions: [],
    errors: [],
  };

  // Fetch notifications
  try {
    const notifData = await fetchNotifications({ fid: HOMIEHOUSELOL_FID, limit: 20 });
    const rawNotifications: any[] =
      notifData?.data?.notifications ?? notifData?.notifications ?? [];

    for (const notification of rawNotifications) {
      const cast = notification.cast ?? notification;
      const notifType = notification.type ?? notification.notification_type;
      const castHash = cast?.hash;
      const parentHash = cast?.parent_hash || cast?.parent_url || cast?.hash;

      const trackingKeys = [
        `hl_cast_${castHash}`,
        `hl_parent_${parentHash}`,
        `hl_root_${cast?.root_parent_url || parentHash}`,
      ];
      const alreadyReplied = await hasRepliedToAny(trackingKeys);

      let directRepliesCount = 0;
      let botAlreadyRepliedInThread = false;
      let fetchCastError: string | null = null;
      try {
        const castData = await fetchCast(parentHash);
        const parentCast = castData?.data?.cast ?? castData?.cast;
        const directReplies: any[] = parentCast?.direct_replies ?? [];
        directRepliesCount = directReplies.length;
        botAlreadyRepliedInThread = directReplies.some(
          (r: any) => (r.author?.fid ?? r.fid) === HOMIEHOUSELOL_FID
        );
      } catch (err: any) {
        fetchCastError = err?.message;
      }

      results.notifications.push({
        type: notifType,
        hash: castHash,
        parentHash,
        author: cast?.author?.username,
        text: (cast?.text || '').slice(0, 80),
        alreadyRepliedInDb: alreadyReplied,
        directRepliesCount,
        botAlreadyRepliedInThread,
        fetchCastError,
        wouldSkip: !!(alreadyReplied || botAlreadyRepliedInThread || fetchCastError),
      });
    }
  } catch (err: any) {
    results.errors.push({ step: 'fetchNotifications', error: err?.message });
  }

  // Search for recent mentions
  try {
    const searchData = await searchCasts('@homiehouselol', 15);
    const searchCastList: any[] = searchData?.casts ?? [];
    const notifHashes = new Set(results.notifications.map((n: any) => n.hash));

    for (const c of searchCastList) {
      if (!c.hash || notifHashes.has(c.hash) || c.author?.fid === HOMIEHOUSELOL_FID) continue;

      const castHash = c.hash;
      const parentHash = c.parent_hash || c.parent_url || c.hash;
      const trackingKeys = [
        `hl_cast_${castHash}`,
        `hl_parent_${parentHash}`,
        `hl_root_${c.root_parent_url || parentHash}`,
      ];
      const alreadyReplied = await hasRepliedToAny(trackingKeys);

      results.searchMentions.push({
        hash: castHash,
        parentHash,
        author: c.author?.username,
        text: (c.text || '').slice(0, 80),
        alreadyRepliedInDb: alreadyReplied,
        timestamp: c.timestamp,
      });
    }
  } catch (err: any) {
    results.errors.push({ step: 'searchCasts', error: err?.message });
  }

  return NextResponse.json(results);
}
