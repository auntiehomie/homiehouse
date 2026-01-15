import { NextRequest, NextResponse } from "next/server";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;

export async function POST(request: NextRequest) {
  console.log("[API /privy-like] ========== REQUEST START ==========");
  try {
    const body = await request.json();
    const { castHash } = body;

    console.log("[API /privy-like] Request:", { castHash });

    if (!NEYNAR_API_KEY || !NEYNAR_SIGNER_UUID) {
      console.error("[API /privy-like] Neynar credentials not configured");
      return NextResponse.json(
        { error: "Neynar API not configured" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.neynar.com/v2/farcaster/reaction", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api_key": NEYNAR_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        signer_uuid: NEYNAR_SIGNER_UUID,
        reaction_type: "like",
        target: castHash,
      }),
    });

    console.log("[API /privy-like] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API /privy-like] ❌ Neynar API error:");
      console.error("[API /privy-like] Status:", response.status);
      console.error("[API /privy-like] Error body:", errorText);
      
      return NextResponse.json(
        { error: "Failed to like cast", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[API /privy-like] ✅ Like successful");
    console.log("[API /privy-like] ========== REQUEST END ==========");

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    console.error("[API /privy-like] ❌ EXCEPTION:", error);
    console.error("[API /privy-like] Error message:", error.message);
    console.error("[API /privy-like] ========== REQUEST END (ERROR) ==========");
    return NextResponse.json(
      { error: error.message || "Failed to like cast" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  console.log("[API /privy-like DELETE] ========== REQUEST START ==========");
  try {
    const { searchParams } = new URL(request.url);
    const castHash = searchParams.get("castHash");

    console.log("[API /privy-like DELETE] Request:", { castHash });

    if (!NEYNAR_API_KEY || !NEYNAR_SIGNER_UUID) {
      console.error("[API /privy-like DELETE] Neynar credentials not configured");
      return NextResponse.json(
        { error: "Neynar API not configured" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.neynar.com/v2/farcaster/reaction", {
      method: "DELETE",
      headers: {
        "accept": "application/json",
        "api_key": NEYNAR_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        signer_uuid: NEYNAR_SIGNER_UUID,
        reaction_type: "like",
        target: castHash,
      }),
    });

    console.log("[API /privy-like DELETE] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API /privy-like DELETE] ❌ Neynar API error:");
      console.error("[API /privy-like DELETE] Status:", response.status);
      console.error("[API /privy-like DELETE] Error body:", errorText);
      
      return NextResponse.json(
        { error: "Failed to unlike cast", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[API /privy-like DELETE] ✅ Unlike successful");
    console.log("[API /privy-like DELETE] ========== REQUEST END ==========");

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    console.error("[API /privy-like DELETE] ❌ EXCEPTION:", error);
    console.error("[API /privy-like DELETE] Error message:", error.message);
    console.error("[API /privy-like DELETE] ========== REQUEST END (ERROR) ==========");
    return NextResponse.json(
      { error: error.message || "Failed to unlike cast" },
      { status: 500 }
    );
  }
}
