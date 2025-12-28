import { NextRequest, NextResponse } from "next/server";

// Neynar cast publishing route using managed signer

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;
const NEYNAR_BASE = "https://api.neynar.com";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, fid } = body;

    if (!NEYNAR_API_KEY || !NEYNAR_SIGNER_UUID) {
      return NextResponse.json(
        { ok: false, error: "Server not configured for posting. Set NEYNAR_API_KEY and NEYNAR_SIGNER_UUID." },
        { status: 500 }
      );
    }

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ ok: false, error: "Missing or empty text" }, { status: 400 });
    }

    if (!fid) {
      return NextResponse.json(
        {
          ok: false,
          error: "no_user",
          message: "You need to sign in first to post.",
        },
        { status: 403 }
      );
    }

    // Publish the cast using the managed signer
    const publishUrl = `${NEYNAR_BASE}/v2/farcaster/cast`;
    const publishRes = await fetch(publishUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api_key": NEYNAR_API_KEY,
      },
      body: JSON.stringify({
        signer_uuid: NEYNAR_SIGNER_UUID,
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
