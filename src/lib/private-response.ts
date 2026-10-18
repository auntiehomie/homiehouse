import { NextResponse } from 'next/server';

/** Entitlements and personalized content must never enter a shared cache. */
export function privateJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Vary', 'x-session-token, x-farcaster-fid, x-signer-key');
  return NextResponse.json(body, { ...init, headers });
}
