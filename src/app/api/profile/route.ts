import { NextRequest, NextResponse } from 'next/server';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get('fid');
  const username = searchParams.get('username');

  if (!NEYNAR_API_KEY) {
    return NextResponse.json(
      { error: 'NEYNAR_API_KEY not configured' },
      { status: 500 }
    );
  }

  try {
    let url: string;
    
    if (username) {
      // Fetch by username
      url = `https://api.neynar.com/v2/farcaster/user/by_username?username=${encodeURIComponent(username)}`;
    } else if (fid) {
      // Fetch by FID
      url = `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`;
    } else {
      return NextResponse.json(
        { error: 'Either fid or username is required' },
        { status: 400 }
      );
    }

    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        api_key: NEYNAR_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Neynar API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch profile from Neynar' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Extract user data based on endpoint used
    let user;
    if (username) {
      user = data.user;
    } else {
      user = data.users?.[0];
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
