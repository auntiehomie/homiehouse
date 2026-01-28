import { NextRequest, NextResponse } from 'next/server';
import { searchUsers } from '@/lib/neynar';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';

const HOMIEHOUSE_FID = 1987078;

export async function GET(request: NextRequest) {
  const logger = createApiLogger('/search-users');
  logger.start();

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      logger.end();
      return NextResponse.json({ users: [] });
    }

    logger.info('Searching users', { query: query.substring(0, 50) });

    // Always include @homiehouse if query matches
    const queryLower = query.toLowerCase();
    const includeHomie = 'homiehouse'.includes(queryLower) || queryLower.includes('homie');
    
    let users: any[] = [];

    // If searching for homiehouse, fetch it directly first
    if (includeHomie) {
      try {
        const { neynarFetch } = await import('@/lib/neynar');
        const homieData = await neynarFetch(`/user/bulk?fids=${HOMIEHOUSE_FID}`);
        if (homieData.users && homieData.users.length > 0) {
          users.push(homieData.users[0]);
        }
      } catch (e) {
        logger.warn('Could not fetch homiehouse user', { error: String(e) });
      }
    }

    // Search users using shared utility
    const searchResults = await searchUsers(query, 5);
    const resultUsers = searchResults.result?.users || [];
    
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
  }
}
