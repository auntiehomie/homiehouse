import { NextRequest, NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";
import { fetchFeed } from '@/lib/neynar';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateFid } from '@/lib/validation';

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export async function GET(request: NextRequest) {
  const logger = createApiLogger('/privy-feed');
  logger.start();

  try {
    const { searchParams } = new URL(request.url);
    const accessToken = searchParams.get("accessToken");
    const fidParam = searchParams.get("fid");
    const cursor = searchParams.get("cursor");

    if (!accessToken && !fidParam) {
      return NextResponse.json({ error: "Access token or FID required" }, { status: 401 });
    }

    let userFid = fidParam;

    // If accessToken provided, get the user's FID
    if (accessToken && !fidParam) {
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

    // Validate FID
    const fid = userFid ? validateFid(userFid).toString() : undefined;

    logger.info('Fetching feed for Privy user', { fid });

    // Fetch feed using shared utility
    const data = await fetchFeed({
      fid,
      cursor: cursor || undefined,
      limit: 25,
    });

    const casts = data?.casts || [];
    logger.success('Feed fetched', { count: casts.length });
    logger.end();

    return NextResponse.json({
      success: true,
      casts,
      next: data.next || null,
    });
  } catch (error: any) {
    logger.error('Failed to fetch Privy feed', error);
    return handleApiError(error, 'GET /privy-feed');
  }
}
