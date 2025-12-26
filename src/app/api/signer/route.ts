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

    // Get the user's FID from the request body
    const body = await req.json();
    const userFid = body.fid;

    if (!userFid) {
      return NextResponse.json({ ok: false, error: "User FID is required" }, { status: 400 });
    }

    // Create a signer and register it to the user's FID
    const createUrl = `${NEYNAR_BASE}/v2/farcaster/signer`;
    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api_key": NEYNAR_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({})
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error("/api/signer create failed", createRes.status, errText);
      return NextResponse.json({ ok: false, error: "create_failed", details: errText }, { status: createRes.status });
    }

    const data = await createRes.json();
    console.log("/api/signer created:", JSON.stringify(data));

    // Generate Warpcast approval URL manually using the public key and signer UUID
    const approvalUrl = `https://client.warpcast.com/deeplinks/signed-key-request?deeplinkUrl=${encodeURIComponent('https://homiehouse.vercel.app')}&token=${data.public_key}`;

    return NextResponse.json({
      ok: true,
      signer_uuid: data.signer_uuid,
      public_key: data.public_key,
      status: data.status,
      signer_approval_url: approvalUrl,
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
        "accept": "application/json",
        "api_key": NEYNAR_API_KEY,
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
