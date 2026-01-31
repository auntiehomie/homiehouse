import { NextRequest, NextResponse } from 'next/server';
import { getTokenData, searchTokens, formatTokenDisplay } from '@/lib/token-data';

/**
 * GET /api/tokens/search?q=ethereum&limit=10
 * Search for tokens by name, symbol, or address
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    const results = await searchTokens(query, limit);

    return NextResponse.json({
      success: true,
      count: results.length,
      tokens: results,
    });
  } catch (error) {
    console.error('Token search error:', error);
    return NextResponse.json(
      { error: 'Failed to search tokens' },
      { status: 500 }
    );
  }
}
