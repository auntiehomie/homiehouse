import { NextRequest, NextResponse } from "next/server";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;

export async function POST(request: NextRequest) {
  console.log("[API /privy-recast] ========== REQUEST START ==========");
  try {
    const body = await request.json();
    const { castHash } = body;

    console.log("[API /privy-recast] Request:", { castHash });

    if (!NEYNAR_API_KEY || !NEYNAR_SIGNER_UUID) {
      console.error("[API /privy-recast] Neynar credentials not configured");
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
        reaction_type: "recast",
        target: castHash,
      }),
    });

    console.log("[API /privy-recast] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API /privy-recast] ❌ Neynar API error:");
      console.error("[API /privy-recast] Status:", response.status);
      console.error("[API /privy-recast] Error body:", errorText);
      
      return NextResponse.json(
        { error: "Failed to recast", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[API /privy-recast] ✅ Recast successful");
    console.log("[API /privy-recast] ========== REQUEST END ==========");

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    console.error("[API /privy-recast] ❌ EXCEPTION:", error);
    console.error("[API /privy-recast] Error message:", error.message);
    console.error("[API /privy-recast] ========== REQUEST END (ERROR) ==========");
    return NextResponse.json(
      { error: error.message || "Failed to recast" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  console.log("[API /privy-recast DELETE] ========== REQUEST START ==========");
  try {
    const { searchParams } = new URL(request.url);
    const castHash = searchParams.get("castHash");

    console.log("[API /privy-recast DELETE] Request:", { castHash });

    if (!NEYNAR_API_KEY || !NEYNAR_SIGNER_UUID) {
      console.error("[API /privy-recast DELETE] Neynar credentials not configured");
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
        reaction_type: "recast",
        target: castHash,
      }),
    });

    console.log("[API /privy-recast DELETE] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API /privy-recast DELETE] ❌ Neynar API error:");
      console.error("[API /privy-recast DELETE] Status:", response.status);
      console.error("[API /privy-recast DELETE] Error body:", errorText);
      
      return NextResponse.json(
        { error: "Failed to remove recast", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[API /privy-recast DELETE] ✅ Remove recast successful");
    console.log("[API /privy-recast DELETE] ========== REQUEST END ==========");

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    console.error("[API /privy-recast DELETE] ❌ EXCEPTION:", error);
    console.error("[API /privy-recast DELETE] Error message:", error.message);
    console.error("[API /privy-recast DELETE] ========== REQUEST END (ERROR) ==========");
    return NextResponse.json(
      { error: error.message || "Failed to remove recast" },
      { status: 500 }
    );
  }
}
