import { NextRequest } from 'next/server';
import { privateJson } from '@/lib/private-response';
import { PREMIUM_TRACKS, PREMIUM_MODULE_IDS, getPremiumModule, getPremiumLessonContent } from '@/lib/premium-curriculum';
import { isProUser } from '@/lib/pro';
import { enforceRateLimit, rateLimitKeyFromRequest } from '@/lib/ratelimit';
import { createApiLogger } from '@/lib/logger';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';
export const dynamic = 'force-dynamic';

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

    // Anonymous visitors get teasers. Invalid credentials are an error,
    // rather than silently demoting a paying member to the free view.
    let isPro = false;
    if (['x-session-token', 'x-farcaster-fid', 'x-signer-key', 'authorization'].some(name => req.headers.has(name))) {
      const fid = await verifyFarcasterSignerAuth(req, 'read:all');
      isPro = await isProUser(fid);
    }

    // ── Single module detail (Pro only) ──────────────────────────────────────
    if (moduleId) {
      if (!PREMIUM_MODULE_IDS.has(moduleId)) {
        return privateJson(
          { ok: false, error: `Unknown module: ${moduleId}` },
          { status: 404 }
        );
      }

      if (!isPro) {
        const mod = getPremiumModule(moduleId);
        return privateJson({
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
      return privateJson({
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
        return privateJson(
          { ok: false, error: `Unknown track: ${trackId}. Available: ${PREMIUM_TRACKS.map(t => t.id).join(', ')}` },
          { status: 404 }
        );
      }

      if (!isPro) {
        return privateJson({
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

      return privateJson({
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

    return privateJson(
      {
        ok: true,
        pro_required: !isPro,
        tracks,
        ...(isPro ? { unlocked: true } : { message: 'Upgrade to Pro to unlock all premium content.' }),
      },
    );
  } catch (err: any) {
    if (err instanceof AuthError) {
      return privateJson({ ok: false, error: err.message }, { status: err.status });
    }
    logger.error('Premium track fetch failed', err);
    return privateJson(
      { ok: false, error: 'Failed to fetch premium tracks' },
      { status: 500 }
    );
  }
}
