import { NextRequest, NextResponse } from 'next/server';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/ratelimit';
import { CLIP_FORMATS, CLIP_LIMIT } from '@/lib/clips';

export async function POST(request: NextRequest) {
  try {
    const fid = await verifyFarcasterSignerAuth(request, 'write:casts');
    if (!(await checkRateLimit(`clip-upload:${fid}`, 10, 3600)).success) {
      return NextResponse.json({ error: 'Upload limit reached. Try again later.' }, { status: 429 });
    }
    if (!process.env.PINATA_JWT) return NextResponse.json({ error: 'Video storage is unavailable.' }, { status: 503 });
    const result = await fetch('https://uploads.pinata.cloud/v3/files/sign', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.PINATA_JWT}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ network: 'public', date: Math.floor(Date.now() / 1000), expires: 120,
        max_file_size: CLIP_LIMIT, allow_mime_types: Object.keys(CLIP_FORMATS), keyvalues: { fid: String(fid) } }),
      cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    if (!result.ok) throw new Error();
    const { data } = await result.json();
    if (typeof data !== 'string' || !data.startsWith('https://')) throw new Error();
    return NextResponse.json({ url: data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Could not prepare video upload. Try again.' }, { status: 502 });
  }
}
