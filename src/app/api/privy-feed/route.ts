import { NextRequest, NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accessToken = searchParams.get("accessToken");
    const fid = searchParams.get("fid");
    const cursor = searchParams.get("cursor");

    if (!accessToken && !fid) {
      return NextResponse.json({ error: "Access token or FID required" }, { status: 401 });
    }

    let userFid = fid;

    // If accessToken provided, get the user's FID
    if (accessToken && !fid) {
      const authTokenClaims = await privy.verifyAuthToken(accessToken);
      const userId = authTokenClaims.userId;
      const user = await privy.getUser(userId);
      const farcasterAccount = user.linkedAccounts.find(
        (account: any) => account.type === "farcaster"
      ) as any;
      
      if (farcasterAccount) {
        userFid = farcasterAccount.fid;
      }
    }

    // Fetch feed data from Neynar API
    const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

    if (!NEYNAR_API_KEY) {
      return NextResponse.json(
        { error: "Neynar API not configured" },
        { status: 500 }
      );
    }

    const params = new URLSearchParams();
    if (userFid) {
      params.append("fid", userFid);
    }
    if (cursor) {
      params.append("cursor", cursor);
    }
    params.append("limit", "25");

    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/feed?${params.toString()}`,
      {
        headers: {
          "accept": "application/json",
          "api_key": NEYNAR_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Privy Feed] Neynar API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Failed to fetch feed", details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json({
      success: true,
      casts: result.casts || [],
      next: result.next || null,
    });

  } catch (error: any) {
    console.error("[Privy Feed] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch feed" },
      { status: 500 }
    );
  }
}
