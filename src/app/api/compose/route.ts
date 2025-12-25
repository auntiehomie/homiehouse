import { NextRequest, NextResponse } from "next/server";

// Neynar cast publishing route
// Requires a signer_uuid for the user (obtained after they approve write permissions)

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_BASE = "https://api.neynar.com";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, signer_uuid, fid } = body;

    if (!NEYNAR_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "Server not configured for posting. Set NEYNAR_API_KEY." },
        { status: 500 }
      );
    }

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ ok: false, error: "Missing or empty text" }, { status: 400 });
    }

    if (!signer_uuid) {
      return NextResponse.json(
        {
          ok: false,
          error: "no_signer",
          message: "You need to approve write permissions first. Create a signer to post.",
        },
        { status: 403 }
      );
    }

    // Publish the cast using Neynar API
    const publishUrl = `${NEYNAR_BASE}/v2/farcaster/cast`;
    const publishRes = await fetch(publishUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": NEYNAR_API_KEY,
      },
      body: JSON.stringify({
        signer_uuid,
        text: text.trim(),
      }),
    });

    if (!publishRes.ok) {
      const errText = await publishRes.text();
      console.error("/api/compose publish failed", publishRes.status, errText);
      return NextResponse.json(
        { ok: false, error: "publish_failed", details: errText },
        { status: publishRes.status }
      );
    }

    const data = await publishRes.json();
    console.log(`/api/compose published cast for fid=${fid}`, data?.cast?.hash);
    return NextResponse.json({ ok: true, cast: data.cast });
  } catch (e: any) {
    console.error("/api/compose error", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
