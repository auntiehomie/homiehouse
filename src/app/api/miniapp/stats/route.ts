import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json(
        { error: 'FID is required' },
        { status: 400 }
      );
    }

    const PINATA_JWT = process.env.PINATA_JWT;
    if (!PINATA_JWT) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.pinata.cloud/v3/farcaster/users/${fid}`,
      {
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${PINATA_JWT}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Farcaster API error: ${response.status}`);
    }

    const data = await response.json();
    // Pinata returns { data: { ... } }
    const user = data?.data ?? data.users?.[0];

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      followerCount: user.follower_count || 0,
      followingCount: user.following_count || 0,
      username: user.username,
      displayName: user.display_name,
      pfpUrl: user.pfp_url
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user stats' },
      { status: 500 }
    );
  }
}
