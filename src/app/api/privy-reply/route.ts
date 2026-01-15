import { NextRequest, NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, castHash, accessToken } = body;

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

    // Use Neynar's API to publish reply
    const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
    const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;

    if (!NEYNAR_API_KEY || !NEYNAR_SIGNER_UUID) {
      return NextResponse.json(
        { error: "Neynar API not configured for publishing" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.neynar.com/v2/farcaster/cast", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api_key": NEYNAR_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        signer_uuid: NEYNAR_SIGNER_UUID,
        text,
        parent: castHash,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Privy Reply] Neynar API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Failed to publish reply", details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json({
      success: true,
      cast: result.cast,
    });

  } catch (error: any) {
    console.error("[Privy Reply] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to publish reply" },
      { status: 500 }
    );
  }
}
