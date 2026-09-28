import { NextResponse } from 'next/server';

/**
 * This endpoint previously derived and returned the bot signer private key.
 * Keep the path explicitly blocked so stale clients and accidental reintroductions
 * cannot provision custody material through an unauthenticated request.
 */
function blocked() {
  return NextResponse.json(
    { ok: false, error: 'Bot signer provisioning is disabled' },
    { status: 403 },
  );
}

export const GET = blocked;
export const POST = blocked;
export const PUT = blocked;
export const PATCH = blocked;
export const DELETE = blocked;
export const OPTIONS = blocked;
export const HEAD = blocked;
