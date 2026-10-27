import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { searchUsers, hypersnapFetch } from '@/lib/hypersnap';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';

const HOMIEHOUSE_FID = 1349780;

export async function GET(request: NextRequest) {
  const logger = createApiLogger('/search-users');
  logger.start();

  try {

    // Rate limit: 30 requests/minute per IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`search-users:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      logger.end();
      return NextResponse.json({ users: [] });
    }

    logger.info('Searching users', { query: query.substring(0, 50) });

    // Always include @auntiehomie if query matches
    const queryLower = query.toLowerCase();
    const includeHomie = 'auntiehomie'.includes(queryLower) || queryLower.includes('homie') || queryLower.includes('auntie');

    let users: any[] = [];

    // If searching for auntiehomie, fetch it directly first
    if (includeHomie) {
      try {
        const homieData = await hypersnapFetch(`/v2/farcaster/user/bulk?fids=${HOMIEHOUSE_FID}`);
        if (homieData.users && homieData.users.length > 0) {
          users.push(homieData.users[0]);
        }
      } catch (e) {
        logger.warn('Could not fetch auntiehomie user', { error: String(e) });
      }
    }

    // Search users using shared utility
    // searchUsers normalizes the response so users are always in .users
    const searchResults = await searchUsers(query, 5);
    const resultUsers = searchResults.users || searchResults.result?.users || searchResults.result || [];
    
    // Add search results, avoiding duplicates
    resultUsers.forEach((user: any) => {
      if (!users.find(u => u.fid === user.fid)) {
        users.push(user);
      }
    });

    // Limit to 5 results
    const finalUsers = users.slice(0, 5);
    logger.success('Users found', { count: finalUsers.length });
    logger.end();

    return NextResponse.json({ users: finalUsers });
  } catch (error: any) {
    logger.error('Search failed', error);
    return handleApiError(error, 'GET /search-users');
  }
}
