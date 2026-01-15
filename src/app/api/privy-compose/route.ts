import { NextRequest, NextResponse } from "next/server";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;

export async function POST(request: NextRequest) {
  console.log("[API /privy-compose] ========== REQUEST START ==========");
  try {
    const body = await request.json();
    const { text, embeds, channelKey, parentUrl } = body;

    console.log("[API /privy-compose] Request body:", { text: text?.substring(0, 50), embeds, channelKey, parentUrl });

    if (!NEYNAR_API_KEY || !NEYNAR_SIGNER_UUID) {
      console.error("[API /privy-compose] Neynar credentials not configured");
      return NextResponse.json(
        { error: "Neynar API not configured for publishing" },
        { status: 500 }
      );
    }

    // Publish cast via Neynar
    const castPayload: any = {
      signer_uuid: NEYNAR_SIGNER_UUID,
      text,
    };

    if (embeds && embeds.length > 0) {
      castPayload.embeds = embeds;
    }

    if (parentUrl) {
      castPayload.parent = parentUrl;
    }

    if (channelKey) {
      castPayload.channel_key = channelKey;
    }

    console.log("[API /privy-compose] Casting with payload:", castPayload);

    const response = await fetch("https://api.neynar.com/v2/farcaster/cast", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api_key": NEYNAR_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify(castPayload),
    });

    console.log("[API /privy-compose] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API /privy-compose] ❌ Neynar API error:");
      console.error("[API /privy-compose] Status:", response.status);
      console.error("[API /privy-compose] Error body:", errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        console.error("[API /privy-compose] Parsed error:", JSON.stringify(errorJson, null, 2));
      } catch (e) {
        console.error("[API /privy-compose] Could not parse error as JSON");
      }
      
      return NextResponse.json(
        { error: "Failed to publish cast", details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log("[API /privy-compose] ✅ Cast published successfully:", result?.cast?.hash);
    console.log("[API /privy-compose] ========== REQUEST END ==========");
    
    return NextResponse.json({
      ok: true,
      success: true,
      cast: result.cast,
    });

  } catch (error: any) {
    console.error("[API /privy-compose] ❌ EXCEPTION:", error);
    console.error("[API /privy-compose] Error message:", error.message);
    console.error("[API /privy-compose] ========== REQUEST END (ERROR) ==========");
    return NextResponse.json(
      { error: error.message || "Failed to publish cast" },
      { status: 500 }
    );
  }
}
