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

    if (!NEYNAR) {
      return NextResponse.json({ ok: false, error: "NEYNAR_API_KEY not configured. Set NEYNAR_API_KEY in env to enable server-side feed fetching." }, { status: 501 });
    }

    if (!fid) {
      return NextResponse.json({ ok: false, error: "missing fid" }, { status: 400 });
    }

    // Try a list of possible Neynar endpoints (provider APIs change).
    const candidates = [
      `${NEYNAR_BASE}/v2/farcaster/feed/home?fid=${encodeURIComponent(fid)}&limit=50`,
      `${NEYNAR_BASE}/v2/farcaster/user/feed?fid=${encodeURIComponent(fid)}&limit=50`,
      `${NEYNAR_BASE}/v1/farcaster/feed/home?fid=${encodeURIComponent(fid)}&limit=50`,
      `${NEYNAR_BASE}/v2/farcaster/casts?fid=${encodeURIComponent(fid)}&limit=50`,
      `${NEYNAR_BASE}/v1/casts?fid=${encodeURIComponent(fid)}&limit=50`,
    ];

    let lastErr: any = null;
    for (const endpoint of candidates) {
      try {
        const res = await fetch(endpoint, { headers: { "x-api-key": NEYNAR } });
        if (!res.ok) {
          const text = await res.text();
          try { console.warn("/api/feed neynar candidate failed", endpoint, res.status, text); } catch {}
          lastErr = { status: res.status, text, endpoint };
          // try next candidate
          continue;
        }

        const data = await res.json();
        try { console.log(`/api/feed fetched ${Array.isArray(data) ? data.length : (data?.length ?? "?")} items for fid=${fid} from ${endpoint}`); } catch {}
        return NextResponse.json({ ok: true, data });
      } catch (e: any) {
        lastErr = { error: String(e), endpoint };
        try { console.warn("/api/feed neynar fetch error", endpoint, e); } catch {}
        continue;
      }
    }

    // All candidates failed
    return NextResponse.json({ ok: false, error: "neynar_not_found", details: lastErr }, { status: 404 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
