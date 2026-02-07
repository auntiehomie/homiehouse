import { NextRequest, NextResponse } from 'next/server';
import { fetchUserByUsername, neynarFetch } from '@/lib/neynar';
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
      userFid = user?.fid;
    } else if (fidParam) {
      // Validate and fetch by FID
      userFid = validateFid(fidParam);
      const data = await neynarFetch(`/user/bulk?fids=${userFid}`);
      user = data.users?.[0];
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Debug: log what we received from Neynar
    logger.info('User data from Neynar', {
      hasFid: !!user?.fid,
      hasUsername: !!user?.username,
      userKeys: Object.keys(user || {}).slice(0, 10)
    });

    // Optionally fetch user's casts
    let casts = null;
    if (includeCasts && userFid) {
      try {
        logger.info('Fetching user casts', { fid: userFid });
        const data = await neynarFetch(`/feed?feed_type=filter&filter_type=fids&fids=${userFid}&limit=25`);
        casts = data.casts || [];
        logger.info('Casts fetched', { count: casts.length });
      } catch (error) {
        logger.warn('Failed to fetch casts', { error: String(error) });
        casts = [];
      }
    }

    logger.success('Profile fetched', { fid: userFid });
    logger.end();

    // Normalize and ensure required fields are always present
    const normalizedUser = {
      fid: user?.fid ?? userFid,
      username: user?.username || `user_${userFid}`,
      display_name: user?.display_name || user?.username || 'Unknown User',
      pfp_url: user?.pfp_url || '',
      follower_count: user?.follower_count ?? 0,
      following_count: user?.following_count ?? 0,
      ...(user || {}),
    };

    logger.info('Sending normalized profile', {
      fid: normalizedUser.fid,
      username: normalizedUser.username,
      displayName: normalizedUser.display_name
    });

    return NextResponse.json({ ...normalizedUser, casts });
  } catch (error: any) {
    logger.error('Failed to fetch profile', error);
    return handleApiError(error, 'GET /profile');
  }
}
