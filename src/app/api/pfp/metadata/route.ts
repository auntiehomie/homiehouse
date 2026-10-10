import { NextRequest, NextResponse } from 'next/server';
import { pinataService } from '@/lib/pinata';
import { rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const STYLES: Record<string, string> = {
  campus: 'Campus Classic',
  lounge: 'Creator Lounge',
  night: 'Night Study',
  courtyard: 'Courtyard',
};

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`pfp-metadata:${ip}`, 10, 60 * 60).success) {
    return NextResponse.json({ error: 'Too many mint requests. Try again later.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    if (body?.consent !== true) return NextResponse.json({ error: 'Confirm you want this portrait stored on IPFS.' }, { status: 400 });
    const style = STYLES[String(body?.style || '')];
    const imageBase64 = String(body?.imageBase64 || '');
    const displayName = String(body?.displayName || 'Homie').replace(/[<>\r\n]/g, '').slice(0, 48) || 'Homie';
    if (!style || !/^[A-Za-z0-9+/=]+$/.test(imageBase64) || imageBase64.length > 12_000_000) {
      return NextResponse.json({ error: 'The portrait or style is invalid.' }, { status: 400 });
    }

    const imageBytes = Buffer.from(imageBase64, 'base64');
    if (imageBytes.length < 100 || imageBytes.length > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'The portrait must be under 8 MB.' }, { status: 400 });
    }

    const image = await pinataService.uploadFile(imageBytes, {
      pinataMetadata: { name: `homiefy-pfp-${Date.now()}.png`, keyvalues: { source: 'homiefy-pfp' } },
    });
    const imageUri = `ipfs://${image.IpfsHash}`;
    const metadata = pinataService.createContentMetadata({
      name: `${displayName} — Homiefy PFP`,
      description: `An original Homiehouse digital-campus profile portrait in the ${style} style.`,
      image: imageUri,
      externalUrl: 'https://homiehouse.lol/pfp',
      attributes: [{ trait_type: 'Style', value: style }],
    });
    const uploaded = await pinataService.uploadMetadata(metadata, {
      pinataMetadata: { name: `homiefy-pfp-metadata-${Date.now()}.json`, keyvalues: { source: 'homiefy-pfp' } },
    });

    return NextResponse.json({
      tokenURI: `ipfs://${uploaded.IpfsHash}`,
      imageURI: imageUri,
      imageUrl: image.gatewayUrl,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[pfp-metadata] failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Could not prepare this portrait for minting. Check that IPFS storage is configured.' }, { status: 503 });
  }
}
