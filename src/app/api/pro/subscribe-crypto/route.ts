/**
 * POST /api/pro/subscribe-crypto
 *
 * Verify a USDC-on-Base payment and activate Pro status.
 * No Stripe, no KYC — just on-chain verification.
 *
 * Body: { txHash: string, walletAddress: string }
 * Headers: x-farcaster-fid, x-signer-key (Farcaster auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { verifyUsdcTransfer, recordCryptoSubscription, PRO_TREASURY_ADDRESS, PRO_PRICE_USDC, BASE_CHAIN_ID } from '@/lib/crypto-pro';
import { createApiLogger } from '@/lib/logger';
import { rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

const logger = createApiLogger('pro-subscribe-crypto');

// Base RPC — use Alchemy if available, fall back to public RPC
const BASE_RPC = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
  ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
  : 'https://mainnet.base.org';

export async function POST(req: NextRequest) {
  try {
    // Rate limit
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const { success: rlOk } = rateLimit(`pro-subscribe:${ip}`, 5, 60);
    if (!rlOk) {
      return NextResponse.json({ ok: false, error: 'Too many requests. Try again in a minute.' }, { status: 429 });
    }

    // Verify Farcaster auth
    const userFid = await verifyFarcasterSignerAuth(req);

    const body = await req.json();
    const { txHash, walletAddress } = body;

    if (!txHash || typeof txHash !== 'string') {
      return NextResponse.json({ ok: false, error: 'Transaction hash required' }, { status: 400 });
    }

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ ok: false, error: 'Wallet address required' }, { status: 400 });
    }

    // Validate tx hash format (0x + 64 hex chars)
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return NextResponse.json({ ok: false, error: 'Invalid transaction hash format' }, { status: 400 });
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ ok: false, error: 'Invalid wallet address format' }, { status: 400 });
    }

    // Ensure treasury address is configured
    if (!PRO_TREASURY_ADDRESS) {
      logger.error('PRO_TREASURY_ADDRESS env var not set');
      return NextResponse.json({ ok: false, error: 'Pro payments not yet configured' }, { status: 503 });
    }

    // Verify the on-chain transfer
    const verification = await verifyUsdcTransfer(
      txHash,
      PRO_TREASURY_ADDRESS,
      PRO_PRICE_USDC,
      BASE_RPC
    );

    if (!verification.valid) {
      logger.info('Verification failed', { txHash, error: verification.error });
      return NextResponse.json({ ok: false, error: verification.error || 'Payment verification failed' }, { status: 400 });
    }

    // Verify the sender matches the claimed wallet address
    if (verification.sender && verification.sender.toLowerCase() !== walletAddress.toLowerCase()) {
      logger.info('Sender mismatch', { expected: walletAddress, actual: verification.sender });
      return NextResponse.json({ ok: false, error: 'Transaction sender does not match wallet address' }, { status: 400 });
    }

    // Record the subscription
    const result = await recordCryptoSubscription(userFid, walletAddress, txHash);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    logger.info('Pro activated', { userFid, expiresAt: result.expiresAt });

    return NextResponse.json({
      ok: true,
      is_pro: true,
      expires_at: result.expiresAt.toISOString(),
      message: 'Pro activated! Enjoy unlimited Ask Homie, deeper research, and premium features.',
    });
  } catch (err: any) {
    logger.error('subscribe-crypto error', err);
    return NextResponse.json({ ok: false, error: 'Failed to process subscription' }, { status: 500 });
  }
}
