import { NextRequest, NextResponse } from 'next/server';
import { fetchFollowStatus } from '@/lib/hypersnap';

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

  if (!/^[1-9]\d*$/.test(fid) || !/^[1-9]\d*$/.test(targetFid)) {
    return NextResponse.json({ error: 'fid and target_fid must be positive integers' }, { status: 400 });
  }

  const viewerFid = Number(fid);
  const profileFid = Number(targetFid);
  if (!Number.isSafeInteger(viewerFid) || !Number.isSafeInteger(profileFid)) {
    return NextResponse.json({ error: 'fid and target_fid must be safe integers' }, { status: 400 });
  }

  try {
    const following = await fetchFollowStatus(viewerFid, profileFid);
    return NextResponse.json({ following }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // A node outage is not proof that the user is not following this profile.
    return NextResponse.json(
      { following: null, error: 'Follow status is temporarily unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
