import { NextRequest, NextResponse } from 'next/server';
import { fetchCast, fetchCastConversation } from '@/lib/hypersnap';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get('hash');

  if (!hash) {
    return NextResponse.json({ ok: false, error: 'Missing hash parameter' }, { status: 400 });
  }

  try {
    // Fetch cast + conversation (replies) in parallel
    const [castData, convData] = await Promise.all([
      fetchCast(hash),
      fetchCastConversation(hash).catch(() => null),
    ]);

    const cast = castData?.cast ?? castData;
    if (!cast) {
      return NextResponse.json({ ok: false, error: 'Cast not found' }, { status: 404 });
    }

    // Normalize reaction counts — raw hub returns arrays; Neynar proxy returns _count fields
    const rxn = cast.reactions ?? {};
    if (rxn.likes_count == null && Array.isArray(rxn.likes)) {
      rxn.likes_count = rxn.likes.length;
    }
    if (rxn.recasts_count == null && Array.isArray(rxn.recasts)) {
      rxn.recasts_count = rxn.recasts.length;
    }
    cast.reactions = rxn;

    // Use replies from conversation endpoint when available (parent_hash filter often unsupported)
    const convCast = convData?.conversation?.cast;
    const replyCasts: any[] =
      convCast?.direct_replies ??
      convCast?.replies?.casts ??
      [];

    cast.direct_replies = replyCasts;
    const knownCount = cast.replies?.count ?? 0;
    const convCount = convCast?.replies?.count ?? 0;
    cast.replies = {
      count: Math.max(knownCount, convCount, replyCasts.length),
      casts: replyCasts,
    };

    // Walk up parent chain to show full thread context
    const parentChain: any[] = [];
    let current = cast;
    for (let i = 0; i < 5 && current?.parent_hash; i++) {
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

    return NextResponse.json({ ok: true, cast }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } });
  } catch (error: any) {
    console.error('[api/cast] error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to fetch cast' },
      { status: 500 }
    );
  }
}
