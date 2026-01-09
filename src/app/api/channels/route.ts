import { NextRequest, NextResponse } from "next/server";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_BASE = "https://api.neynar.com";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const fid = url.searchParams.get("fid");

    if (!fid) {
      return NextResponse.json({ ok: false, error: "Missing fid parameter" }, { status: 400 });
    }

    if (!NEYNAR_API_KEY) {
      return NextResponse.json({ ok: false, error: "NEYNAR_API_KEY not configured" }, { status: 501 });
    }

    // Fetch user's followed channels
    const endpoint = `${NEYNAR_BASE}/v2/farcaster/user/channels?fid=${fid}&limit=25`;
    
    const res = await fetch(endpoint, {
      headers: {
        "accept": "application/json",
        "x-api-key": NEYNAR_API_KEY,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Neynar channels API error:", res.status, text);
      return NextResponse.json({ ok: false, error: "neynar_error", status: res.status }, { status: res.status });
    }

    const data = await res.json();
    const channels = data?.channels || [];
    
    return NextResponse.json({ ok: true, channels });
  } catch (e: any) {
    console.error("Error fetching channels:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
