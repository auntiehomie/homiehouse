import { NextRequest, NextResponse } from 'next/server';

function extractMeta(html: string, property: string): string | null {
  // Match <meta property="..." content="..."> or name= variant
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    'i'
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    'i'
  );
  return (html.match(re) || html.match(re2))?.[1] ?? null;
}

export interface FrameData {
  version: string;
  image: string;
  postUrl: string | null;
  inputText: string | null;
  buttons: Array<{
    index: number;
    label: string;
    action: string;
    target: string | null;
  }>;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ isFrame: false });

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'farcasterbot/1.0',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return NextResponse.json({ isFrame: false });
    const html = await res.text();

    const version = extractMeta(html, 'fc:frame');
    if (!version) return NextResponse.json({ isFrame: false });

    const image = extractMeta(html, 'fc:frame:image') ?? extractMeta(html, 'og:image') ?? '';
    const postUrl = extractMeta(html, 'fc:frame:post_url');
    const inputText = extractMeta(html, 'fc:frame:input:text');

    const buttons = [];
    for (let i = 1; i <= 4; i++) {
      const label = extractMeta(html, `fc:frame:button:${i}`);
      if (!label) break;
      const action = extractMeta(html, `fc:frame:button:${i}:action`) ?? 'post';
      const target = extractMeta(html, `fc:frame:button:${i}:target`);
      buttons.push({ index: i, label, action, target });
    }

    return NextResponse.json({ isFrame: true, frame: { version, image, postUrl, inputText, buttons } });
  } catch {
    return NextResponse.json({ isFrame: false });
  }
}
