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
      fetchCastReplies(hash, 50).catch(() => null),
    ]);

    const cast = castData?.cast ?? castData;
    if (!cast) {
      return NextResponse.json({ ok: false, error: 'Cast not found' }, { status: 404 });
    }

    const replyCasts: any[] = repliesData?.casts ?? [];
    cast.direct_replies = replyCasts;
    if (cast.replies) {
      cast.replies.count = Math.max(cast.replies.count ?? 0, replyCasts.length);
      cast.replies.casts = replyCasts;
    } else {
      cast.replies = { count: replyCasts.length, casts: replyCasts };
    }

    // Walk up parent chain to show full thread context
    const parentChain: any[] = [];
    let current = cast;
    for (let i = 0; i < 10 && current?.parent_hash; i++) {
      try {
        const parentData = await fetchCast(current.parent_hash);
        const parent = parentData?.cast ?? parentData;
        if (!parent) break;
        parentChain.unshift(parent);
        current = parent;
      } catch {
        break;
      }
    }
    cast.parent_chain = parentChain;

    return NextResponse.json({ ok: true, cast });
  } catch (error: any) {
    console.error('[api/cast] error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to fetch cast' },
      { status: 500 }
    );
  }
}
