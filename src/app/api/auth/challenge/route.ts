import { NextResponse } from 'next/server'

/**
 * GET /api/auth/challenge
 *
 * Returns a timestamp + random nonce that the client can sign to prove
 * Farcaster key-possession (submit the signed message to /api/auth/verify).
 */
export async function GET() {
  const timestamp = Math.floor(Date.now() / 1000)
  const nonce = crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

  return NextResponse.json({
    challenge: `homiehouse-auth-${timestamp}-${nonce}`,
    timestamp,
    nonce,
  })
}