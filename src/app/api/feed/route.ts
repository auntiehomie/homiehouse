import { NextRequest, NextResponse } from "next/server";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const feedType = searchParams.get("feed_type") || "following";
    const fid = searchParams.get("fid");
    const channel = searchParams.get("channel");
    const limit = parseInt(searchParams.get("limit") || "25", 10);

    if (!NEYNAR_API_KEY) {
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

    const response = await fetch(neynarUrl, {
      headers: {
        accept: "application/json",
        api_key: NEYNAR_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API /feed] Neynar error:", response.status, errorText);
      return NextResponse.json(
        { error: "Failed to fetch feed from Neynar", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[API /feed] Success, casts:", data?.casts?.length || 0);

    return NextResponse.json({ data: data.casts || [] });
  } catch (error: any) {
    console.error("[API /feed] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
