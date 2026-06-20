import { NextRequest, NextResponse } from 'next/server';

const HYPERSNAP_BASE =
  process.env.NEXT_PUBLIC_HYPERSNAP_URL || 'https://haatz.quilibrium.com';

/**
 * Check if viewerFid follows targetFid on Farcaster.
 * GET ?fid={viewerFid}&target_fid={profileFid}
 * Returns { following: boolean }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get('fid');
  const targetFid = searchParams.get('target_fid');

  if (!fid || !targetFid) {
    return NextResponse.json({ error: 'fid and target_fid required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${HYPERSNAP_BASE}/v1/linkById?fid=${fid}&target_fid=${targetFid}&link_type=follow`,
      { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(5000) }
    );
    return NextResponse.json({ following: res.ok });
  } catch {
    return NextResponse.json({ following: false });
  }
}
