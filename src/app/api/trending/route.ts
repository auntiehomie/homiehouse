import { NextRequest, NextResponse } from "next/server";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

export async function GET(req: NextRequest) {
  console.log("[API /trending] ========== REQUEST START ==========");
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const timeWindow = searchParams.get("time_window") || "24h";
    const viewerFid = searchParams.get("viewer_fid");
    const channelId = searchParams.get("channel_id");

    console.log("[API /trending] Request params:", { limit, timeWindow, viewerFid, channelId });
    console.log("[API /trending] NEYNAR_API_KEY present:", !!NEYNAR_API_KEY);

    if (!NEYNAR_API_KEY) {
      console.error("[API /trending] ERROR: NEYNAR_API_KEY not configured");
      return NextResponse.json(
        { error: "NEYNAR_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Use Neynar's trending feed endpoint
    const params = new URLSearchParams({
      limit: limit.toString(),
      time_window: timeWindow,
    });

    if (viewerFid) {
      params.set("viewer_fid", viewerFid);
    }

    if (channelId) {
      params.set("channel_id", channelId);
    }

    const url = `https://api.neynar.com/v2/farcaster/feed/trending?${params.toString()}`;
    console.log("[API /trending] Fetching from Neynar:", url);

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        api_key: NEYNAR_API_KEY,
      },
    });

    console.log("[API /trending] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API /trending] ❌ Neynar API error:");
      console.error("[API /trending] Status:", response.status);
      console.error("[API /trending] Error body:", errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        console.error("[API /trending] Parsed error:", JSON.stringify(errorJson, null, 2));
      } catch (e) {
        console.error("[API /trending] Could not parse error as JSON");
      }
      
      return NextResponse.json(
        { error: "Failed to fetch trending from Neynar", details: errorText, status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[API /trending] ✅ Success! Casts received:", data?.casts?.length || 0);
    console.log("[API /trending] ========== REQUEST END ==========");

    return NextResponse.json({ data: data.casts || [] });
  } catch (error: any) {
    console.error("[API /trending] ❌ EXCEPTION:", error);
    console.error("[API /trending] Error message:", error.message);
    console.error("[API /trending] Error stack:", error.stack);
    console.error("[API /trending] ========== REQUEST END (ERROR) ==========");
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
