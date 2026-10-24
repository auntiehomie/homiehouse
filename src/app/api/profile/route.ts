import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { fetchUserByUsername, fetchUserByFid, fetchUserCastsPage } from '@/lib/hypersnap';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateFid, validateUsername } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const logger = createApiLogger('/profile');
  logger.start();

  try {

    // Rate limit: 30 requests/minute per IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`profile:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
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
      const username = validateUsername(usernameParam);
      const data = await fetchUserByUsername(username);
      user = data.user;
      userFid = user?.fid || user?.id;
      logger.info('Fetched by username', { hasUser: !!user, extractedFid: userFid });
    } else if (fidParam) {
      userFid = validateFid(fidParam);
      const data = await fetchUserByFid(userFid);
      user = data.user;
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
    let next = null;
    let castsUnavailable = false;
    if (includeCasts && userFid) {
      try {
        logger.info('Fetching user casts', { fid: userFid });
        const page = await fetchUserCastsPage(userFid, 25, searchParams.get('cursor') || undefined);
        casts = page.casts;
        next = page.next ?? null;
        logger.info('Casts fetched', { count: casts.length });
      } catch (error) {
        logger.warn('Failed to fetch casts', { error: String(error) });
        // Profile identity should remain available when the author's feed is
        // temporarily unavailable on both Hypersnap nodes.
        casts = [];
        castsUnavailable = true;
      }
    }

    logger.success('Profile fetched', { fid: userFid });
    logger.end();

    // Normalize and ensure required fields are always present
    const normalizedUser = {
      fid: userFid || 0,
      username: user?.username || `user_${userFid}`,
      display_name: user?.display_name || user?.username || 'Unknown User',
      pfp_url: user?.pfp_url || '',
      follower_count: typeof user?.follower_count === 'number' ? user.follower_count : 0,
      following_count: typeof user?.following_count === 'number' ? user.following_count : 0,
      verified_addresses: user?.verified_addresses || { eth_addresses: [] },
      power_badge: user?.power_badge || false,
      profile: user?.profile || { bio: { text: '' } },
    };

    logger.info('Sending normalized profile', {
      fid: normalizedUser.fid,
      username: normalizedUser.username,
      displayName: normalizedUser.display_name
    });

    return NextResponse.json({ ...normalizedUser, casts, next, castsUnavailable }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } });
  } catch (error: any) {
    logger.error('Failed to fetch profile', error);
    return handleApiError(error, 'GET /profile');
  }
}
