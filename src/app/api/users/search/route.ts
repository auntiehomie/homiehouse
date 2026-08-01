import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { searchUsers } from '@/lib/hypersnap';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';

/**
 * Search for Farcaster users by username/display name
 * Used for mention autocomplete functionality
 */
export async function GET(request: NextRequest) {
  const logger = createApiLogger('/users/search');
  logger.start();

  try {

    // Rate limit: 30 requests/minute per IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`users-search:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limitParam = searchParams.get('limit');
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    const limit = limitParam ? Math.min(parseInt(limitParam), 25) : 10;

    logger.info('Searching users', { query, limit });

    const results = await searchUsers(query, limit);
    
    console.log('User search results:', JSON.stringify(results, null, 2));

    logger.success('User search completed', { count: results.users?.length || 0 });
    logger.end();

    // Handle both possible response structures
    const users = results.users || results.result?.users || [];

    return NextResponse.json({
      users: users,
      query
    });
  } catch (error: any) {
    logger.error('User search failed', error);
    return handleApiError(error, 'GET /users/search');
  }
}
