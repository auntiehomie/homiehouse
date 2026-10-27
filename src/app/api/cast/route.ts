import { fetchDirectReplies } from '@/lib/cast-replies';
import { NextRequest, NextResponse } from 'next/server';
import { fetchCast, fetchCastConversation, getCastsByUsername } from '@/lib/hypersnap';

// A full Snapchain cast hash is 20 bytes → "0x" + 40 hex chars.
const FULL_HASH_LEN = 42;

/** Hypersnap responses can expose the parent cast reference in either the
 * normalized API shape or the underlying Snapchain shape. */
function getParentCastHash(cast: any): string | null {
  const parent = cast?.parent_cast_id ?? cast?.parentCastId ?? cast?.parent_cast ?? cast?.parentCast;
  const value = cast?.parent_hash
    ?? cast?.parentHash
    ?? parent?.hash
    ?? parent?.cast_id?.hash
    ?? parent?.castId?.hash;

  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get('hash');
  const username = searchParams.get('username');
  const repliesCursor = searchParams.get('replies_cursor') || undefined;

  if (!hash) {
    return NextResponse.json({ ok: false, error: 'Missing hash parameter' }, { status: 400 });
  }

  // Short hash (e.g. from a farcaster.xyz/<user>/0x<8hex> link). The node can't
  // resolve partial hashes — a `type=hash` lookup just times out — so best-effort
  // match it against the author's recent casts by hash prefix. Fails fast to a
  // 404 (the embed then shows a tappable "open on Farcaster" card).
  if (/^0x[a-f0-9]+$/i.test(hash) && hash.length < FULL_HASH_LEN) {
    if (!username) {
      return NextResponse.json({ ok: false, error: 'Short hash needs a username to resolve' }, { status: 404 });
    }
    try {
      const data = await getCastsByUsername(username, 50);
      const casts: any[] = data?.casts ?? [];
      const prefix = hash.toLowerCase().replace(/^0x/, '');
      const match = casts.find(
        (c: any) => (c.hash || '').toLowerCase().replace(/^0x/, '').startsWith(prefix)
      );
      if (match) {
        return NextResponse.json(
          { ok: true, cast: match },
          { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
        );
      }
    } catch (err: any) {
      console.warn('[api/cast] short-hash resolve failed:', err?.message);
    }
    return NextResponse.json({ ok: false, error: 'Cast not found' }, { status: 404 });
  }

  try {
    const castData = await fetchCast(hash);

    const cast = castData?.cast;
    if (!cast) {
      return NextResponse.json({ ok: false, error: 'Cast not found' }, { status: 404 });
    }

    // Normalize reaction counts — raw hub returns arrays; some proxies return _count fields
    const rxn = cast.reactions ?? {};
    if (rxn.likes_count == null && Array.isArray(rxn.likes)) {
      rxn.likes_count = rxn.likes.length;
    }
    if (rxn.recasts_count == null && Array.isArray(rxn.recasts)) {
      rxn.recasts_count = rxn.recasts.length;
    }
    cast.reactions = rxn;

    // Page direct replies from the hub; use the bounded conversation service only as a fallback.
    let convCast: any = null;
    let replyCasts: any[] = [];

    let repliesNext = null;
    let repliesUnavailable = false;
    try {
      const page = await fetchDirectReplies(cast.author.fid, hash, repliesCursor);
      replyCasts = page.casts;
      repliesNext = page.next;
    } catch {
      // Keep the conversation result if the raw hub API is unavailable.
      // Never turn a failed subsequent page into a successful empty page.
      if (repliesCursor) throw new Error('Failed to load reply page');
      const conversation = await fetchCastConversation(hash).catch(() => null);
      convCast = conversation?.conversation?.cast;
      replyCasts = convCast?.direct_replies ?? convCast?.replies?.casts ?? [];
      repliesUnavailable = true;
    }
    cast.replies_next = repliesNext;
    cast.replies_unavailable = repliesUnavailable;
    cast.direct_replies = replyCasts;
    const knownCount = cast.replies?.count ?? 0;
    const convCount = convCast?.replies?.count ?? 0;
    cast.replies = {
      count: Math.max(knownCount, convCount, replyCasts.length),
      casts: replyCasts,
    };

    // Walk up the parent references to show thread context above the opened
    // cast. Hypersnap may return normalized parent_hash fields or the native
    // Snapchain parentCastId shape; relying on parent_hash alone hid the
    // parent when a reply was opened directly from a feed.
    const parentChain: any[] = [];
    let current = cast;
    const seenParentHashes = new Set<string>([String(cast.hash || '').toLowerCase()]);
    for (let i = 0; i < 5; i++) {
      const parentHash = getParentCastHash(current);
      if (!parentHash || seenParentHashes.has(parentHash.toLowerCase())) break;
      seenParentHashes.add(parentHash.toLowerCase());
      try {
        const parentData = await fetchCast(parentHash);
        const parent = parentData?.cast ?? parentData;
        if (!parent) break;
        parentChain.unshift(parent);
        current = parent;
      } catch {
        break;
      }
    }
    cast.parent_chain = parentChain;

    return NextResponse.json({ ok: true, cast }, { headers: { 'Cache-Control': repliesUnavailable ? 'no-store' : 'public, s-maxage=30, stale-while-revalidate=60' } });
  } catch (error: any) {
    console.error('[api/cast] error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to fetch cast' },
      { status: 500 }
    );
  }
}
