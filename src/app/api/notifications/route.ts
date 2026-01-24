import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fid = searchParams.get('fid');
    const cursor = searchParams.get('cursor'); // For pagination
    const type = searchParams.get('type'); // Filter by notification type
    
    if (!fid) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
    
    if (!NEYNAR_API_KEY) {
      return NextResponse.json({ error: 'Neynar API key not configured' }, { status: 500 });
    }

    // Fetch notifications from Neynar with enhanced parameters
    let url = `https://api.neynar.com/v2/farcaster/notifications?fid=${fid}&priority_mode=true`;
    if (cursor) url += `&cursor=${cursor}`;
    if (type) url += `&type=${type}`;
    
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'api_key': NEYNAR_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Neynar API error: ${response.status}`, errorText);
      throw new Error(`Neynar API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform the data to make it easier to work with
    const transformedNotifications = data.notifications?.map((notif: any) => {
      // Extract actors from various possible fields based on notification type
      let actors = [];
      let actor = null;
      
      // For likes, get users from reactions array
      if (notif.type === 'likes' && notif.reactions) {
        actors = notif.reactions.map((r: any) => r.user).filter(Boolean);
        actor = actors[0]; // Use first reactor as primary actor
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
