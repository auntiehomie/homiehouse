import { NextRequest, NextResponse } from "next/server";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_BASE = "https://api.neynar.com";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, signerUuid, fid } = body;

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

    if (!signerUuid) {
      return NextResponse.json(
        {
          ok: false,
          error: "no_signer",
          message: "You need to approve a signer first to post.",
        },
        { status: 403 }
      );
    }

    if (!NEYNAR_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "NEYNAR_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Publish cast using Neynar API
    const publishUrl = `${NEYNAR_BASE}/v2/farcaster/cast`;
    const publishRes = await fetch(publishUrl, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api_key": NEYNAR_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        signer_uuid: signerUuid,
        text: text.trim(),
      }),
    });

    if (!publishRes.ok) {
      const errorText = await publishRes.text();
      console.error("Neynar cast publish failed:", publishRes.status, errorText);
      return NextResponse.json(
        { ok: false, error: "Failed to publish cast", details: errorText },
        { status: publishRes.status }
      );
    }

    const result = await publishRes.json();
    console.log(`Cast published for FID ${fid}:`, result);

    return NextResponse.json({ ok: true, cast: result });
  } catch (e: any) {
    console.error("/api/compose error", e);
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
