import { NextRequest, NextResponse } from "next/server";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { ViemLocalEip712Signer } from "@farcaster/hub-nodejs";
import { bytesToHex, hexToBytes } from "viem";
import { mnemonicToAccount } from "viem/accounts";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const APP_FID = process.env.APP_FID;
const APP_MNEMONIC = process.env.APP_MNEMONIC;

const neynarClient = new NeynarAPIClient(NEYNAR_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    if (!NEYNAR_API_KEY || !APP_FID || !APP_MNEMONIC) {
      return NextResponse.json({ ok: false, error: "Server not configured properly" }, { status: 500 });
    }

    // Step 1: Create signer using SDK
    const createSigner = await neynarClient.createSigner();
    console.log("Created signer:", createSigner.signer_uuid, createSigner.public_key);

    // Step 2: Generate signature using developer account
    const account = mnemonicToAccount(APP_MNEMONIC);
    console.log("==== SIGNATURE DEBUG ====");
    console.log("Derived custody address:", account.address);
    console.log("APP_FID:", APP_FID);
    console.log("Public key to sign:", createSigner.public_key);
    console.log("========================");
    
    const appAccountKey = new ViemLocalEip712Signer(account);
    const deadline = Math.floor(Date.now() / 1000) + 86400; // 24 hours
    const uintAddress = hexToBytes(createSigner.public_key as `0x${string}`);

    const signatureResult = await appAccountKey.signKeyRequest({
      requestFid: BigInt(APP_FID),
      key: uintAddress,
      deadline: BigInt(deadline),
    });

    if (signatureResult.isErr()) {
      console.error("Signature generation failed:", signatureResult.error);
      return NextResponse.json({ ok: false, error: "signature_failed" }, { status: 500 });
    }

    const signature = bytesToHex(signatureResult.value);

    // Step 3: Register the signed key using SDK
    const signedKey = await neynarClient.registerSignedKey({
      signerUuid: createSigner.signer_uuid,
      appFid: Number(APP_FID),
      deadline,
      signature,
    });

    console.log("Registered signed key response:", JSON.stringify(signedKey, null, 2));

    return NextResponse.json({
      ok: true,
      signer_uuid: signedKey.signer_uuid,
      public_key: signedKey.public_key,
      status: signedKey.status,
      signer_approval_url: signedKey.signer_approval_url,
      fid: signedKey.fid,
    });
  } catch (e: any) {
    console.error("/api/signer error", e);
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const signer_uuid = url.searchParams.get("signer_uuid");

    if (!NEYNAR_API_KEY) {
      return NextResponse.json({ ok: false, error: "NEYNAR_API_KEY not configured" }, { status: 500 });
    }

    if (!signer_uuid) {
      return NextResponse.json({ ok: false, error: "missing signer_uuid" }, { status: 400 });
    }

    // Check signer status
    const statusUrl = `${NEYNAR_BASE}/v2/farcaster/signer?signer_uuid=${encodeURIComponent(signer_uuid)}`;
    const statusRes = await fetch(statusUrl, {
      headers: {
        "accept": "application/json",
        "api_key": NEYNAR_API_KEY,
      },
    });

    if (!statusRes.ok) {
      const errText = await statusRes.text();
      console.warn("/api/signer status check failed", statusRes.status, errText);
      return NextResponse.json({ ok: false, error: "status_failed", details: errText }, { status: statusRes.status });
    }

    const data = await statusRes.json();
    return NextResponse.json({
      ok: true,
      signer_uuid: data.signer_uuid,
      status: data.status,
      fid: data.fid,
      public_key: data.public_key,
    });
  } catch (e: any) {
    console.error("/api/signer GET error", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
