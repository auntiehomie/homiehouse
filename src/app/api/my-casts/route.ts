import { NextRequest, NextResponse } from 'next/server';
import { fetchFromHypersnapNodes, getHypersnapNodes, type HypersnapNode } from '@/lib/hypersnap-nodes';

export const maxDuration = 30;

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
    // Page tokens belong to the node that issued them, so once a node answers
    // the first page, keep paginating on that node.
    let nodes: HypersnapNode[] = getHypersnapNodes();

    while (pages < MAX_PAGES) {
      const query = new URLSearchParams({ fid: String(fid), pageSize: String(PAGE_SIZE), reverse: '1' });
      if (pageToken) query.set('pageToken', pageToken);

      const { response: hubRes, node } = await fetchFromHypersnapNodes(`/v1/castsByFid?${query}`, {
        nodes, timeoutMs: 8_000, label: 'my-casts',
      });
      nodes = [node];

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
