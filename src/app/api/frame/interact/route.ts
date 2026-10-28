import { NextRequest, NextResponse } from 'next/server';
import { safeFetchPublicUrl } from '@/lib/safe-public-fetch';
import { verifyFarcasterSignerAuth, verifyFarcasterSignerKey } from '@/lib/auth';
import { AuthError } from '@/lib/errors';
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

  const { postUrl, buttonIndex = 1, inputText = '', castHash = '' } = body;
  let fid = 0;
  const privateKeyHex = request.headers.get('x-signer-key');

  if (privateKeyHex) {
    try {
      fid = await verifyFarcasterSignerAuth(request, 'write:casts');
      await verifyFarcasterSignerKey(fid, privateKeyHex);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      return NextResponse.json({ error: 'Frame signer verification failed' }, { status: 401 });
    }
  }

  if (typeof body.url !== 'string' || body.url.length > 2048 || typeof postUrl !== 'string' || postUrl.length > 2048
    || !Number.isInteger(buttonIndex) || buttonIndex < 1 || buttonIndex > 4
    || typeof inputText !== 'string' || inputText.length > 1000
    || (castHash && (typeof castHash !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(castHash)))) {
    return NextResponse.json({ isFrame: false, error: 'A valid frame URL is required' }, { status: 400 });
  }
  try {
    const frameUrl = new URL(body.url);
    if (!['http:', 'https:'].includes(frameUrl.protocol)) throw new Error('Invalid frame URL protocol');
  } catch {
    return NextResponse.json({ isFrame: false, error: 'A valid frame URL is required' }, { status: 400 });
  }

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
    const res = await safeFetchPublicUrl(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'farcasterbot/1.0',
        Accept: 'text/html,application/json',
      },
      body: JSON.stringify(frameBody),
      maxBytes: 1024 * 1024,
      maxRedirects: 3,
      timeoutMs: 8000,
    });

    if (!res.ok) {
      return NextResponse.json(
        { isFrame: false, error: `Error ${res.status}`, httpStatus: res.status },
        { status: 422 },
      );
    }

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
  } catch {
    return NextResponse.json({ isFrame: false, error: 'Unable to fetch that frame destination' }, { status: 422 });
  }
}
