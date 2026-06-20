import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Rate limit (30 per hour per IP)
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const { success: rlOk } = rateLimit(`analyze-cast:${ip}`, 30, 3600);
    if (!rlOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const searchParams = request.nextUrl.searchParams;
    const castHash = searchParams.get('hash');
    const castUrl = searchParams.get('url');

    if (!castHash && !castUrl) {
      return NextResponse.json(
        { error: 'Cast hash or URL is required' },
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

    // Extract hash from URL if provided
    let hash = castHash;
    if (castUrl && !hash) {
      const match = castUrl.match(/\/0x([a-fA-F0-9]+)/);
      hash = match ? `0x${match[1]}` : null;
    }

    if (!hash) {
      return NextResponse.json(
        { error: 'Invalid cast identifier' },
        { status: 400 }
      );
    }

    // Fetch cast details from Pinata Farcaster API
    const response = await fetch(
      `https://api.pinata.cloud/v3/farcaster/casts/${encodeURIComponent(hash)}`,
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
    // Pinata returns { data: { ... } } or { cast: { ... } }
    const cast = data?.data ?? data.cast;

    if (!cast) {
      return NextResponse.json(
        { error: 'Cast not found' },
        { status: 404 }
      );
    }

    // Get author reputation from Quotient if available
    let authorReputation = null;
    const QUOTIENT_API_KEY = process.env.QUOTIENT_API_KEY;
    if (QUOTIENT_API_KEY && cast.author?.fid) {
      try {
        const repResponse = await fetch(
          'https://api.quotient.social/v1/user-reputation',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fids: [cast.author.fid],
              api_key: QUOTIENT_API_KEY
            })
          }
        );
        
        if (repResponse.ok) {
          const repData = await repResponse.json();
          authorReputation = repData.data?.[0] || null;
        }
      } catch (error) {
        console.error('Quotient API error:', error);
      }
    }

    // Calculate engagement metrics
    const totalEngagement = 
      (cast.reactions?.likes_count || 0) +
      (cast.reactions?.recasts_count || 0) +
      (cast.replies?.count || 0);

    const engagementRate = cast.author?.follower_count 
      ? (totalEngagement / cast.author.follower_count * 100).toFixed(2)
      : 0;

    return NextResponse.json({
      cast: {
        hash: cast.hash,
        text: cast.text,
        timestamp: cast.timestamp,
        embeds: cast.embeds,
        mentions: cast.mentioned_profiles,
        channel: cast.channel,
        parent: cast.parent_url || cast.parent_hash
      },
      author: {
        fid: cast.author.fid,
        username: cast.author.username,
        displayName: cast.author.display_name,
        pfpUrl: cast.author.pfp_url,
        followerCount: cast.author.follower_count,
        followingCount: cast.author.following_count,
        bio: cast.author.profile?.bio?.text
      },
      engagement: {
        likes: cast.reactions?.likes_count || 0,
        recasts: cast.reactions?.recasts_count || 0,
        replies: cast.replies?.count || 0,
        quotes: cast.reactions?.quotes_count || 0,
        total: totalEngagement,
        rate: engagementRate
      },
      reputation: authorReputation ? {
        quotientScore: authorReputation.quotientScore,
        quotientRank: authorReputation.quotientRank,
        contextLabels: authorReputation.contextLabels,
        topTrader: authorReputation.topTrader,
        topBuilder: authorReputation.topBuilder,
        topTokenEvangelist: authorReputation.topTokenEvangelist
      } : null
    });
  } catch (error) {
    console.error('Error analyzing cast:', error);
    return NextResponse.json(
      { error: 'Failed to analyze cast' },
      { status: 500 }
    );
  }
}
