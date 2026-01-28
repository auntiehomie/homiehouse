import { NextRequest, NextResponse } from "next/server";
import { fetchFollowing } from '@/lib/neynar';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateFid } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const logger = createApiLogger('/friends');
  logger.start();

  try {
    const { searchParams } = new URL(req.url);
    const fidParam = searchParams.get("fid");

    if (!fidParam) {
      return NextResponse.json({ error: "FID required" }, { status: 400 });
    }

    // Validate input
    const fid = validateFid(fidParam).toString();

    logger.info('Fetching following list', { fid });

    // Fetch following using shared utility
    const data = await fetchFollowing(fid, 100);

    const users = data?.users || [];
    logger.success('Following list fetched', { count: users.length });
    logger.end();

    return NextResponse.json({ data: users });
  } catch (error: any) {
    logger.error('Failed to fetch friends', error);
    return handleApiError(error, 'GET /friends');
  }
}
