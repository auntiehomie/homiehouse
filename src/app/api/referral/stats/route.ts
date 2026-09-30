import { NextRequest, NextResponse } from 'next/server';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { getSql } from '@/lib/db';

const logger = createApiLogger('/referral/stats');

// GET /api/referral/stats — get the authenticated user's referral stats
export async function GET(req: NextRequest) {
  try {
    const authFid = await verifyFarcasterSignerAuth(req);
    const sql = getSql();

    // Get user's referral code info
    const codeRow = await sql`
      SELECT referral_code, uses, created_at FROM referral_codes WHERE fid = ${authFid}
    `;

    // Get people who used this user's code
    const bonuses = await sql`
      SELECT referred_fid, claimed, claimed_at, created_at
      FROM referral_bonuses
      WHERE referrer_fid = ${authFid}
      ORDER BY created_at DESC
    `;

    // Get who referred this user (if any)
    const referredBy = await sql`
      SELECT referrer_fid, created_at
      FROM referral_bonuses
      WHERE referred_fid = ${authFid}
      LIMIT 1
    `;

    const referralCode = codeRow.length > 0 ? codeRow[0].referral_code : null;
    const totalUses = codeRow.length > 0 ? codeRow[0].uses : 0;
    const createdAt = codeRow.length > 0 ? codeRow[0].created_at : null;

    // HH2 earned from referrals (50 HH2 per successful referral)
    const hh2Earned = bonuses.length * 50;
    const hh2Pending = bonuses.filter((b: any) => !b.claimed).length * 50;

    return NextResponse.json({
      ok: true,
      referralCode,
      totalUses,
      createdAt,
      hh2Earned,
      hh2Pending,
      referrals: bonuses.map((b: any) => ({
        referredFid: b.referred_fid,
        claimed: b.claimed,
        claimedAt: b.claimed_at,
        createdAt: b.created_at,
      })),
      referredBy: referredBy.length > 0 ? {
        referrerFid: referredBy[0].referrer_fid,
        createdAt: referredBy[0].created_at,
      } : null,
      shareUrl: referralCode ? `https://homiehouse.lol/?ref=${referralCode}` : null,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    logger.error('GET error', err?.message);
    return NextResponse.json({ ok: false, error: 'Failed to get referral stats' }, { status: 500 });
  }
}