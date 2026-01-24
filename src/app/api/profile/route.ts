import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get('fid');
  const username = searchParams.get('username');
  const includeCasts = searchParams.get('casts') === 'true';

  if (!NEYNAR_API_KEY) {
    return NextResponse.json(
      { error: 'NEYNAR_API_KEY not configured' },
      { status: 500 }
    );
  }

  try {
    const neynar = new NeynarAPIClient({ apiKey: NEYNAR_API_KEY });
    let user;
    let userFid: number;
    
    if (username) {
      // Fetch by username using direct API call
      const url = `https://api.neynar.com/v2/farcaster/user/by_username?username=${encodeURIComponent(username)}`;
      const response = await fetch(url, {
        headers: {
          'accept': 'application/json',
          'api_key': NEYNAR_API_KEY,
        },
      });
      
      if (!response.ok) {
        throw new Error('User not found');
      }
      
      const data = await response.json();
      user = data.user;
      userFid = user?.fid;
    } else if (fid) {
      // Fetch by FID
      userFid = parseInt(fid);
      const response = await neynar.fetchBulkUsers({ fids: [userFid] });
      user = response.users?.[0];
    } else {
      return NextResponse.json(
        { error: 'Either fid or username is required' },
        { status: 400 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Optionally fetch user's casts
    let casts = null;
    if (includeCasts && userFid) {
      try {
        console.log(`Fetching casts for FID ${userFid}...`);
        // Use direct API call for user casts
        const url = `https://api.neynar.com/v2/farcaster/feed/user/${userFid}/casts?limit=25`;
        const response = await fetch(url, {
          headers: {
            'accept': 'application/json',
            'api_key': NEYNAR_API_KEY,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          casts = data.casts || [];
          console.log(`✅ Found ${casts.length} casts for FID ${userFid}`);
        } else {
          console.error(`Failed to fetch casts: ${response.status}`);
          casts = [];
        }
      } catch (castError) {
        console.error('Error fetching user casts:', castError);
        // Don't fail the whole request if casts fail
        casts = [];
      }
    }

    return NextResponse.json({
      ...user,
      casts: includeCasts ? casts : undefined
    });
  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
