import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { postToX } from '@/lib/x-client';
import { checkXBudget, recordXUsage } from '@/lib/x-budget';
import { verifyCronSecret } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';
import { getDb } from '@/lib/db';
import { llmChat } from '@/lib/llm';
import { fetchCryptoNews } from '@/lib/ai/news';
import { buildPostSystem, pickPostMode, postInstruction, pickFreshTopic, type PostMode } from '@/lib/ai/persona';
import { rateLimit } from '@/lib/ratelimit';

export const maxDuration = 60;

/**
 * Autonomous posting cron for @thehomie on X — scaffold, not wired up.
 *
 * SCAFFOLD STATUS: this route is safe to deploy as-is. postToX() throws a
 * clear "not configured" error until X_APP_KEY etc. are set, so until then
 * this is a no-op every time Vercel calls it. It is NOT in vercel.json's
 * cron list yet — see docs/X_AGENT_STRATEGY.md for the activation checklist
 * before adding it there.
 *
 * Deliberately reuses the exact persona (persona.ts) and post-mode logic
 * (pickPostMode/postInstruction) as the Farcaster posting cron
 * (agent/tip/route.ts) so @thehomie sounds like the same person on
 * both platforms — only the trend-take mode (which needs a Farcaster cast
 * to react to) isn't meaningful here, so it silently falls back to a tip,
 * the same way agent/tip already falls back when no trend is found.
 */

