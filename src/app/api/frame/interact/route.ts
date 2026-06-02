import { NextRequest, NextResponse } from 'next/server';
import {
  makeFrameAction,
  NobleEd25519Signer,
  FrameActionBody,
  Message,
  FarcasterNetwork,
} from '@farcaster/hub-nodejs';

function extractMeta(html: string, property: string): string | null {
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

/**
 * Proxy for Farcaster Frame POST interactions.
 * Sends an unsigned frame action (works for open/public frames).
 * Frames that require signed auth will respond with an error — acceptable limitation.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.url || !body?.postUrl) {
    return NextResponse.json({ isFrame: false, error: 'url and postUrl required' }, { status: 400 });
  }

  const { postUrl, buttonIndex = 1, inputText = '', castHash = '', privateKeyHex, fid } = body;

  const frameBody: any = {
    untrustedData: {
      fid: fid || 0,
      url: body.url,
      buttonIndex,
      inputText,
      castId: { fid: fid || 0, hash: castHash || '0x0000000000000000000000000000000000000000' },
      timestamp: Math.floor(Date.now() / 1000),
      network: 1,
    },
    trustedData: { messageBytes: '' },
  };

  // Sign the frame action if the user's private key and FID are available
  if (privateKeyHex && fid) {
    try {
      const privateKeyBytes = Buffer.from(privateKeyHex.replace('0x', ''), 'hex');
      const signer = new NobleEd25519Signer(privateKeyBytes);

      const hashBytes = castHash
        ? Buffer.from(castHash.replace('0x', ''), 'hex')
        : Buffer.alloc(20);

      const frameActionBody = FrameActionBody.create({
        url: Buffer.from(body.url),
        buttonIndex,
        castId: { fid, hash: hashBytes },
        inputText: Buffer.from(inputText),
        state: Buffer.alloc(0),
      });

      const result = await makeFrameAction(
        frameActionBody,
        { fid, network: FarcasterNetwork.MAINNET },
        signer,
      );

      if (result.isOk()) {
        const messageBytes = Buffer.from(Message.encode(result.value).finish()).toString('hex');
        frameBody.trustedData = { messageBytes };
      }
    } catch {
      // Fall through with unsigned action
    }
  }

  try {
    const res = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'farcasterbot/1.0',
        Accept: 'text/html,application/json',
      },
      body: JSON.stringify(frameBody),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { isFrame: false, error: `Error ${res.status}`, httpStatus: res.status },
        { status: 422 },
      );
    }

    const contentType = res.headers.get('content-type') || '';
    const html = await res.text();

    const version = extractMeta(html, 'fc:frame');
    if (!version) return NextResponse.json({ isFrame: false });

    const image = extractMeta(html, 'fc:frame:image') ?? extractMeta(html, 'og:image') ?? '';
    const nextPostUrl = extractMeta(html, 'fc:frame:post_url');
    const nextInputText = extractMeta(html, 'fc:frame:input:text');

    const buttons = [];
    for (let i = 1; i <= 4; i++) {
      const label = extractMeta(html, `fc:frame:button:${i}`);
      if (!label) break;
      const action = extractMeta(html, `fc:frame:button:${i}:action`) ?? 'post';
      const target = extractMeta(html, `fc:frame:button:${i}:target`);
      buttons.push({ index: i, label, action, target });
    }

    return NextResponse.json({
      isFrame: true,
      frame: { version, image, postUrl: nextPostUrl, inputText: nextInputText, buttons },
    });
  } catch (e: any) {
    return NextResponse.json({ isFrame: false, error: e.message }, { status: 500 });
  }
}
