import { NextRequest, NextResponse } from 'next/server';
import { fetchCast, fetchCastReplies } from '@/lib/hypersnap';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get('hash');

  if (!hash) {
    return NextResponse.json({ ok: false, error: 'Missing hash parameter' }, { status: 400 });
  }

  try {
    const [castData, repliesData] = await Promise.all([
      fetchCast(hash),
      fetchCastReplies(hash, 50),
    ]);

    const cast = castData?.cast ?? castData;
    if (!cast) {
      return NextResponse.json({ ok: false, error: 'Cast not found' }, { status: 404 });
    }

    const replyCasts: any[] = repliesData?.casts ?? [];
    // Merge live reply list into cast so page can show accurate count + thread
    cast.direct_replies = replyCasts;
    if (cast.replies) {
      cast.replies.count = Math.max(cast.replies.count ?? 0, replyCasts.length);
      cast.replies.casts = replyCasts;
    } else {
      cast.replies = { count: replyCasts.length, casts: replyCasts };
    }

    return NextResponse.json({ ok: true, cast });
  } catch (error: any) {
    console.error('[api/cast] error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to fetch cast' },
      { status: 500 }
    );
  }
}
