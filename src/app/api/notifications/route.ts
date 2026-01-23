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
    const transformedNotifications = data.notifications?.map((notif: any) => ({
      ...notif,
      actor: notif.most_recent_timestamp ? {
        fid: notif.user?.fid,
        username: notif.user?.username,
        display_name: notif.user?.display_name,
        pfp_url: notif.user?.pfp_url,
        follower_count: notif.user?.follower_count,
        following_count: notif.user?.following_count,
        power_badge: notif.user?.power_badge
      } : (notif.cast?.author || notif.user),
      // Add timestamp for easier sorting
      timestamp: notif.most_recent_timestamp || notif.timestamp
    })) || [];

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
