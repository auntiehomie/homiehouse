import { NextRequest, NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { castHash, accessToken } = body;

    if (!accessToken) {
      return NextResponse.json({ error: "Access token required" }, { status: 401 });
    }

    // Verify the user's access token
    const authTokenClaims = await privy.verifyAuthToken(accessToken);
    const userId = authTokenClaims.userId;

    // Get user's linked Farcaster account
    const user = await privy.getUser(userId);
    const farcasterAccount = user.linkedAccounts.find(
      (account: any) => account.type === "farcaster"
    ) as any;

    if (!farcasterAccount) {
      return NextResponse.json({ error: "No Farcaster account linked" }, { status: 400 });
    }

    const fid = farcasterAccount.fid;

    // Use Neynar's API to like cast
    const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
    const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;

    if (!NEYNAR_API_KEY || !NEYNAR_SIGNER_UUID) {
      return NextResponse.json(
        { error: "Neynar API not configured" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.neynar.com/v2/farcaster/reaction", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api_key": NEYNAR_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        signer_uuid: NEYNAR_SIGNER_UUID,
        reaction_type: "like",
        target: castHash,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Privy Like] Neynar API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Failed to like cast", details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json({
      success: true,
      result,
    });

  } catch (error: any) {
    console.error("[Privy Like] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to like cast" },
      { status: 500 }
    );
  }
}
