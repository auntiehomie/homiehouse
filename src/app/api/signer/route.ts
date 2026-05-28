import { NextRequest, NextResponse } from "next/server";
import { mnemonicToAccount } from "viem/accounts";
import { ed25519 } from "@noble/curves/ed25519";
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateUuid } from '@/lib/validation';
import { rateLimit } from '@/lib/ratelimit';

// Signer registration uses the Farcaster Signed Key Request protocol directly.
// No Neynar API key required — replaced with direct Warpcast/Farcaster contract flow.
// See: https://docs.farcaster.xyz/reference/contracts/reference/signed-key-request-validator

const APP_FID = process.env.APP_FID;
const APP_MNEMONIC = process.env.APP_MNEMONIC;

// Warpcast API base — used for signer registration (no Neynar needed)
const WARPCAST_API = 'https://api.warpcast.com';

// EIP-712 Domain for Farcaster SignedKeyRequestValidator
const SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN = {
  name: "Farcaster SignedKeyRequestValidator",
  version: "1",
  chainId: 10,
  verifyingContract: "0x00000000fc700472606ed4fa22623acf62c60553" as `0x${string}`,
} as const;

const SIGNED_KEY_REQUEST_TYPE = [
  { name: "requestFid", type: "uint256" },
  { name: "key", type: "bytes" },
  { name: "deadline", type: "uint256" },
] as const;

/**
 * POST /api/signer
 * Creates a new Ed25519 signer and registers it via Warpcast API (no Neynar).
 * Returns signer_approval_url for the user to open in Warpcast to approve.
 * WARNING: This handles sensitive data (mnemonics) - logging is carefully controlled.
 */
export async function POST(req: NextRequest) {
  const logger = createApiLogger('/signer POST');
  logger.start();

  try {
    // SECURITY: Rate limit signer creation (5 per hour per IP)
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const { success: rlOk } = rateLimit(`signer-create:${ip}`, 5, 3600);
    if (!rlOk) {
      return NextResponse.json(
        { ok: false, error: 'Too many signer creation requests. Try again later.' },
        { status: 429 }
      );
    }

    if (!APP_FID || !APP_MNEMONIC) {
      return NextResponse.json(
        { ok: false, error: "Server configuration incomplete" },
        { status: 500 }
      );
    }

    logger.info('Creating new Ed25519 signer (direct Farcaster protocol)');

    // Step 1: Generate a fresh Ed25519 keypair
    const privateKeyBytes = ed25519.utils.randomPrivateKey();
    const publicKeyBytes = ed25519.getPublicKey(privateKeyBytes);
    const publicKeyHex = `0x${Buffer.from(publicKeyBytes).toString('hex')}` as `0x${string}`;
    const privateKeyHex = Buffer.from(privateKeyBytes).toString('hex');

    // Step 2: Sign the key registration payload with the app's EIP-712 key
    const deadline = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24h
    const appFid = parseInt(APP_FID);

    // Trim whitespace/quotes that can sneak in via Vercel env var copy-paste
    const cleanMnemonic = APP_MNEMONIC.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '') as `${string}`;

    let account: ReturnType<typeof mnemonicToAccount>;
    try {
      account = mnemonicToAccount(cleanMnemonic);
    } catch (mnemonicErr: any) {
      logger.error('Invalid APP_MNEMONIC', { message: mnemonicErr.message });
      return NextResponse.json(
        { ok: false, error: 'Server mnemonic configuration is invalid. Check APP_MNEMONIC env var.' },
        { status: 500 }
      );
    }

    const signature = await account!.signTypedData({
      domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
      types: { SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE },
      primaryType: "SignedKeyRequest",
      message: {
        requestFid: BigInt(appFid),
        key: publicKeyHex,
        deadline: BigInt(deadline),
      },
    });

    logger.info('EIP-712 signature generated');

    // Step 3: Register via Warpcast API (no Neynar)
    const registerRes = await fetch(`${WARPCAST_API}/v2/signed-key-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        key: publicKeyHex,
        requestFid: appFid,
        deadline,
        signature,
      }),
    });

    if (!registerRes.ok) {
      const errText = await registerRes.text();
      logger.error('Warpcast signer registration failed', { status: registerRes.status, errText });
      return NextResponse.json(
        { ok: false, error: `Failed to register signer with Warpcast (${registerRes.status}): ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const registerData = await registerRes.json();
    const result = registerData.result?.signedKeyRequest || registerData;

    logger.success('Signer registered via Warpcast', {
      token: result.token?.substring(0, 8) + '...',
      deeplinkUrl: !!result.deeplinkUrl,
    });
    logger.end();

    // Return in a shape compatible with existing client-side polling
    return NextResponse.json({
      ok: true,
      signer_uuid: result.token,           // token acts as signer identifier
      public_key: publicKeyHex,
      private_key: privateKeyHex,          // stored client-side only, never logged
      status: 'pending_approval',
      signer_approval_url: result.deeplinkUrl,
    });
  } catch (error: any) {
    logger.error('Failed to create signer', error);
    return handleApiError(error, 'POST /signer');
  }
}

/**
 * GET /api/signer?signer_uuid=...
 * Check the status of an existing signer via Warpcast API (no Neynar).
 */
export async function GET(req: NextRequest) {
  const logger = createApiLogger('/signer GET');
  logger.start();

  try {
    const { searchParams } = new URL(req.url);
    const signerToken = searchParams.get("signer_uuid");

    if (!signerToken) {
      return NextResponse.json(
        { ok: false, error: "signer_uuid parameter required" },
        { status: 400 }
      );
    }

    // Accept both UUID-style and token-style identifiers
    if (signerToken.includes('-')) validateUuid(signerToken);
    logger.info('Checking signer status via Warpcast', { token: signerToken.substring(0, 8) + '...' });

    const statusRes = await fetch(
      `${WARPCAST_API}/v2/signed-key-request?token=${encodeURIComponent(signerToken)}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!statusRes.ok) {
      return NextResponse.json(
        { ok: false, error: 'Failed to check signer status' },
        { status: 502 }
      );
    }

    const statusData = await statusRes.json();
    const skr = statusData.result?.signedKeyRequest || statusData;

    logger.success('Signer status retrieved', {
      state: skr.state,
      fid: skr.userFid,
    });
    logger.end();

    return NextResponse.json({
      ok: true,
      signer_uuid: signerToken,
      public_key: skr.key,
      status: skr.state === 'completed' ? 'approved' : skr.state,
      signer_approval_url: skr.deeplinkUrl,
      fid: skr.userFid,
    });
  } catch (error: any) {
    logger.error('Failed to check signer status', error);
    return handleApiError(error, 'GET /signer');
  }
}
