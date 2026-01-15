import { NextRequest, NextResponse } from "next/server";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;

export async function POST(request: NextRequest) {
  console.log("[API /privy-reply] ========== REQUEST START ==========");
  try {
    const body = await request.json();
    const { text, parentHash } = body;

    console.log("[API /privy-reply] Request:", { text: text?.substring(0, 50), parentHash });

    if (!NEYNAR_API_KEY || !NEYNAR_SIGNER_UUID) {
      console.error("[API /privy-reply] Neynar credentials not configured");
      return NextResponse.json(
        { error: "Neynar API not configured for publishing" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.neynar.com/v2/farcaster/cast", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api_key": NEYNAR_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        signer_uuid: NEYNAR_SIGNER_UUID,
        text,
        parent: parentHash,
      }),
    });

    console.log("[API /privy-reply] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API /privy-reply] ❌ Neynar API error:");
      console.error("[API /privy-reply] Status:", response.status);
      console.error("[API /privy-reply] Error body:", errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        console.error("[API /privy-reply] Parsed error:", JSON.stringify(errorJson, null, 2));
      } catch (e) {
        console.error("[API /privy-reply] Could not parse error as JSON");
      }
      
      return NextResponse.json(
        { error: "Failed to publish reply", details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log("[API /privy-reply] ✅ Reply published successfully:", result?.cast?.hash);
    console.log("[API /privy-reply] ========== REQUEST END ==========");

    return NextResponse.json({ ok: true, cast: result.cast });
  } catch (error: any) {
    console.error("[API /privy-reply] ❌ EXCEPTION:", error);
    console.error("[API /privy-reply] Error message:", error.message);
    console.error("[API /privy-reply] ========== REQUEST END (ERROR) ==========");
    return NextResponse.json(
      { error: error.message || "Failed to publish reply" },
      { status: 500 }
    );
  }
}
