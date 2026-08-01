import { NextRequest, NextResponse } from 'next/server';
import { fetchCast } from '@/lib/hypersnap';
import { verifyCronSecret } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';
import { getPostsNeedingEngagementCheck, updatePostEngagement } from '@/lib/agent-memory';
import { rateLimit } from '@/lib/ratelimit';

const HOMIEHOUSELOL_FID = parseInt(
  process.env.HOMIEHOUSELOL_FID || process.env.APP_FID || '0',
  10
);

function extractEngagement(castData: any): { likes: number; recasts: number; replies: number } {
  const cast = castData?.data?.cast ?? castData?.cast ?? castData;
  return {
    likes:   cast?.reactions?.likes_count   ?? cast?.reactions?.likes?.length   ?? 0,
    recasts: cast?.reactions?.recasts_count ?? cast?.reactions?.recasts?.length ?? 0,
    replies: cast?.replies?.count           ?? cast?.replies?.length            ?? 0,
  };
}

export async function GET(request: NextRequest) {
  try {
    verifyCronSecret(request, process.env.CRON_SECRET);

    // Rate limit: 10 requests/hour per IP (cron endpoint protection)
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`agent-engagement-check:${ip}`, 10, 3600);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    if (!HOMIEHOUSELOL_FID) {
      return NextResponse.json(
        { ok: false, error: 'HOMIEHOUSELOL_FID (or APP_FID) not configured' },
        { status: 500 }
      );
    }

    const posts = await getPostsNeedingEngagementCheck(HOMIEHOUSELOL_FID, 15);
    console.log(`[agent/engagement-check] Checking ${posts.length} posts`);

    const results: Array<{ castHash: string; likes: number; recasts: number; replies: number; score: number }> = [];

    for (const post of posts) {
      if (!post.cast_hash) continue;
      try {
        const castData = await fetchCast(post.cast_hash);
        const { likes, recasts, replies } = extractEngagement(castData);
        await updatePostEngagement({ castHash: post.cast_hash, likes, recasts, replies });
        const score = likes + recasts * 2 + replies;
        results.push({ castHash: post.cast_hash, likes, recasts, replies, score });
        console.log(`[agent/engagement-check] ${post.cast_hash.slice(0, 10)}… → score ${score} (${likes}❤️ ${recasts}🔁 ${replies}💬)`);
      } catch (err: any) {
        console.warn(`[agent/engagement-check] Could not fetch ${post.cast_hash}:`, err?.message);
      }
    }

    const totalScore = results.reduce((s, r) => s + r.score, 0);
    const avgScore = results.length ? Math.round(totalScore / results.length) : 0;

    return NextResponse.json({
      ok: true,
      checked: results.length,
      avgEngagementScore: avgScore,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[agent/engagement-check] Error:', error?.message);
    return handleApiError(error, 'GET /agent/engagement-check');
  }
}
