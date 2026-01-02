import { NextRequest, NextResponse } from "next/server";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const { castHash, signerUuid } = await req.json();

    if (!NEYNAR_API_KEY) {
      return NextResponse.json({ ok: false, error: "NEYNAR_API_KEY not configured" }, { status: 500 });
    }

    if (!castHash || !signerUuid) {
      return NextResponse.json({ ok: false, error: "Missing castHash or signerUuid" }, { status: 400 });
    }

    // Recast using Neynar API
    const response = await fetch("https://api.neynar.com/v2/farcaster/reaction", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api_key": NEYNAR_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        signer_uuid: signerUuid,
        reaction_type: "recast",
        target: castHash,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Recast failed:", errorText);
      return NextResponse.json({ ok: false, error: "Failed to recast" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    console.error("Recast error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const castHash = searchParams.get("castHash");
    const signerUuid = searchParams.get("signerUuid");

    if (!NEYNAR_API_KEY) {
      return NextResponse.json({ ok: false, error: "NEYNAR_API_KEY not configured" }, { status: 500 });
    }

    if (!castHash || !signerUuid) {
      return NextResponse.json({ ok: false, error: "Missing castHash or signerUuid" }, { status: 400 });
    }

    // Remove recast using Neynar API
    const response = await fetch(`https://api.neynar.com/v2/farcaster/reaction?signer_uuid=${signerUuid}&reaction_type=recast&target=${castHash}`, {
      method: "DELETE",
      headers: {
        "accept": "application/json",
        "api_key": NEYNAR_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Remove recast failed:", errorText);
      return NextResponse.json({ ok: false, error: "Failed to remove recast" }, { status: response.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Remove recast error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
