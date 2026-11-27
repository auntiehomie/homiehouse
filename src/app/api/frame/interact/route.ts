import { NextRequest, NextResponse } from 'next/server';
import { safeFetchPublicUrl } from '@/lib/safe-public-fetch';
import { verifyFarcasterSignerAuth, verifyFarcasterSignerPublicKey } from '@/lib/auth';
import { AuthError } from '@/lib/errors';
import { Message, MessageData, MessageType } from '@farcaster/hub-nodejs';
import { ed25519 } from '@noble/curves/ed25519';
import { blake3_20, farcasterTimestamp } from '@/lib/fc-message-builder';

const MAX_TRUSTED_MESSAGE_BYTES = 4096;
const MAX_FRAME_ACTION_AGE_SECONDS = 10 * 60;

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Verify a frame action signed in the browser. Returns the signer public key
 * (0x hex) when the message is a fresh FRAME_ACTION for `fid` that matches the
 * requested url, button, input and cast; throws otherwise.
 */
function verifyBrowserSignedFrameAction(
  messageHex: string,
  expected: { fid: number; url: string; buttonIndex: number; inputText: string; castHash: string },
): `0x${string}` {
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(messageHex) || messageHex.length / 2 > MAX_TRUSTED_MESSAGE_BYTES) {
    throw new AuthError('Signed frame action is malformed', 400, 'INVALID_FRAME_ACTION');
  }
  const message = Message.decode(Buffer.from(messageHex, 'hex'));
  const dataBytes = message.dataBytes;
  if (!dataBytes?.length || !message.signer?.length || !message.signature?.length || !message.hash?.length) {
    throw new AuthError('Signed frame action is incomplete', 400, 'INVALID_FRAME_ACTION');
  }
  if (!bytesEqual(blake3_20(dataBytes), message.hash) || !ed25519.verify(message.signature, message.hash, message.signer)) {
    throw new AuthError('Frame action signature is invalid', 401, 'INVALID_FRAME_ACTION');
  }

  const data = MessageData.decode(dataBytes);
  const body = data.frameActionBody;
  const decoder = new TextDecoder();
  const expectedHash = expected.castHash
    ? Buffer.from(expected.castHash.slice(2), 'hex')
    : Buffer.alloc(20);
  if (
    data.type !== MessageType.FRAME_ACTION || data.fid !== expected.fid || !body ||
    decoder.decode(body.url) !== expected.url || body.buttonIndex !== expected.buttonIndex ||
    decoder.decode(body.inputText) !== expected.inputText ||
    !body.castId || !bytesEqual(body.castId.hash, expectedHash) ||
    Math.abs(farcasterTimestamp() - data.timestamp) > MAX_FRAME_ACTION_AGE_SECONDS
  ) {
    throw new AuthError('Signed frame action does not match this request', 400, 'INVALID_FRAME_ACTION');
  }
  return `0x${Buffer.from(message.signer).toString('hex')}`;
}

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

  const { postUrl, buttonIndex = 1, inputText = '', castHash = '', trustedMessageBytes } = body;
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

  // Signed actions are built and signed in the browser; the signer private
  // key is never sent here. Unsigned actions still work for open frames.
  let fid = 0;
  if (trustedMessageBytes !== undefined) {
    try {
      if (typeof trustedMessageBytes !== 'string') throw new AuthError('Signed frame action is malformed', 400, 'INVALID_FRAME_ACTION');
      fid = await verifyFarcasterSignerAuth(request, 'write:casts');
      const signerPublicKey = verifyBrowserSignedFrameAction(trustedMessageBytes, {
        fid, url: body.url, buttonIndex, inputText, castHash,
      });
      await verifyFarcasterSignerPublicKey(fid, signerPublicKey);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      return NextResponse.json({ error: 'Frame signer verification failed' }, { status: 401 });
    }
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

  if (fid && typeof trustedMessageBytes === 'string') {
    frameBody.trustedData = { messageBytes: trustedMessageBytes.toLowerCase() };
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
