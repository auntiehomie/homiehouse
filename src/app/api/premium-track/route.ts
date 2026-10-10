import { NextRequest, NextResponse } from 'next/server';
import { PREMIUM_TRACKS, PREMIUM_MODULE_IDS, getPremiumModule, getPremiumLessonContent } from '@/lib/premium-curriculum';
import { isProUser } from '@/lib/pro';
import { enforceRateLimit, rateLimitKeyFromRequest } from '@/lib/ratelimit';
import { createApiLogger } from '@/lib/logger';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';

// GET /api/premium-track — return premium track listings and module detail
//
// Query params:
//   ?module=prem-defi-yield  → full module content (Pro only)
//   ?track=defi              → single track with modules (teaser for free, full for Pro)
//   (no params)              → all tracks with module summaries
//
// Free users receive track metadata + module titles/descriptions but not full content.
// Pro subscribers receive everything.

export async function GET(req: NextRequest) {
  const logger = createApiLogger('/premium-track');
  logger.start();

  try {
    await enforceRateLimit({
      key: rateLimitKeyFromRequest(req),
      limit: 30,
      windowSeconds: 60,
      label: 'premium-track',
    });

    const { searchParams } = new URL(req.url);
    const moduleId = searchParams.get('module');
    const trackId = searchParams.get('track');

    // Determine if user is Pro — best-effort, auth is optional for public teasers
    let isPro = false;
    try {
      const fid = await verifyFarcasterSignerAuth(req);
      if (fid) {
        isPro = await isProUser(fid);
      }
    } catch {
      // Auth is not required — free users see teasers
    }

    // ── Single module detail (Pro only) ──────────────────────────────────────
    if (moduleId) {
      if (!PREMIUM_MODULE_IDS.has(moduleId)) {
        return NextResponse.json(
          { ok: false, error: `Unknown module: ${moduleId}` },
          { status: 404 }
        );
      }

      if (!isPro) {
        const mod = getPremiumModule(moduleId);
        return NextResponse.json({
          ok: true,
          pro_required: true,
          module: mod
            ? {
                id: mod.id,
                title: mod.title,
                description: mod.description,
                estimatedMinutes: mod.estimatedMinutes,
                difficulty: mod.difficulty,
                tags: mod.tags,
                track: mod.track,
                teaser: mod.whyItMatters,
              }
            : null,
          message: 'Upgrade to Pro to unlock full premium content.',
        });
      }

      // Pro user — return full module with lesson content
      const mod = getPremiumModule(moduleId);
      const lesson = getPremiumLessonContent(moduleId);
      return NextResponse.json({
        ok: true,
        pro_required: false,
        module: mod,
        lesson,
        unlocked: true,
      });
    }

    // ── Single track ─────────────────────────────────────────────────────────
    if (trackId) {
      const track = PREMIUM_TRACKS.find(t => t.id === trackId);
      if (!track) {
        return NextResponse.json(
          { ok: false, error: `Unknown track: ${trackId}. Available: ${PREMIUM_TRACKS.map(t => t.id).join(', ')}` },
          { status: 404 }
        );
      }

      if (!isPro) {
        return NextResponse.json({
          ok: true,
          pro_required: true,
          track: {
            id: track.id,
            emoji: track.emoji,
            title: track.title,
            description: track.description,
            moduleCount: track.modules.length,
            totalMinutes: track.modules.reduce((sum, m) => sum + m.estimatedMinutes, 0),
            modules: track.modules.map(m => ({
              id: m.id,
              title: m.title,
              description: m.description,
              estimatedMinutes: m.estimatedMinutes,
              difficulty: m.difficulty,
              tags: m.tags,
              teaser: m.whyItMatters,
            })),
          },
          message: 'Upgrade to Pro to access full premium track content.',
        });
      }

      return NextResponse.json({
        ok: true,
        pro_required: false,
        track: {
          id: track.id,
          emoji: track.emoji,
          title: track.title,
          description: track.description,
          modules: track.modules,
        },
        unlocked: true,
      });
    }

    // ── All tracks summary ───────────────────────────────────────────────────
    const tracks = PREMIUM_TRACKS.map(track => ({
      id: track.id,
      emoji: track.emoji,
      title: track.title,
      description: track.description,
      moduleCount: track.modules.length,
      totalMinutes: track.modules.reduce((sum, m) => sum + m.estimatedMinutes, 0),
      modules: track.modules.map(m => ({
        id: m.id,
        title: m.title,
        description: m.description,
        estimatedMinutes: m.estimatedMinutes,
        difficulty: m.difficulty,
        tags: m.tags,
        ...(isPro ? { objectives: m.objectives, whyItMatters: m.whyItMatters } : {}),
      })),
    }));

    return NextResponse.json(
      {
        ok: true,
        pro_required: !isPro,
        tracks,
        ...(isPro ? { unlocked: true } : { message: 'Upgrade to Pro to unlock all premium content.' }),
      },
      {
        headers: {
          'Cache-Control': isPro
            ? 'private, s-maxage=60, stale-while-revalidate=300'
            : 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    logger.error('Premium track fetch failed', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch premium tracks' },
      { status: 500 }
    );
  }
}