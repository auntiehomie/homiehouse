import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { fetchNotifications } from '@/lib/hypersnap';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateFid } from '@/lib/validation';
import { getOpenRankScores, isSpamAccount } from '@/lib/openrank';

// Sentry for notification pipeline alerting — lazily loaded so the route works
// without @sentry/nextjs installed.
let SentryCapture: ((error: any, context?: Record<string, unknown>) => void) | null = null;
try {
  const Sentry = require('@sentry/nextjs');
  SentryCapture = (error: any, context?: Record<string, unknown>) => {
    Sentry.captureException(error, { extra: context });
  };
} catch { /* @sentry/nextjs not installed — alerting skipped */ }

export async function GET(req: NextRequest) {
  const logger = createApiLogger('/notifications');
  logger.start();

  try {

    // Rate limit: 30 requests/minute per IP
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`notifications:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
    const { searchParams } = new URL(req.url);
    const fidParam = searchParams.get('fid');
    const cursor = searchParams.get('cursor');

    if (!fidParam) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    const fid = validateFid(fidParam);

    logger.info('Fetching notifications', { fid, cursor });

    // Fetch notifications with a 12s timeout to stay within Vercel limits
    const fetchPromise = fetchNotifications({
      fid,
      cursor: cursor || undefined,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Notifications fetch timed out after 12s')), 12_000)
    );

    const raw = await Promise.race([fetchPromise, timeoutPromise]);

    // Unwrap data envelope
    const notificationsRaw: any[] = raw?.data?.notifications ?? raw?.notifications ?? [];

    // Surface fetch diagnostics so the frontend (and logs) can distinguish
    // "no notifications" (healthy) from "couldn't reach Hypersnap" (error).
    const fetchMeta = {
      source: raw?._source || 'unknown',
      timings: raw?._timings || {},
    };

    if (notificationsRaw.length === 0) {
      logger.info('No notifications returned', { fid, ...fetchMeta });
      logger.end();
      return NextResponse.json({
        notifications: [],
        next_cursor: undefined,
        has_more: false,
        _meta: fetchMeta,
      });
    }
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

    // Filter spam actors from passive notification types (likes, follows, quotes).
    // Replies and mentions are always shown — the user explicitly interacted.
    let finalNotifications = transformedNotifications;
    try {
      const passiveTypes = new Set(['likes', 'recasts', 'follows', 'quote']);
      const actorFids = [...new Set(
        finalNotifications
          .filter((n: any) => passiveTypes.has(n.type))
          .flatMap((n: any) => (n.actors as any[]).map((a: any) => a?.fid).filter(Boolean))
      )] as number[];

      if (actorFids.length > 0) {
        const scores = await getOpenRankScores(actorFids);
        finalNotifications = finalNotifications.filter((notif: any) => {
          if (!passiveTypes.has(notif.type)) return true;
          const actors: any[] = notif.actors ?? [];
          // Keep notification if at least one actor passes the spam check
          return actors.some((a: any) => !isSpamAccount(a?.fid, scores, a));
        });
      }
    } catch {
      // Fail open
    }

    logger.success('Notifications fetched', { count: finalNotifications.length, ...fetchMeta });
    logger.end();

    return NextResponse.json({
      notifications: finalNotifications,
      next_cursor: nextToken,
      has_more: !!nextToken,
      _meta: fetchMeta,
    });
  } catch (error: any) {
    logger.error('Failed to fetch notifications', error);
    // Capture to Sentry if available — dedicated alert for notification pipeline failures
    if (SentryCapture) {
      SentryCapture(error, {
        route: '/api/notifications',
        fid,
        cursor,
        errorMessage: error?.message || 'Unknown',
        errorName: error?.name || 'Unknown',
      });
    }
    return handleApiError(error, 'GET /notifications');
  }
}
