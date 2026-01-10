import { NextRequest, NextResponse } from "next/server";

// Simple proxy endpoint for feed data.
// If you provide NEYNAR_API_KEY in your environment, this will attempt to fetch
// the user's home feed from Neynar (a third-party Farcaster API). If not set,
// the endpoint returns 501 with instructions so the frontend can fall back to
// a host SDK or dev mock.

const NEYNAR = process.env.NEYNAR_API_KEY;
const NEYNAR_BASE = "https://api.neynar.com";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const fid = url.searchParams.get("fid");
    const feedType = url.searchParams.get("feed_type") || "following";
    const channel = url.searchParams.get("channel");

    if (!NEYNAR) {
      return NextResponse.json({ ok: false, error: "NEYNAR_API_KEY not configured. Set NEYNAR_API_KEY in env to enable server-side feed fetching." }, { status: 501 });
    }

    // Build endpoint based on feed type
    let endpoint;
    if (channel) {
      // Channel-specific feed
      endpoint = `${NEYNAR_BASE}/v2/farcaster/feed/channels?channel_ids=${encodeURIComponent(channel)}&with_recasts=true&limit=50`;
    } else if (feedType === "following") {
      // User's following feed - requires FID
      if (!fid) {
        return NextResponse.json({ 
          ok: false, 
          error: "FID required for following feed. Please sign in." 
        }, { status: 400 });
      }
      endpoint = `${NEYNAR_BASE}/v2/farcaster/feed/?feed_type=following&fid=${encodeURIComponent(fid)}&limit=50&with_recasts=true`;
    } else if (feedType === "channels") {
      // Popular channels feed (show trending from various channels)
      endpoint = `${NEYNAR_BASE}/v2/farcaster/feed/?feed_type=filter&filter_type=channel_id&limit=50`;
    } else if (feedType === "global") {
      // Global feed
      endpoint = `${NEYNAR_BASE}/v2/farcaster/feed/?feed_type=filter&filter_type=global_trending&limit=50`;
    } else {
      // Default to global if unknown feed type
      endpoint = `${NEYNAR_BASE}/v2/farcaster/feed/?feed_type=filter&filter_type=global_trending&limit=50`;
    }
    
    try {
      const res = await fetch(endpoint, { headers: { "x-api-key": NEYNAR } });
      if (!res.ok) {
        const text = await res.text();
        try { console.warn("/api/feed neynar failed", endpoint, res.status, text); } catch {}
        return NextResponse.json({ ok: false, error: "neynar_error", status: res.status, details: text }, { status: res.status });
      }

      const data = await res.json();
      const casts = Array.isArray(data?.casts) ? data.casts : [];
      try { console.log(`/api/feed fetched ${casts.length} casts for feedType=${feedType}, channel=${channel || 'none'} from ${endpoint}`); } catch {}
      // Return the casts array so the client can render directly
      return NextResponse.json({ ok: true, data: casts, next: data?.next ?? null });
    } catch (e: any) {
      try { console.warn("/api/feed neynar fetch error", endpoint, e); } catch {}
      return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
