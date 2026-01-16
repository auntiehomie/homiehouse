import { NextRequest, NextResponse } from "next/server";
import { mnemonicToAccount } from "viem/accounts";

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
 */
export async function POST(req: NextRequest) {
  console.log("[API /signer POST] ========== REQUEST START ==========");
  
  try {
    if (!NEYNAR_API_KEY) {
      console.error("[API /signer POST] ERROR: NEYNAR_API_KEY not configured");
      return NextResponse.json(
        { ok: false, error: "NEYNAR_API_KEY not configured" },
        { status: 500 }
      );
    }

    if (!APP_FID) {
      console.error("[API /signer POST] ERROR: APP_FID not configured");
      return NextResponse.json(
        { ok: false, error: "APP_FID not configured" },
        { status: 500 }
      );
    }

    if (!APP_MNEMONIC) {
      console.error("[API /signer POST] ERROR: APP_MNEMONIC not configured");
      return NextResponse.json(
        { ok: false, error: "APP_MNEMONIC not configured" },
        { status: 500 }
      );
    }

    console.log("[API /signer POST] Creating new signer...");

    // Step 1: Create a new signer using Neynar API
    const createResponse = await fetch("https://api.neynar.com/v2/farcaster/signer", {
      method: "POST",
      headers: {
        accept: "application/json",
        api_key: NEYNAR_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    console.log("[API /signer POST] Create response status:", createResponse.status);

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("[API /signer POST] ❌ Neynar API error (create):");
      console.error("[API /signer POST] Status:", createResponse.status);
      console.error("[API /signer POST] Error body:", errorText);
      
      return NextResponse.json(
        { ok: false, error: "Failed to create signer", details: errorText },
        { status: createResponse.status }
      );
    }

    const createData = await createResponse.json();
    console.log("[API /signer POST] ✅ Signer created:", {
      signer_uuid: createData.signer_uuid,
      status: createData.status,
      public_key: createData.public_key
    });

    // Step 2: Generate signature using app's mnemonic and EIP-712
    console.log("[API /signer POST] Generating signature...");
    
    const deadline = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours from now
    const appFid = parseInt(APP_FID);
    
    // Create account from mnemonic
    const account = mnemonicToAccount(APP_MNEMONIC);
    
    // Sign using EIP-712 typed data
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
    
    console.log("[API /signer POST] Signature generated");

    // Step 3: Register the signed key to get approval URL
    console.log("[API /signer POST] Registering signed key...");
    
    const registerResponse = await fetch("https://api.neynar.com/v2/farcaster/signer/signed_key", {
      method: "POST",
      headers: {
        accept: "application/json",
        api_key: NEYNAR_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        signer_uuid: createData.signer_uuid,
        app_fid: appFid,
        deadline: deadline,
        signature: signature,
      }),
    });

    console.log("[API /signer POST] Register response status:", registerResponse.status);

    if (!registerResponse.ok) {
      const errorText = await registerResponse.text();
      console.error("[API /signer POST] ❌ Neynar API error (register):");
      console.error("[API /signer POST] Status:", registerResponse.status);
      console.error("[API /signer POST] Error body:", errorText);
      
      return NextResponse.json(
        { ok: false, error: "Failed to register signer", details: errorText },
        { status: registerResponse.status }
      );
    }

    const data = await registerResponse.json();
    console.log("[API /signer POST] ✅ Signer registered:", {
      signer_uuid: data.signer_uuid,
      status: data.status,
      has_approval_url: !!data.signer_approval_url,
      approval_url: data.signer_approval_url
    });
    console.log("[API /signer POST] ========== REQUEST END ==========");

    return NextResponse.json({
      ok: true,
      signer_uuid: data.signer_uuid,
      public_key: data.public_key,
      status: data.status,
      signer_approval_url: data.signer_approval_url,
      fid: data.fid,
    });
  } catch (error: any) {
    console.error("[API /signer POST] ❌ EXCEPTION:", error);
    console.error("[API /signer POST] Error message:", error.message);
    console.error("[API /signer POST] Error stack:", error.stack);
    console.error("[API /signer POST] ========== REQUEST END (ERROR) ==========");
    
    return NextResponse.json(
      { ok: false, error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/signer?signer_uuid=...
 * Check the status of an existing signer
 */
export async function GET(req: NextRequest) {
  console.log("[API /signer GET] ========== REQUEST START ==========");
  
  try {
    const { searchParams } = new URL(req.url);
    const signerUuid = searchParams.get("signer_uuid");

    if (!signerUuid) {
      console.error("[API /signer GET] ERROR: Missing signer_uuid parameter");
      return NextResponse.json(
        { ok: false, error: "signer_uuid parameter required" },
        { status: 400 }
      );
    }

    if (!NEYNAR_API_KEY) {
      console.error("[API /signer GET] ERROR: NEYNAR_API_KEY not configured");
      return NextResponse.json(
        { ok: false, error: "NEYNAR_API_KEY not configured" },
        { status: 500 }
      );
    }

    console.log("[API /signer GET] Checking signer status:", signerUuid);

    // Check signer status using Neynar API
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/signer?signer_uuid=${encodeURIComponent(signerUuid)}`,
      {
        headers: {
          accept: "application/json",
          api_key: NEYNAR_API_KEY,
        },
      }
    );

    console.log("[API /signer GET] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API /signer GET] ❌ Neynar API error:");
      console.error("[API /signer GET] Status:", response.status);
      console.error("[API /signer GET] Error body:", errorText);
      
      return NextResponse.json(
        { ok: false, error: "Failed to check signer", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[API /signer GET] ✅ Signer status:", {
      signer_uuid: data.signer_uuid,
      status: data.status,
      fid: data.fid
    });
    console.log("[API /signer GET] ========== REQUEST END ==========");

    return NextResponse.json({
      ok: true,
      signer_uuid: data.signer_uuid,
      public_key: data.public_key,
      status: data.status,
      signer_approval_url: data.signer_approval_url,
      fid: data.fid,
    });
  } catch (error: any) {
    console.error("[API /signer GET] ❌ EXCEPTION:", error);
    console.error("[API /signer GET] Error message:", error.message);
    console.error("[API /signer GET] ========== REQUEST END (ERROR) ==========");
    
    return NextResponse.json(
      { ok: false, error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
