/**
 * DEPRECATED — use the useFarcasterWrites() hook instead.
 *
 * The client-side hook builds signed Farcaster reaction messages locally and
 * submits them through /api/submit-cast, which provides true cryptographic
 * proof-of-key-possession for each interaction.
 *
 * This route accepted raw { fid } from the request body with no server-side
 * cryptographic verification, making it trivially spoofable (IDOR).
 *
 * It is removed rather than fixed because the replacement useFarcasterWrites
 * hook already covers all like/unlike operations client-side with real Ed25519
 * signatures verified by the Farcaster hub — a strictly stronger security model
 * than any server-side proxy could achieve.
 */

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Use the useFarcasterWrites() hook for signed reactions.' },
    { status: 410 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Use the useFarcasterWrites() hook for signed reactions.' },
    { status: 410 }
  );
}