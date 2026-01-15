import { NextRequest, NextResponse } from "next/server";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

export async function GET(req: NextRequest) {
  console.log("[API /feed] ========== REQUEST START ==========");
  try {
    const { searchParams } = new URL(req.url);
    const feedType = searchParams.get("feed_type") || "following";
    const fid = searchParams.get("fid");
    const channel = searchParams.get("channel");
    const limit = parseInt(searchParams.get("limit") || "25", 10);

    console.log("[API /feed] Request params:", { feedType, fid, channel, limit });
    console.log("[API /feed] NEYNAR_API_KEY present:", !!NEYNAR_API_KEY);
    console.log("[API /feed] NEYNAR_API_KEY (first 8 chars):", NEYNAR_API_KEY?.substring(0, 8));

    if (!NEYNAR_API_KEY) {
      console.error("[API /feed] ERROR: NEYNAR_API_KEY not configured");
      return NextResponse.json(
        { error: "NEYNAR_API_KEY not configured" },
        { status: 500 }
      );
    }

    let url: string;
    let params = new URLSearchParams({ limit: limit.toString() });

    if (feedType === "following" && fid) {
      // User's following feed
      url = `https://api.neynar.com/v2/farcaster/feed/following`;
      params.set("fid", fid);
    } else if (channel) {
      // Channel feed
      url = `https://api.neynar.com/v2/farcaster/feed/channels`;
      params.set("channel_ids", channel);
      if (fid) params.set("with_recasts", "true");
    } else if (feedType === "filter") {
      // Filter feed (for explore/all)
      url = `https://api.neynar.com/v2/farcaster/feed/filter`;
      params.set("filter_type", "global_trending");
      if (fid) params.set("fid", fid);
    } else {
      // Default to following or filter based on whether user has FID
      if (fid) {
        url = `https://api.neynar.com/v2/farcaster/feed/following`;
        params.set("fid", fid);
      } else {
        url = `https://api.neynar.com/v2/farcaster/feed/filter`;
        params.set("filter_type", "global_trending");
      }
    }

    const neynarUrl = `${url}?${params.toString()}`;
    console.log("[API /feed] Fetching from Neynar:", neynarUrl);
    console.log("[API /feed] Request headers:", { accept: "application/json", api_key: `${NEYNAR_API_KEY?.substring(0, 8)}...` });

    const response = await fetch(neynarUrl, {
      headers: {
        accept: "application/json",
        api_key: NEYNAR_API_KEY,
      },
    });

    console.log("[API /feed] Response status:", response.status);
    console.log("[API /feed] Response headers:", Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API /feed] ❌ Neynar API error:");
      console.error("[API /feed] Status:", response.status);
      console.error("[API /feed] Status Text:", response.statusText);
      console.error("[API /feed] Error body:", errorText);
      console.error("[API /feed] URL:", neynarUrl);
      
      // Try to parse error as JSON for more details
      try {
        const errorJson = JSON.parse(errorText);
        console.error("[API /feed] Parsed error:", JSON.stringify(errorJson, null, 2));
      } catch (e) {
        console.error("[API /feed] Could not parse error as JSON");
      }
      
      return NextResponse.json(
        { error: "Failed to fetch feed from Neynar", details: errorText, status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[API /feed] ✅ Success! Casts received:", data?.casts?.length || 0);
    if (data?.casts?.length > 0) {
      console.log("[API /feed] First cast sample:", {
        hash: data.casts[0]?.hash,
        author: data.casts[0]?.author?.username,
        text: data.casts[0]?.text?.substring(0, 50)
      });
    }
    console.log("[API /feed] ========== REQUEST END ==========");

    return NextResponse.json({ data: data.casts || [] });
  } catch (error: any) {
    console.error("[API /feed] ❌ EXCEPTION:", error);
    console.error("[API /feed] Error name:", error.name);
    console.error("[API /feed] Error message:", error.message);
    console.error("[API /feed] Error stack:", error.stack);
    console.error("[API /feed] ========== REQUEST END (ERROR) ==========");
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
