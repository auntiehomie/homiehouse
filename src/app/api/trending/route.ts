import { NextRequest, NextResponse } from "next/server";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const timeWindow = searchParams.get("time_window") || "24h";
    const viewerFid = searchParams.get("viewer_fid");
    const channelId = searchParams.get("channel_id");

    if (!NEYNAR_API_KEY) {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API /trending] Neynar error:", response.status, errorText);
      return NextResponse.json(
        { error: "Failed to fetch trending from Neynar", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[API /trending] Success, casts:", data?.casts?.length || 0);

    return NextResponse.json({ data: data.casts || [] });
  } catch (error: any) {
    console.error("[API /trending] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
