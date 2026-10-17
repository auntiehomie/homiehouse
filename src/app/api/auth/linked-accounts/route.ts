import { NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { rateLimit } from '@/lib/ratelimit';
import { createHypersnapProtocolAuthClient } from '@/lib/hypersnap-protocol-auth';

export const dynamic = 'force-dynamic';
const authClient = createHypersnapProtocolAuthClient();

export async function GET(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  const { success } = rateLimit(`hypersnap-linked-accounts:${ip}`, 20, 60);
  if (!success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const address = new URL(request.url).searchParams.get('address');
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: 'A valid wallet address is required.' }, { status: 400 });
  }

  try {
    const accounts = await authClient.linkedAccounts(address);
    return NextResponse.json({ accounts }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    const unavailable = error?.name === 'HubError';
    return NextResponse.json(
      { error: unavailable ? 'Hypersnap account lookup is temporarily unavailable.' : 'No linked Hypersnap accounts were found for this wallet.' },
      { status: unavailable ? 503 : 404 },
    );
  }
}
