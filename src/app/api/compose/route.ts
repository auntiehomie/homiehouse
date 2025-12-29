import { NextRequest, NextResponse } from "next/server";
import {
  makeCastAdd,
  NobleEd25519Signer,
  FarcasterNetwork,
  Message,
  CastType,
} from "@farcaster/hub-nodejs";

// Farcaster hub endpoint for publishing casts
const FARCASTER_HUB_URL = process.env.FARCASTER_HUB_URL || "https://nemes.farcaster.xyz:2281";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, privateKey, fid } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ ok: false, error: "Missing or empty text" }, { status: 400 });
    }

    if (!fid) {
      return NextResponse.json(
        {
          ok: false,
          error: "no_user",
          message: "You need to sign in first to post.",
        },
        { status: 403 }
      );
    }

    if (!privateKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "no_signer",
          message: "You need to approve a signer first to post.",
        },
        { status: 403 }
      );
    }

    // Convert hex private key to Uint8Array
    const privateKeyBytes = Buffer.from(privateKey, 'hex');
    
    // Create Ed25519 signer
    const signer = new NobleEd25519Signer(privateKeyBytes);

    // Create cast message
    const castAddResult = await makeCastAdd(
      {
        text: text.trim(),
        embeds: [],
        embedsDeprecated: [],
        mentions: [],
        mentionsPositions: [],
        type: CastType.CAST,
      },
      { fid, network: FarcasterNetwork.MAINNET },
      signer
    );

    if (castAddResult.isErr()) {
      console.error("Failed to create cast message:", castAddResult.error);
      return NextResponse.json(
        { ok: false, error: "Failed to create cast message", details: castAddResult.error.message },
        { status: 500 }
      );
    }

    const castMessage = castAddResult.value;

    // Encode message to bytes
    const messageBytes = Message.encode(castMessage).finish();

    // Submit to Farcaster hub
    const submitResponse = await fetch(`${FARCASTER_HUB_URL}/v1/submitMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: Buffer.from(messageBytes),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      console.error("Hub submission failed:", submitResponse.status, errorText);
      return NextResponse.json(
        { ok: false, error: "Failed to submit cast to hub", details: errorText },
        { status: submitResponse.status }
      );
    }

    const result = await submitResponse.json();
    console.log(`Cast published for FID ${fid}:`, result);

    return NextResponse.json({ ok: true, cast: result });
  } catch (e: any) {
    console.error("/api/compose error", e);
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
