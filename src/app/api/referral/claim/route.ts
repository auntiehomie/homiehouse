import { NextRequest, NextResponse } from 'next/server';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { getSql } from '@/lib/db';

const logger = createApiLogger('/referral/claim');

// POST /api/referral/claim — claim a referral code during onboarding/signup
export async function POST(req: NextRequest) {
  try {
    const authFid = await verifyFarcasterSignerAuth(req);
    const sql = getSql();

    const { referralCode } = await req.json();
    if (!referralCode || typeof referralCode !== 'string' || referralCode.length < 4) {
      return NextResponse.json({ ok: false, error: 'Invalid referral code' }, { status: 400 });
    }

    const normalizedCode = referralCode.trim().toUpperCase();

    // Find the referrer
    const referrer = await sql`
      SELECT fid FROM referral_codes WHERE referral_code = ${normalizedCode}
    `;
    if (referrer.length === 0) {
      return NextResponse.json({ ok: false, error: 'Referral code not found' }, { status: 404 });
    }

    const referrerFid = Number(referrer[0].fid);

    // Cannot refer yourself
    if (referrerFid === authFid) {
      return NextResponse.json({ ok: false, error: 'Cannot use your own referral code' }, { status: 400 });
    }

    // Check if this user was already referred
    const existing = await sql`
      SELECT id FROM referral_bonuses WHERE referred_fid = ${authFid}
    `;
    if (existing.length > 0) {
      return NextResponse.json({ ok: false, error: 'Already claimed a referral' }, { status: 409 });
    }

    // Record the referral
    await sql`
      INSERT INTO referral_bonuses (referrer_fid, referred_fid)
      VALUES (${referrerFid}, ${authFid})
    `;

    // Increment the referrer's use count
    await sql`
      UPDATE referral_codes SET uses = uses + 1 WHERE fid = ${referrerFid}
    `;

    logger.info('Referral claimed', { referrerFid, referredFid: authFid, code: normalizedCode });

    return NextResponse.json({
      ok: true,
      message: 'Referral claimed! Both you and your referrer will receive HH2 bonuses.',
      bonusHH2: 50,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    logger.error('POST error', err?.message);
    return NextResponse.json({ ok: false, error: 'Failed to claim referral' }, { status: 500 });
  }
}