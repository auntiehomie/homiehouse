import { NextRequest, NextResponse } from 'next/server';
import { fetchCast, hypersnapFetch } from '@/lib/hypersnap';

function normalizeHash(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  if (/^0x[\da-f]{40}$/i.test(value)) return value;
  if (/^[\da-f]{40}$/i.test(value)) return `0x${value}`;
  try {
    const bytes = Buffer.from(value, 'base64');
    return bytes.length === 20 ? `0x${bytes.toString('hex')}` : null;
  } catch { return null; }
}

/** Return a small best-effort set of casts liked by authors the viewer likes. */
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const fids = [...new Set((params.get('fids') || '').split(',').map(Number)
    .filter(fid => Number.isSafeInteger(fid) && fid > 0))].slice(0, 3);
  if (!fids.length) return NextResponse.json({ casts: [] });

  const reactions = await Promise.all(fids.map(async fid => {
    try {
      const query = new URLSearchParams({ fid: String(fid), reaction_type: '1', limit: '8' });
      const response = await hypersnapFetch(`/v1/reactionsByFid?${query}`);
      const rows = response?.messages ?? response?.reactions ?? response?.result ?? [];
      return Array.isArray(rows) ? rows : [];
    } catch { return []; }
  }));

  const castHashes = [...new Set(reactions.flatMap(rows => rows.map((row: any) => {
    const message = row?.data ?? row?.message?.data ?? row;
    const body = message?.reaction_body ?? message?.reactionBody ?? row?.reaction_body ?? row?.reactionBody;
    const target = body?.target_cast_id ?? body?.targetCastId ?? body?.target?.cast_id ?? body?.target?.castId;
    return normalizeHash(target?.hash);
  }).filter((hash): hash is string => Boolean(hash))))].slice(0, 12);

  const casts = await Promise.all(castHashes.map(async hash => {
    try { return (await fetchCast(hash))?.cast ?? null; }
    catch { return null; }
  }));
  return NextResponse.json({ casts: casts.filter(Boolean) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