// ─── Minimal local memory (agent_x_posts) — separate from agent_posts, which
// is keyed by Farcaster fid. Mirrors agent-memory.ts's shape and fail-silent
// behavior but scoped to the one X account this bot runs as. ─────────────────

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS agent_x_posts (
    id         SERIAL PRIMARY KEY,
    x_post_id  TEXT,
    text       TEXT NOT NULL,
    source     TEXT NOT NULL DEFAULT 'tip',
    topic      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

interface XAgentPost {
  text: string;
  source: string;
  topic: string | null;
}

async function getRecentXPosts(limit = 8): Promise<XAgentPost[]> {
  try {
    const db = getDb();
    await db.query(CREATE_TABLE_SQL);
    const { rows } = await db.query<XAgentPost>(
      `SELECT text, source, topic FROM agent_x_posts ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  } catch (err) {
    console.warn('[agent/x-post] getRecentXPosts failed:', (err as Error).message);
    return [];
  }
}

async function saveXPost(params: { xPostId?: string; text: string; source: string; topic?: string }): Promise<void> {
  try {
    const db = getDb();
    await db.query(CREATE_TABLE_SQL);
    await db.query(
      `INSERT INTO agent_x_posts (x_post_id, text, source, topic) VALUES ($1, $2, $3, $4)`,
      [params.xPostId ?? null, params.text, params.source, params.topic ?? null]
    );
  } catch (err) {
    console.warn('[agent/x-post] saveXPost failed:', (err as Error).message);
  }
}

// ─── Dedup — identical logic to agent/tip/route.ts, duplicated rather than
// imported so this scaffold can't accidentally change the live Farcaster
// posting behavior. ───────────────────────────────────────────────────────

function contentWords(s: string): Set<string> {
  return new Set((s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 3));
}
function similarity(a: string, b: string): number {
  const x = contentWords(a);
  const y = contentWords(b);
  if (!x.size || !y.size) return 0;
  let inter = 0;
  for (const w of x) if (y.has(w)) inter++;
  return inter / (x.size + y.size - inter);
}
function tooSimilar(text: string, recentTexts: string[], threshold = 0.4): boolean {
  return recentTexts.some((r) => similarity(text, r) >= threshold);
}
function cleanPost(text: string): string {
  return text.trim().replace(/^["']|["']$/g, '').slice(0, 280).trim();
}

async function writeXPost(system: string, instruction: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const model = process.env.AGENT_POST_MODEL || 'claude-sonnet-5';
      const res = await anthropic.messages.create({
        model,
        max_tokens: 160,
        temperature: 0.85,
        system,
        messages: [{ role: 'user', content: instruction }],
      });
      const block = res.content[0];
      if (block?.type === 'text' && block.text.trim()) return cleanPost(block.text);
      throw new Error('empty Anthropic response');
    } catch (err: any) {
      console.warn('[agent/x-post] Anthropic post failed, using free providers:', err?.message);
    }
  }
  const { message } = await llmChat({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: instruction },
    ],
    maxTokens: 160,
    temperature: 0.85,
  });
  return cleanPost(message.content || '');
}

export async function GET(request: NextRequest) {
  try {
    verifyCronSecret(request, process.env.CRON_SECRET);

    // Rate limit: 10 requests/hour per IP (cron endpoint protection)
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`agent-x-post:${ip}`, 10, 3600);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const budget = await checkXBudget('post');
    if (!budget.allowed) {
      console.log(`[agent/x-post] Skipping — ${budget.reason}`);
      return NextResponse.json({ ok: true, skipped: 'budget', ...budget });
    }

    const recentPosts = await getRecentXPosts(8);
    const recentTexts = recentPosts.map((p) => p.text).filter(Boolean);
    const recentTopics = recentPosts.map((p) => p.topic || '').filter(Boolean);
    const lastSource = recentPosts[0]?.source as PostMode | undefined;
    const lastMode: PostMode | null =
      lastSource === 'tip' || lastSource === 'trend-take' || lastSource === 'news-take' ||
      lastSource === 'chill' || lastSource === 'question'
        ? lastSource : null;

    let chosen = pickPostMode(lastMode);
    // trend-take needs a Farcaster cast, which doesn't make sense to react to
    // on X — treat it the same as "no trend found" and fall back to a tip.
    if (chosen.needsTrend) {
      chosen = { mode: 'tip', weight: 0, needsTrend: false, needsNews: false };
    }

    // news-take works the same on X as on Farcaster — it's a reaction to a
    // real web news story, not a platform-specific cast, so it's fully reusable.
    let news: { headline: string; summary: string; source?: string } | undefined;
    if (chosen.needsNews) {
      const article = await fetchCryptoNews();
      if (article) {
        news = article;
      } else {
        chosen = { mode: 'tip', weight: 0, needsTrend: false, needsNews: false };
      }
    }

    const system = buildPostSystem(); // no cross-platform memory context yet — see strategy doc
    let topic = chosen.mode === 'tip' ? pickFreshTopic(recentTopics) : undefined;
    let content = await writeXPost(system, postInstruction(chosen.mode, { topic, news }));

    if (content && tooSimilar(content, recentTexts)) {
      if (chosen.mode === 'tip') topic = pickFreshTopic([...recentTopics, topic || '']);
      const retry = await writeXPost(
        system,
        postInstruction(chosen.mode, { topic, news }) +
          '\n\nIMPORTANT: you very recently posted something almost identical. Say something clearly DIFFERENT.'
      );
      if (retry) content = retry;
    }

    if (!content) throw new Error('LLM returned an empty post');
    if (tooSimilar(content, recentTexts)) {
      return NextResponse.json({ ok: true, skipped: 'duplicate', mode: chosen.mode, content });
    }

    const dryRun = new URL(request.url).searchParams.get('dry') === '1';
    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, mode: chosen.mode, content });
    }

    const { id } = await postToX(content);
    await recordXUsage('post');
    await saveXPost({ xPostId: id, text: content, source: chosen.mode, topic: topic || news?.headline?.slice(0, 80) });

    return NextResponse.json({ ok: true, mode: chosen.mode, content, xPostId: id, timestamp: new Date().toISOString() });
  } catch (error: any) {
    if (error?.message?.includes('X API not configured')) {
      console.log('[agent/x-post] Not configured — skipping (this is expected until X credentials are provisioned)');
      return NextResponse.json({ ok: true, skipped: 'not-configured' });
    }
    console.error('[agent/x-post] Error:', error?.message);
    return handleApiError(error, 'GET /agent/x-post');
  }
}
