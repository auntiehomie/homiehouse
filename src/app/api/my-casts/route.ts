import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

const HYPERSNAP_BASE =
  process.env.NEXT_PUBLIC_HYPERSNAP_URL || 'https://haatz.quilibrium.com';

const PAGE_SIZE = 100;
const MAX_PAGES = 20; // up to 2000 casts

// GET /api/my-casts?fid=12345
// Paginates through all casts for the user, up to MAX_PAGES * PAGE_SIZE
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fid = parseInt(searchParams.get('fid') ?? '', 10);

  if (!fid || isNaN(fid)) {
    return NextResponse.json({ error: 'fid required' }, { status: 400 });
  }

  try {
    const allCasts: any[] = [];
    let pageToken: string | null = null;
    let pages = 0;

    while (pages < MAX_PAGES) {
      const url = new URL(`${HYPERSNAP_BASE}/v1/castsByFid`);
      url.searchParams.set('fid', String(fid));
      url.searchParams.set('pageSize', String(PAGE_SIZE));
      url.searchParams.set('reverse', '1');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const hubRes = await fetch(url.toString(), {
        headers: { accept: 'application/json' },
      });

      if (!hubRes.ok) {
        return NextResponse.json({ error: `Hub error ${hubRes.status}` }, { status: 502 });
      }

      const data = await hubRes.json();
      const messages: any[] = data.messages ?? [];

      const casts = messages
        .filter((m: any) => m.data?.type === 'MESSAGE_TYPE_CAST_ADD')
        .map((m: any) => ({
          hash: m.hash,
          text: m.data?.castAddBody?.text ?? '',
          timestamp: m.data?.timestamp,
        }));

      allCasts.push(...casts);
      pages++;

      // Stop if no next page token or no results
      if (!data.nextPageToken || messages.length === 0) break;
      pageToken = data.nextPageToken;
    }

    return NextResponse.json({ casts: allCasts, total: allCasts.length });
  } catch (err: any) {
    console.error('[my-casts] error:', err?.message);
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
