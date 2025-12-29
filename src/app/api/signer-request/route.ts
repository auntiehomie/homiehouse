import { NextRequest, NextResponse } from "next/server";
import * as ed from '@noble/ed25519';
import { mnemonicToAccount } from 'viem/accounts';

// Farcaster Signed Key Request flow using api.farcaster.xyz

const APP_FID = process.env.APP_FID;
const APP_MNEMONIC = process.env.APP_MNEMONIC;
const FARCASTER_API = "https://api.farcaster.xyz";

const SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN = {
  name: 'Farcaster SignedKeyRequestValidator',
  version: '1',
  chainId: 10,
  verifyingContract: '0x00000000fc700472606ed4fa22623acf62c60553',
} as const;

const SIGNED_KEY_REQUEST_TYPE = [
  { name: 'requestFid', type: 'uint256' },
  { name: 'key', type: 'bytes' },
  { name: 'deadline', type: 'uint256' },
] as const;

// POST - Create a new signed key request
export async function POST(req: NextRequest) {
  try {
    if (!APP_FID || !APP_MNEMONIC) {
      return NextResponse.json(
        { ok: false, error: "Server not configured. Set APP_FID and APP_MNEMONIC." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { fid } = body;

    if (!fid) {
      return NextResponse.json(
        { ok: false, error: "Missing FID" },
        { status: 400 }
      );
    }

    // Generate Ed25519 keypair for this user
    const privateKey = ed.utils.randomSecretKey();
    const publicKeyBytes = await ed.getPublicKeyAsync(privateKey);
    const publicKeyHex = '0x' + Buffer.from(publicKeyBytes).toString('hex') as `0x${string}`;

    // Sign the SignedKeyRequest with the app's custody address
    const account = mnemonicToAccount(APP_MNEMONIC);
    const deadline = Math.floor(Date.now() / 1000) + 86400; // 24 hours

    const signature = await account.signTypedData({
      domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
      types: {
        SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE,
      },
      primaryType: 'SignedKeyRequest',
      message: {
        requestFid: BigInt(APP_FID),
        key: publicKeyHex,
        deadline: BigInt(deadline),
      },
    });

    // Create signed key request via Farcaster API
    const response = await fetch(`${FARCASTER_API}/v2/signed-key-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: publicKeyHex,
        requestFid: Number(APP_FID),
        signature,
        deadline,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Farcaster API error:", response.status, errorText);
      return NextResponse.json(
        { ok: false, error: "Failed to create signer request", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    const { token, deeplinkUrl, state } = data.result.signedKeyRequest;

    console.log(`Created signer request for FID ${fid}: token=${token}, state=${state}`);

    // Return the token, deeplink, and private key (hex encoded)
    return NextResponse.json({
      ok: true,
      token,
      deeplinkUrl,
      state,
      privateKey: Buffer.from(privateKey).toString('hex'),
      publicKey: publicKeyHex,
    });
  } catch (error: any) {
    console.error("/api/signer-request POST error:", error);
    return NextResponse.json(
      { ok: false, error: String(error.message || error) },
      { status: 500 }
    );
  }
}

// GET - Check status of a signed key request
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Missing token parameter" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${FARCASTER_API}/v2/signed-key-request?token=${token}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Farcaster API polling error:", response.status, errorText);
      return NextResponse.json(
        { ok: false, error: "Failed to check signer status", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    const { state, userFid } = data.result.signedKeyRequest;

    console.log(`Signer request status: token=${token}, state=${state}, userFid=${userFid || 'N/A'}`);

    return NextResponse.json({
      ok: true,
      state, // pending, approved, completed
      userFid,
    });
  } catch (error: any) {
    console.error("/api/signer-request GET error:", error);
    return NextResponse.json(
      { ok: false, error: String(error.message || error) },
      { status: 500 }
    );
  }
}
