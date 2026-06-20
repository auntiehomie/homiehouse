import { NextRequest, NextResponse } from 'next/server';
import { searchCasts } from '@/lib/hypersnap';
import { handleApiError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = Math.min(Number(searchParams.get('limit') || '20'), 50);

    if (!query) {
      return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    }

    const results = await searchCasts(query, limit);
    const casts = results.casts || results.result?.casts || [];

    return NextResponse.json({ casts, query });
  } catch (error: any) {
    return handleApiError(error, 'GET /casts/search');
  }
}
