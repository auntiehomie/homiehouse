import { NextRequest, NextResponse } from "next/server";
import { ViemLocalEip712Signer } from "@farcaster/hub-nodejs";
import { bytesToHex, hexToBytes } from "viem";
import { mnemonicToAccount } from "viem/accounts";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_BASE = "https://api.neynar.com";
const APP_FID = process.env.APP_FID;
const APP_MNEMONIC = process.env.APP_MNEMONIC;

export async function POST(req: NextRequest) {
  try {
    if (!NEYNAR_API_KEY || !APP_FID || !APP_MNEMONIC) {
      return NextResponse.json({ ok: false, error: "Server not configured properly" }, { status: 500 });
    }

    // Step 1: Create signer
    const createRes = await fetch(`${NEYNAR_BASE}/v2/farcaster/signer`, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api_key": NEYNAR_API_KEY,
      },
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error("Create signer failed:", createRes.status, errText);
      return NextResponse.json({ ok: false, error: "create_failed", details: errText }, { status: createRes.status });
    }

    const createData = await createRes.json();
    const publicKey = createData.public_key;
    const signerUuid = createData.signer_uuid;

    console.log("Created signer:", signerUuid, publicKey);

    // Step 2: Generate signature using developer account
    const account = mnemonicToAccount(APP_MNEMONIC);
    const appAccountKey = new ViemLocalEip712Signer(account);
    const deadline = Math.floor(Date.now() / 1000) + 86400; // 24 hours
    const uintAddress = hexToBytes(publicKey as `0x${string}`);

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

    // Step 3: Register the signed key
    const registerRes = await fetch(`${NEYNAR_BASE}/v2/farcaster/signer/signed_key`, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api_key": NEYNAR_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        signer_uuid: signerUuid,
        app_fid: Number(APP_FID),
        deadline,
        signature,
      }),
    });

    if (!registerRes.ok) {
      const errText = await registerRes.text();
      console.error("Register signed key failed:", registerRes.status, errText);
      return NextResponse.json({ ok: false, error: "register_failed", details: errText }, { status: registerRes.status });
    }

    const registerData = await registerRes.json();
    console.log("Registered signed key response:", JSON.stringify(registerData, null, 2));

    return NextResponse.json({
      ok: true,
      signer_uuid: registerData.signer_uuid,
      public_key: registerData.public_key,
      status: registerData.status,
      signer_approval_url: registerData.signer_approval_url,
      fid: registerData.fid,
    });
  } catch (e: any) {
    console.error("/api/signer error", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
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
