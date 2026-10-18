import { NextResponse } from 'next/server';

const migrationResponse = () => NextResponse.json({
  ok: false,
  error: 'This legacy Farcaster signer endpoint is retired. Use the custody-signed Hypersnap flow at /api/hypersnap/signer.',
  replacement: '/api/hypersnap/signer',
}, { status: 410 });

/** Retired Warpcast Signed Key Request endpoint. */
export async function POST() {
  return migrationResponse();
}

/** Retired Warpcast signer status endpoint. */
export async function GET() {
  return migrationResponse();
}
