import { NextRequest, NextResponse } from "next/server";

const NEYNAR = process.env.NEYNAR_API_KEY;
const NEYNAR_BASE = "https://api.neynar.com";

export async function GET(req: NextRequest) {
  try {
    if (!NEYNAR) {
      return NextResponse.json(
        { ok: false, error: "NEYNAR_API_KEY not configured. Set NEYNAR_API_KEY in env to enable server-side trending feed." },
        { status: 501 }
      );
    }

    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "10", 10), 1), 10);
    const time_window = url.searchParams.get("time_window") || "24h"; // 1h|6h|12h|24h|7d
    const channel_id = url.searchParams.get("channel_id") || undefined;
    const parent_url = url.searchParams.get("parent_url") || undefined;
    const provider = url.searchParams.get("provider") || "neynar";
    const viewer_fid = url.searchParams.get("viewer_fid") || undefined;

    const search = new URLSearchParams({ limit: String(limit), time_window, provider });
    if (channel_id) search.set("channel_id", channel_id);
    if (parent_url) search.set("parent_url", parent_url);
    if (viewer_fid) search.set("viewer_fid", String(viewer_fid));

    const endpoint = `${NEYNAR_BASE}/v2/farcaster/feed/trending/?${search.toString()}`;

    try {
      const res = await fetch(endpoint, {
        headers: { "x-api-key": NEYNAR },
      });
      if (!res.ok) {
        const text = await res.text();
        try { console.warn("/api/trending neynar failed", endpoint, res.status, text); } catch {}
        return NextResponse.json({ ok: false, error: "neynar_error", status: res.status, details: text }, { status: res.status });
      }

      const data = await res.json();
      const casts = Array.isArray(data?.casts) ? data.casts : [];
      try { console.log(`/api/trending fetched ${casts.length} casts from ${endpoint}`); } catch {}
      return NextResponse.json({ ok: true, data: casts, next: data?.next ?? null });
    } catch (e: any) {
      try { console.warn("/api/trending neynar fetch error", endpoint, e); } catch {}
      return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
