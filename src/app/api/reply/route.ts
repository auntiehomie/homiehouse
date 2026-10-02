/**
 * DEPRECATED — use the useFarcasterWrites() hook instead.
 *
 * The client-side hook builds signed Farcaster cast messages locally and
 * submits them through /api/submit-cast with real Ed25519 proof-of-key-possession.
 *
 * This route accepted raw { fid } from the request body with no cryptographic
 * verification, making it an IDOR vulnerability.
 *
 * @see /api/like/route.ts for detailed rationale.
 */

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Use the useFarcasterWrites() hook for signed replies.' },
    { status: 410 }
  );
}