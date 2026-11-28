import { NextRequest, NextResponse } from "next/server";
import { custodyAddressOf } from "@/lib/farcaster-custody";
import { rateLimit } from "@/lib/ratelimit";

/**
 * GET /api/custody-address?fid=12345
 * Returns the custody address that owns a given FID: the IdRegistry on
 * Optimism for legacy FIDs, Hypersnap's native registry for native FIDs.
 */
export async function GET(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const { success: rateLimitOk } = await rateLimit(
    `custody-addr:${ip}`,
    30,
    60,
  );
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const fidParam = searchParams.get("fid");

  if (!fidParam) {
    return NextResponse.json(
      { error: "fid parameter required" },
      { status: 400 },
    );
  }

  const fid = /^\d{1,16}$/.test(fidParam) ? Number(fidParam) : NaN;
  if (!Number.isSafeInteger(fid) || fid <= 0) {
    return NextResponse.json({ error: "Invalid FID" }, { status: 400 });
  }

  try {
    const custodyAddress = await custodyAddressOf(fid);
    if (!custodyAddress) {
      return NextResponse.json({ error: "Unknown FID" }, { status: 404 });
    }

    return NextResponse.json(
      { fid, custodyAddress },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (err: any) {
    console.error("custody-address error:", err.shortMessage || err.message);
    return NextResponse.json(
      {
        error:
          err.shortMessage || err.message || "Failed to fetch custody address",
      },
      { status: 500 },
    );
  }
}
