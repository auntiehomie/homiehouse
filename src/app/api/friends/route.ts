import { NextRequest, NextResponse } from "next/server";
import { fetchFollowing, getHypersnapReadDiagnostics } from '@/lib/hypersnap';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateFid } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const logger = createApiLogger('/friends');
  logger.start();

  try {
    const { searchParams } = new URL(req.url);
    const fidParam = searchParams.get("fid");
    const cursor = searchParams.get("cursor");

    if (!fidParam) {
      return NextResponse.json({ error: "FID required" }, { status: 400 });
    }

    // Validate input
    const fid = validateFid(fidParam);

    logger.info('Fetching following list', { fid });

    // Fetch following using shared utility
    const data = await fetchFollowing(fid, 100, cursor);

    const users = data?.users || [];
    logger.success('Following list fetched', { count: users.length });
    logger.end();

    return NextResponse.json({ data: users, cursor: data?.next?.cursor || null, meta: { readNode: getHypersnapReadDiagnostics(data) } });
  } catch (error: any) {
    logger.error('Failed to fetch friends', error);
    return handleApiError(error, 'GET /friends');
  }
}
