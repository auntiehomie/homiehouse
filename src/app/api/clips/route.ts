import { NextRequest, NextResponse } from 'next/server';
import { hypersnapFetch, fallbackFetch } from '@/lib/hypersnap';
import { CLIPS_PARENT, clipVideoUrl, type Clip } from '@/lib/clips';

type Message = { hash?: string; data?: { fid?: number; castAddBody?: { text?: string; embeds?: { url?: string }[] } } };

export async function GET(request: NextRequest) {
  const query = new URLSearchParams({ url: CLIPS_PARENT, pageSize: '20', reverse: 'true' });
  const cursor = request.nextUrl.searchParams.get('cursor');
  if (cursor && cursor.length > 512) return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
  if (cursor) query.set('pageToken', cursor);
  const path = `/v1/castsByParent?${query}`;
  try {
    let page = await hypersnapFetch(path, { cache: 'no-store' }).catch(() => null);
    if (!Array.isArray(page?.messages)) page = await fallbackFetch(path, { cache: 'no-store' });
    if (!Array.isArray(page?.messages)) throw new Error();
    const clips: Clip[] = [];
    for (const message of page.messages as Message[]) {
      const body = message.data?.castAddBody;
      const url = body?.embeds?.find(embed => clipVideoUrl(embed?.url))?.url;
      if (message.hash && message.data?.fid && url) clips.push({ hash: message.hash, fid: message.data.fid, caption: body?.text || '', url });
    }
    return NextResponse.json({ clips, cursor: page.nextPageToken || null });
  } catch {
    return NextResponse.json({ error: 'Clips could not be loaded.' }, { status: 502 });
  }
}
