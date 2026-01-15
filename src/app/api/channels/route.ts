import { NextRequest, NextResponse } from "next/server";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fid = searchParams.get("fid");
    const limit = parseInt(searchParams.get("limit") || "25", 10);

    if (!NEYNAR_API_KEY) {
      return NextResponse.json(
        { error: "NEYNAR_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Fetch user's channels (channels they follow/are members of)
    let url: string;
    if (fid) {
      url = `https://api.neynar.com/v2/farcaster/channel/user?fid=${fid}&limit=${limit}`;
    } else {
      // If no FID, return popular channels
      url = `https://api.neynar.com/v2/farcaster/channel/list?limit=${limit}`;
    }

    console.log("[API /channels] Fetching from Neynar:", url);

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        api_key: NEYNAR_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API /channels] Neynar error:", response.status, errorText);
      return NextResponse.json(
        { error: "Failed to fetch channels from Neynar", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    const channels = data?.channels || [];
    console.log("[API /channels] Success, channels:", channels.length);

    return NextResponse.json({ data: channels });
  } catch (error: any) {
    console.error("[API /channels] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
