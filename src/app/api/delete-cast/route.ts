import { NextResponse } from 'next/server';

/**
 * Cast removals are signed in the browser and sent through /api/submit-cast.
 * This explicit response prevents older clients from sending signer private
 * keys to the server-side deletion endpoint.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Use a locally signed CAST_REMOVE message with /api/submit-cast' },
    { status: 410 },
  );
}
