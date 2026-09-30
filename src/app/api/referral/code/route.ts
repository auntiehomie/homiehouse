import { NextRequest, NextResponse } from 'next/server';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { getSql } from '@/lib/db';

const logger = createApiLogger('/referral/code');

// Ensure referral tables exist (idempotent)
async function ensureReferralTables() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS referral_codes (
      fid INTEGER PRIMARY KEY,
      referral_code TEXT UNIQUE NOT NULL,
      uses INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS referral_bonuses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      referrer_fid INTEGER NOT NULL,
      referred_fid INTEGER NOT NULL,
      claimed BOOLEAN DEFAULT FALSE,
      claimed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(referred_fid)
    )
  `;
  // Create index for fast lookups
  await sql`
    CREATE INDEX IF NOT EXISTS idx_referral_bonuses_referrer
    ON referral_bonuses(referrer_fid)
  `;
}

function generateCode(): string {
  // 8-character alphanumeric code, human-friendly (no ambiguous chars)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/referral/code — get or generate the authenticated user's referral code
export async function GET(req: NextRequest) {
  try {
    const authFid = await verifyFarcasterSignerAuth(req);
    await ensureReferralTables();
    const sql = getSql();

    // Check if user already has a code
    const existing = await sql`
      SELECT referral_code, uses, created_at FROM referral_codes WHERE fid = ${authFid}
    `;

    if (existing.length > 0) {
      return NextResponse.json({
        ok: true,
        referralCode: existing[0].referral_code,
        uses: existing[0].uses,
        createdAt: existing[0].created_at,
      });
    }

    // Generate new code (retry on collision)
    let code = generateCode();
    let attempts = 0;
    while (attempts < 5) {
      const collision = await sql`SELECT 1 FROM referral_codes WHERE referral_code = ${code}`;
      if (collision.length === 0) break;
      code = generateCode();
      attempts++;
    }

    await sql`
      INSERT INTO referral_codes (fid, referral_code) VALUES (${authFid}, ${code})
    `;

    return NextResponse.json({
      ok: true,
      referralCode: code,
      uses: 0,
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    logger.error('GET error', err?.message);
    return NextResponse.json({ ok: false, error: 'Failed to get referral code' }, { status: 500 });
  }
}