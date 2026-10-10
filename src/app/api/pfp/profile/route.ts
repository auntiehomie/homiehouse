import { NextRequest, NextResponse } from 'next/server';
import { fetchUserByUsername } from '@/lib/hypersnap';
import { rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';

function normalizeHandle(value: string | null): string {
  return (value || '').trim().replace(/^@/, '');
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`pfp-profile:${ip}`, 30, 60).success) {
    return NextResponse.json({ error: 'Too many profile lookups. Try again shortly.' }, { status: 429 });
  }

  const params = request.nextUrl.searchParams;
  const platform = params.get('platform');
  const username = normalizeHandle(params.get('username'));
  if (!/^[a-zA-Z0-9_]{1,30}$/.test(username)) {
    return NextResponse.json({ error: 'Enter a valid username.' }, { status: 400 });
  }

  try {
    if (platform === 'farcaster') {
      const result = await fetchUserByUsername(username);
      const user = result?.user;
      if (!user?.pfp_url) return NextResponse.json({ error: 'Farcaster profile not found.' }, { status: 404 });
      return NextResponse.json({
        platform,
        username: user.username || username,
        displayName: user.display_name || user.username || username,
        profileImageUrl: user.pfp_url,
        fid: Number(user.fid || user.id || 0),
      }, { headers: { 'Cache-Control': 'private, max-age=60' } });
    }

    if (platform === 'x') {
      const token = process.env.X_API_USER_ACCESS_TOKEN;
      if (!token) {
        return NextResponse.json({ error: 'X profile lookup is not configured yet. Upload your X profile picture instead.' }, { status: 503 });
      }
      const response = await fetch(
        `https://api.x.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=profile_image_url,name,username`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) }
      );
      const body = await response.json().catch(() => ({}));
      const user = body?.data;
      if (!response.ok || !user?.profile_image_url) {
        return NextResponse.json({ error: 'Could not load that X profile. Check the handle or upload its picture.' }, { status: response.status === 429 ? 429 : 404 });
      }
      return NextResponse.json({
        platform,
        username: user.username || username,
        displayName: user.name || user.username || username,
        profileImageUrl: String(user.profile_image_url).replace('_normal.', '_400x400.'),
      }, { headers: { 'Cache-Control': 'private, max-age=60' } });
    }

    return NextResponse.json({ error: 'Choose Farcaster or X.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Profile lookup failed. Try again or upload a picture.' }, { status: 502 });
  }
}
