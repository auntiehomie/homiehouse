import { NextRequest, NextResponse } from "next/server";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

/**
 * POST /api/signer
 * Creates a new signer via Neynar API
 */
export async function POST(req: NextRequest) {
  console.log("[API /signer POST] ========== REQUEST START ==========");
  
  try {
    if (!NEYNAR_API_KEY) {
      console.error("[API /signer POST] ERROR: NEYNAR_API_KEY not configured");
      return NextResponse.json(
        { ok: false, error: "NEYNAR_API_KEY not configured" },
        { status: 500 }
      );
    }

    console.log("[API /signer POST] Creating new signer...");

    // Create a new signer using Neynar API
    const response = await fetch("https://api.neynar.com/v2/farcaster/signer", {
      method: "POST",
      headers: {
        accept: "application/json",
        api_key: NEYNAR_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    console.log("[API /signer POST] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API /signer POST] ❌ Neynar API error:");
      console.error("[API /signer POST] Status:", response.status);
      console.error("[API /signer POST] Error body:", errorText);
      
      return NextResponse.json(
        { ok: false, error: "Failed to create signer", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[API /signer POST] ✅ Signer created:", {
      signer_uuid: data.signer_uuid,
      status: data.status
    });
    console.log("[API /signer POST] ========== REQUEST END ==========");

    return NextResponse.json({
      ok: true,
      signer_uuid: data.signer_uuid,
      public_key: data.public_key,
      status: data.status,
      signer_approval_url: data.signer_approval_url,
      fid: data.fid,
    });
  } catch (error: any) {
    console.error("[API /signer POST] ❌ EXCEPTION:", error);
    console.error("[API /signer POST] Error message:", error.message);
    console.error("[API /signer POST] ========== REQUEST END (ERROR) ==========");
    
    return NextResponse.json(
      { ok: false, error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/signer?signer_uuid=...
 * Check the status of an existing signer
 */
export async function GET(req: NextRequest) {
  console.log("[API /signer GET] ========== REQUEST START ==========");
  
  try {
    const { searchParams } = new URL(req.url);
    const signerUuid = searchParams.get("signer_uuid");

    if (!signerUuid) {
      console.error("[API /signer GET] ERROR: Missing signer_uuid parameter");
      return NextResponse.json(
        { ok: false, error: "signer_uuid parameter required" },
        { status: 400 }
      );
    }

    if (!NEYNAR_API_KEY) {
      console.error("[API /signer GET] ERROR: NEYNAR_API_KEY not configured");
      return NextResponse.json(
        { ok: false, error: "NEYNAR_API_KEY not configured" },
        { status: 500 }
      );
    }

    console.log("[API /signer GET] Checking signer status:", signerUuid);

    // Check signer status using Neynar API
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/signer?signer_uuid=${encodeURIComponent(signerUuid)}`,
      {
        headers: {
          accept: "application/json",
          api_key: NEYNAR_API_KEY,
        },
      }
    );

    console.log("[API /signer GET] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API /signer GET] ❌ Neynar API error:");
      console.error("[API /signer GET] Status:", response.status);
      console.error("[API /signer GET] Error body:", errorText);
      
      return NextResponse.json(
        { ok: false, error: "Failed to check signer", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[API /signer GET] ✅ Signer status:", {
      signer_uuid: data.signer_uuid,
      status: data.status,
      fid: data.fid
    });
    console.log("[API /signer GET] ========== REQUEST END ==========");

    return NextResponse.json({
      ok: true,
      signer_uuid: data.signer_uuid,
      public_key: data.public_key,
      status: data.status,
      signer_approval_url: data.signer_approval_url,
      fid: data.fid,
    });
  } catch (error: any) {
    console.error("[API /signer GET] ❌ EXCEPTION:", error);
    console.error("[API /signer GET] Error message:", error.message);
    console.error("[API /signer GET] ========== REQUEST END (ERROR) ==========");
    
    return NextResponse.json(
      { ok: false, error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
