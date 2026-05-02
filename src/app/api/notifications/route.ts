import { NextRequest, NextResponse } from 'next/server';
import { fetchNotifications } from '@/lib/neynar';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateFid } from '@/lib/validation';
import { verifySignerAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const logger = createApiLogger('/notifications');
  logger.start();

  try {
    const { searchParams } = new URL(req.url);
    const fidParam = searchParams.get('fid');
    const signerUuid = searchParams.get('signerUuid');
    const cursor = searchParams.get('cursor');

    if (!fidParam) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    // SECURITY: Require signer authentication for private notification data
    if (!signerUuid) {
      return NextResponse.json({ error: 'signerUuid is required' }, { status: 401 });
    }

    const verifiedFid = await verifySignerAuth(signerUuid);
    // validateFid returns a number; use it directly for Pinata (expects number)
    const fid = validateFid(fidParam);

    // Ensure user can only access their own notifications
    if (verifiedFid.toString() !== fid.toString()) {
      return NextResponse.json(
        { error: 'Cannot access notifications for another user' },
        { status: 403 }
      );
    }

    logger.info('Fetching notifications', { fid, cursor });

    // fetchNotifications → pinata.ts → Pinata Farcaster /notifications?fid=
    // Pinata response shape: { data: { notifications: [...], next_page_token: "..." } }
    const raw = await fetchNotifications({
      fid,
      cursor: cursor || undefined,
    });

    // Unwrap Pinata data envelope
    const notificationsRaw: any[] = raw?.data?.notifications ?? raw?.notifications ?? [];
    const nextToken: string | undefined = raw?.data?.next_page_token ?? raw?.next?.cursor;

    const transformedNotifications = notificationsRaw.map((notif: any) => {
      let actors: any[] = [];
      let actor = null;

      if (notif.type === 'likes' && notif.reactions) {
        actors = notif.reactions.map((r: any) => r.user).filter(Boolean);
        actor = actors[0];
      } else if (notif.type === 'recasts' && notif.recasts) {
        actors = notif.recasts.map((r: any) => r.user).filter(Boolean);
        actor = actors[0];
      } else if (notif.type === 'follows' && notif.follows) {
        actors = notif.follows.map((f: any) => f.user).filter(Boolean);
        actor = actors[0];
      } else if (notif.type === 'quote' && notif.quotes) {
        actors = notif.quotes.map((q: any) => q.author).filter(Boolean);
        actor = actors[0];
      } else if ((notif.type === 'reply' || notif.type === 'mention') && notif.cast?.author) {
        actor = notif.cast.author;
        actors = [actor];
      } else if (notif.reactor) {
        actor = notif.reactor;
      } else if (notif.user) {
        actor = notif.user;
      } else if (notif.author) {
        actor = notif.author;
      }

      return {
        ...notif,
        actor,
        actors,
        actorCount: actors.length,
        timestamp: notif.most_recent_timestamp || notif.timestamp
      };
    });

    logger.success('Notifications fetched', { count: transformedNotifications.length });
    logger.end();

    return NextResponse.json({
      notifications: transformedNotifications,
      next_cursor: nextToken,
      has_more: !!nextToken
    });
  } catch (error: any) {
    logger.error('Failed to fetch notifications', error);
    return handleApiError(error, 'GET /notifications');
  }
}
