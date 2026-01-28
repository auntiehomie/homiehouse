import { NextRequest, NextResponse } from 'next/server';
import { fetchNotifications } from '@/lib/neynar';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateFid } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const logger = createApiLogger('/notifications');
  logger.start();

  try {
    const { searchParams } = new URL(req.url);
    const fidParam = searchParams.get('fid');
    const cursor = searchParams.get('cursor');
    const type = searchParams.get('type');
    
    if (!fidParam) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    // Validate input
    const fid = validateFid(fidParam).toString();

    logger.info('Fetching notifications', { fid, cursor, type });

    // Fetch notifications using shared utility
    const data = await fetchNotifications({
      fid,
      priority_mode: true,
      cursor: cursor || undefined,
      type: type || undefined,
    });
    
    // Transform the data to make it easier to work with
    const transformedNotifications = data.notifications?.map((notif: any) => {
      // Extract actors from various possible fields based on notification type
      let actors = [];
      let actor = null;
      
      // For likes, get users from reactions array
      if (notif.type === 'likes' && notif.reactions) {
        actors = notif.reactions.map((r: any) => r.user).filter(Boolean);
        actor = actors[0];
      }
      // For recasts, get users from recasts array
      else if (notif.type === 'recasts' && notif.recasts) {
        actors = notif.recasts.map((r: any) => r.user).filter(Boolean);
        actor = actors[0];
      }
      // For follows, get users from follows array
      else if (notif.type === 'follows' && notif.follows) {
        actors = notif.follows.map((f: any) => f.user).filter(Boolean);
        actor = actors[0];
      }
      // For quotes, get users from quotes array
      else if (notif.type === 'quote' && notif.quotes) {
        actors = notif.quotes.map((q: any) => q.author).filter(Boolean);
        actor = actors[0];
      }
      // For replies/mentions, use cast author
      else if ((notif.type === 'reply' || notif.type === 'mention') && notif.cast?.author) {
        actor = notif.cast.author;
        actors = [actor];
      }
      // Fallback to other fields
      else if (notif.reactor) {
        actor = notif.reactor;
      } else if (notif.user) {
        actor = notif.user;
      } else if (notif.author) {
        actor = notif.author;
      }
      
      return {
        ...notif,
        actor: actor,
        actors: actors,
        actorCount: actors.length,
        timestamp: notif.most_recent_timestamp || notif.timestamp
      };
    }) || [];

    logger.success('Notifications fetched', { count: transformedNotifications.length });
    logger.end();

    return NextResponse.json({
      notifications: transformedNotifications,
      next_cursor: data.next?.cursor,
      has_more: !!data.next?.cursor
    });
  } catch (error: any) {
    logger.error('Failed to fetch notifications', error);
    return handleApiError(error, 'GET /notifications');
  }
}
      
      return {
        ...notif,
        actor: actor,
        actors: actors, // Multiple actors for group notifications
        actorCount: actors.length,
        timestamp: notif.most_recent_timestamp || notif.timestamp
      };
    }) || [];

    return NextResponse.json({
      notifications: transformedNotifications,
      next_cursor: data.next?.cursor,
      has_more: !!data.next?.cursor
    });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
