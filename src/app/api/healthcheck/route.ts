import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/healthcheck
 * Returns basic health status and environment variable checks.
 * Useful for post-deploy verification on Vercel.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env_check: {
      pinata: !!process.env.PINATA_JWT,
      openai: !!process.env.OPENAI_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      farcaster: !!(process.env.APP_FID && process.env.APP_MNEMONIC),
    },
  });
}
