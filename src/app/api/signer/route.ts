import { NextRequest, NextResponse } from "next/server";

// Neynar signer management route
// GET: check signer status for a user's FID
// POST: create a new signer for a user

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_BASE = "https://api.neynar.com";

export async function POST(req: NextRequest) {
  try {
    if (!NEYNAR_API_KEY) {
      return NextResponse.json({ ok: false, error: "NEYNAR_API_KEY not configured" }, { status: 500 });
    }

    // Create a new signer
    const createUrl = `${NEYNAR_BASE}/v2/farcaster/signer`;
    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        "x-api-key": NEYNAR_API_KEY,
      },
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error("/api/signer create failed", createRes.status, errText);
      return NextResponse.json({ ok: false, error: "create_failed", details: errText }, { status: createRes.status });
    }

    const data = await createRes.json();
    console.log("/api/signer created:", JSON.stringify(data));

    return NextResponse.json({
      ok: true,
      signer_uuid: data.signer_uuid,
      public_key: data.public_key,
      status: data.status,
      signer_approval_url: data.signer_approval_url,
      fid: data.fid,
    });
  } catch (e: any) {
    console.error("/api/signer error", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const signer_uuid = url.searchParams.get("signer_uuid");

    if (!NEYNAR_API_KEY) {
      return NextResponse.json({ ok: false, error: "NEYNAR_API_KEY not configured" }, { status: 500 });
    }

    if (!signer_uuid) {
      return NextResponse.json({ ok: false, error: "missing signer_uuid" }, { status: 400 });
    }

    // Check signer status
    const statusUrl = `${NEYNAR_BASE}/v2/farcaster/signer?signer_uuid=${encodeURIComponent(signer_uuid)}`;
    const statusRes = await fetch(statusUrl, {
      headers: {
        "x-api-key": NEYNAR_API_KEY,
      },
    });

    if (!statusRes.ok) {
      const errText = await statusRes.text();
      console.warn("/api/signer status check failed", statusRes.status, errText);
      return NextResponse.json({ ok: false, error: "status_failed", details: errText }, { status: statusRes.status });
    }

    const data = await statusRes.json();
    return NextResponse.json({
      ok: true,
      signer_uuid: data.signer_uuid,
      status: data.status,
      fid: data.fid,
      public_key: data.public_key,
    });
  } catch (e: any) {
    console.error("/api/signer GET error", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
