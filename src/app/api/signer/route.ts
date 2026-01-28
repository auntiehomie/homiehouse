import { NextRequest, NextResponse } from "next/server";
import { mnemonicToAccount } from "viem/accounts";
import { neynarFetch } from '@/lib/neynar';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateUuid } from '@/lib/validation';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const APP_FID = process.env.APP_FID;
const APP_MNEMONIC = process.env.APP_MNEMONIC;

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
 * Creates a new signer via Neynar API and registers it
 * WARNING: This handles sensitive data (mnemonics) - logging is carefully controlled
 */
export async function POST(req: NextRequest) {
  const logger = createApiLogger('/signer POST');
  logger.start();
  
  try {
    if (!NEYNAR_API_KEY || !APP_FID || !APP_MNEMONIC) {
      return NextResponse.json(
        { ok: false, error: "Server configuration incomplete" },
        { status: 500 }
      );
    }

    logger.info('Creating new signer');

    // Step 1: Create a new signer using Neynar API
    const createData = await neynarFetch('/signer', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    logger.info('Signer created', { 
      signer_uuid: createData.signer_uuid?.substring(0, 8) + '...', 
      status: createData.status 
    });

    // Step 2: Generate signature using app's mnemonic and EIP-712
    // NOTE: No logging of mnemonic or detailed signature data
    const deadline = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
    const appFid = parseInt(APP_FID);
    
    const account = mnemonicToAccount(APP_MNEMONIC);
    
    const signature = await account.signTypedData({
      domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
      types: {
        SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE,
      },
      primaryType: "SignedKeyRequest",
      message: {
        requestFid: BigInt(appFid),
        key: createData.public_key as `0x${string}`,
        deadline: BigInt(deadline),
      },
    });
    
    logger.info('Signature generated');

    // Step 3: Register the signed key
    const data = await neynarFetch('/signer/signed_key', {
      method: 'POST',
      body: JSON.stringify({
        signer_uuid: createData.signer_uuid,
        app_fid: appFid,
        deadline: deadline,
        signature: signature,
      }),
    });

    logger.success('Signer registered', { 
      signer_uuid: data.signer_uuid?.substring(0, 8) + '...', 
      status: data.status,
      has_approval_url: !!data.signer_approval_url 
    });
    logger.end();

    return NextResponse.json({
      ok: true,
      signer_uuid: data.signer_uuid,
      public_key: data.public_key,
      status: data.status,
      signer_approval_url: data.signer_approval_url,
      fid: data.fid,
    });
  } catch (error: any) {
    logger.error('Failed to create signer', error);
    return handleApiError(error, 'POST /signer');
  }
}

/**
 * GET /api/signer?signer_uuid=...
 * Check the status of an existing signer
 */
export async function GET(req: NextRequest) {
  const logger = createApiLogger('/signer GET');
  logger.start();
  
  try {
    const { searchParams } = new URL(req.url);
    const signerUuid = searchParams.get("signer_uuid");

    if (!signerUuid) {
      return NextResponse.json(
        { ok: false, error: "signer_uuid parameter required" },
        { status: 400 }
      );
    }

    // Validate UUID format
    validateUuid(signerUuid);
    logger.info('Checking signer status', { signer_uuid: signerUuid.substring(0, 8) + '...' });

    // Check signer status using shared utility
    const data = await neynarFetch(`/signer?signer_uuid=${encodeURIComponent(signerUuid)}`);

    logger.success('Signer status retrieved', { 
      status: data.status, 
      fid: data.fid 
    });
    logger.end();

    return NextResponse.json({
      ok: true,
      signer_uuid: data.signer_uuid,
      public_key: data.public_key,
      status: data.status,
      signer_approval_url: data.signer_approval_url,
      fid: data.fid,
    });
  } catch (error: any) {
    logger.error('Failed to check signer status', error);
    return handleApiError(error, 'GET /signer');
  }
}
