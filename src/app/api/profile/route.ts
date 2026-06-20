import { NextRequest, NextResponse } from 'next/server';
import { fetchUserByUsername, hypersnapFetch } from '@/lib/hypersnap';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateFid, validateUsername } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const logger = createApiLogger('/profile');
  logger.start();

  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    const usernameParam = searchParams.get('username');
    const includeCasts = searchParams.get('casts') === 'true';

    if (!fidParam && !usernameParam) {
      return NextResponse.json(
        { error: 'Either fid or username is required' },
        { status: 400 }
      );
    }

    logger.info('Fetching profile', { fid: fidParam, username: usernameParam, includeCasts });

    let user;
    let userFid: number | undefined;

    if (usernameParam) {
      // Validate and fetch by username
      const username = validateUsername(usernameParam);
      const data = await fetchUserByUsername(username);
      user = data.user;
      userFid = user?.fid || data?.result?.user?.fid || user?.id;
      logger.info('Fetched by username', { hasUser: !!user, extractedFid: userFid });

      // Fallback: Warpcast public client API (same data, different indexing)
      if (!user) {
        logger.info('Hypersnap returned no user, trying Warpcast client API', { username });
        try {
          const wcRes = await fetch(
            `https://client.warpcast.com/v2/user-by-username?username=${encodeURIComponent(username)}`,
            { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) }
          );
          if (wcRes.ok) {
            const wcData = await wcRes.json();
            const wu = wcData?.result?.user;
            if (wu) {
              // Normalize Warpcast shape → our expected shape
              user = {
                fid: wu.fid,
                username: wu.username,
                display_name: wu.displayName || wu.username,
                pfp_url: wu.pfp?.url || '',
                follower_count: wu.followerCount || 0,
                following_count: wu.followingCount || 0,
                power_badge: wu.badges?.some((b: any) => b.type === 'power_badge') || false,
                verified_addresses: wu.verifiedAddresses || { eth_addresses: [] },
                profile: { bio: { text: wu.profile?.bio?.text || '' } },
              };
              userFid = wu.fid;
              logger.info('Warpcast fallback succeeded', { fid: userFid, username });
            }
          }
        } catch (e) {
          logger.warn('Warpcast user fallback failed', { error: String(e) });
        }
      }
    } else if (fidParam) {
      // Validate and fetch by FID
      userFid = validateFid(fidParam);
      const data = await hypersnapFetch(`/v2/farcaster/user/bulk?fids=${userFid}`);
      user = data.users?.[0];
      logger.info('Fetched by FID', { hasUser: !!user, fidParam, userFid });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    logger.info('User data from Hypersnap', {
      extractedFid: userFid,
      userFidField: user?.fid,
      hasFid: userFid !== undefined,
    });

    // Optionally fetch user's casts
    let casts = null;
    if (includeCasts && userFid) {
      try {
        logger.info('Fetching user casts', { fid: userFid });
        const data = await hypersnapFetch(`/v2/farcaster/feed?feed_type=filter&filter_type=fids&fids=${userFid}&limit=25`);
        casts = data.casts || [];
        logger.info('Casts fetched', { count: casts.length });
      } catch (error) {
        logger.warn('Failed to fetch casts', { error: String(error) });
        casts = [];
      }
    }

    logger.success('Profile fetched', { fid: userFid });
    logger.end();

    // Fetch Warpcast-filtered follower/following counts (excludes bots)
    let warpcastFollowerCount: number | null = null;
    let warpcastFollowingCount: number | null = null;
    const warpcastUsername = user?.username;
    if (warpcastUsername) {
      try {
        const warpRes = await fetch(
          `https://client.warpcast.com/v2/user-by-username?username=${encodeURIComponent(warpcastUsername)}`,
          { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
        );
        if (warpRes.ok) {
          const warpData = await warpRes.json();
          const wu = warpData?.result?.user;
          if (typeof wu?.followerCount === 'number') warpcastFollowerCount = wu.followerCount;
          if (typeof wu?.followingCount === 'number') warpcastFollowingCount = wu.followingCount;
          logger.info('Warpcast follower counts', { follower: warpcastFollowerCount, following: warpcastFollowingCount });
        }
      } catch (e) {
        logger.warn('Warpcast follower fetch failed, falling back to hub counts', { error: String(e) });
      }
    }

    // Normalize and ensure required fields are always present
    const normalizedUser = {
      fid: userFid || 0,
      username: user?.username || `user_${userFid}`,
      display_name: user?.display_name || user?.username || 'Unknown User',
      pfp_url: user?.pfp_url || '',
      follower_count: warpcastFollowerCount ?? (typeof user?.follower_count === 'number' ? user.follower_count : 0),
      following_count: warpcastFollowingCount ?? (typeof user?.following_count === 'number' ? user.following_count : 0),
      verified_addresses: user?.verified_addresses || { eth_addresses: [] },
      power_badge: user?.power_badge || false,
      profile: user?.profile || { bio: { text: '' } },
    };

    logger.info('Sending normalized profile', {
      fid: normalizedUser.fid,
      username: normalizedUser.username,
      displayName: normalizedUser.display_name
    });

    return NextResponse.json({ ...normalizedUser, casts }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } });
  } catch (error: any) {
    logger.error('Failed to fetch profile', error);
    return handleApiError(error, 'GET /profile');
  }
}
