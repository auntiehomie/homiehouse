import { NextRequest, NextResponse } from "next/server";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fid = searchParams.get("fid");

  if (!fid) {
    return NextResponse.json({ error: "Missing fid" }, { status: 400 });
  }

  try {
    // Fetch user's following list with verified addresses
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/following?fid=${fid}&limit=150`,
      {
        headers: {
          accept: "application/json",
          api_key: NEYNAR_API_KEY || "",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Neynar API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Filter users who have verified Ethereum addresses
    const friendsWithAddresses = data.users
      .filter((user: any) => 
        user.verified_addresses?.eth_addresses?.length > 0
      )
      .map((user: any) => ({
        fid: user.fid,
        username: user.username,
        displayName: user.display_name,
        pfpUrl: user.pfp_url,
        ethAddresses: user.verified_addresses.eth_addresses,
      }))
      .slice(0, 50); // Limit to 50 friends for performance

    return NextResponse.json({ friends: friendsWithAddresses });
  } catch (error: any) {
    console.error("Error fetching friends:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch friends" },
      { status: 500 }
    );
  }
}
