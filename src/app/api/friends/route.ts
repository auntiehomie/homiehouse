import { NextRequest, NextResponse } from "next/server";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fid = searchParams.get("fid");

    if (!fid) {
      return NextResponse.json({ error: "FID required" }, { status: 400 });
    }

    if (!NEYNAR_API_KEY) {
      return NextResponse.json(
        { error: "NEYNAR_API_KEY not configured" },
        { status: 500 }
      );
    }

    const url = `https://api.neynar.com/v2/farcaster/following?fid=${fid}&limit=100`;
    console.log("[API /friends] Fetching from Neynar:", url);

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        api_key: NEYNAR_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API /friends] Neynar error:", response.status, errorText);
      return NextResponse.json(
        { error: "Failed to fetch friends from Neynar", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[API /friends] Success, users:", data?.users?.length || 0);

    return NextResponse.json({ data: data.users || [] });
  } catch (error: any) {
    console.error("[API /friends] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
