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

    // Optionally fetch user's casts
    let casts = null;
    if (includeCasts && userFid) {
      try {
        logger.info('Fetching user casts', { fid: userFid });
        const data = await neynarFetch(`/feed/user/${userFid}/casts?limit=25`);
        casts = data.casts || [];
        logger.info('Casts fetched', { count: casts.length });
      } catch (error) {
        logger.warn('Failed to fetch casts', { error: String(error) });
        casts = [];
      }
    }

    logger.success('Profile fetched', { fid: userFid });
    logger.end();

    return NextResponse.json({ user, casts });
  } catch (error: any) {
    logger.error('Failed to fetch profile', error);
    return handleApiError(error, 'GET /profile');
  }
}
