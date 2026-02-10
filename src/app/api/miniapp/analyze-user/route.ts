import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Rate limit (30 per hour per IP)
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const { success: rlOk } = rateLimit(`analyze-user:${ip}`, 30, 3600);
    if (!rlOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get('username');
    const fid = searchParams.get('fid');

    if (!username && !fid) {
      return NextResponse.json(
        { error: 'Username or FID is required' },
        { status: 400 }
      );
    }

    const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
    if (!NEYNAR_API_KEY) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    // Fetch user from Neynar
    const endpoint = username 
      ? `https://api.neynar.com/v2/farcaster/user/by_username?username=${username}`
      : `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`;

    const response = await fetch(endpoint, {
      headers: {
        'accept': 'application/json',
        'api_key': NEYNAR_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Neynar API error: ${response.status}`);
    }

    const data = await response.json();
    const user = username ? data.user : data.users?.[0];

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get reputation from Quotient
    let reputation = null;
    const QUOTIENT_API_KEY = process.env.QUOTIENT_API_KEY;
    if (QUOTIENT_API_KEY) {
      try {
        const repResponse = await fetch(
          'https://api.quotient.social/v1/user-reputation',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fids: [user.fid],
              api_key: QUOTIENT_API_KEY
            })
          }
        );
        
        if (repResponse.ok) {
          const repData = await repResponse.json();
          reputation = repData.data?.[0] || null;
        }
      } catch (error) {
        console.error('Quotient API error:', error);
      }
    }

    // Calculate engagement metrics
    const avgEngagement = user.follower_count > 0
      ? ((user.following_count / user.follower_count) * 100).toFixed(2)
      : 0;

    return NextResponse.json({
      profile: {
        fid: user.fid,
        username: user.username,
        displayName: user.display_name,
        pfpUrl: user.pfp_url,
        bio: user.profile?.bio?.text,
        location: user.profile?.location?.description,
        website: user.profile?.website,
        custodyAddress: user.custody_address,
        verifiedAddresses: user.verified_addresses?.eth_addresses || []
      },
      stats: {
        followers: user.follower_count || 0,
        following: user.following_count || 0,
        followerRatio: avgEngagement
      },
      reputation: reputation ? {
        quotientScore: reputation.quotientScore,
        quotientRank: reputation.quotientRank,
        contextLabels: reputation.contextLabels || [],
        badges: {
          topTrader: reputation.topTrader || false,
          topBuilder: reputation.topBuilder || false,
          topTokenEvangelist: reputation.topTokenEvangelist || false
        },
        tier: getScoreTier(reputation.quotientScore)
      } : null,
      activity: {
        activeChannels: user.active_on_fc_network || false,
        powerBadge: user.power_badge || false
      }
    });
  } catch (error) {
    console.error('Error analyzing user:', error);
    return NextResponse.json(
      { error: 'Failed to analyze user' },
      { status: 500 }
    );
  }
}

function getScoreTier(score: number): string {
  if (score >= 90) return 'Elite';
  if (score >= 75) return 'High';
  if (score >= 50) return 'Medium';
  if (score >= 25) return 'Low';
  return 'New';
}
