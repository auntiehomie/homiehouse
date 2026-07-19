import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { fetchTrendingFeed } from '@/lib/hypersnap';
import { publishCast } from '@/lib/farcaster-writes';
import { verifyCronSecret } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';
import { buildFullMemoryContext, savePost, getRecentPosts } from '@/lib/agent-memory';
import { llmChat } from '@/lib/llm';
import {
  buildPostSystem,
  pickPostMode,
  postInstruction,
  pickFreshTopic,
  type PostMode,
} from '@/lib/ai/persona';

export const maxDuration = 60;

const HOMIEHOUSELOL_FID = parseInt(
  process.env.HOMIEHOUSELOL_FID || process.env.APP_FID || '0',
  10
);

const RELEVANCE_SYSTEM = `You filter trending Farcaster posts for ones relevant to crypto, DeFi, NFTs, tokens, wallets, security, blockchain, AI/agents, or web3/decentralization. Given a numbered list of cast texts, return ONLY a JSON array of the 0-based indices that are relevant, e.g. [0,2,5]. Return [] if none. No other text.`;

/** Ask the LLM which trending casts are on-topic, then return the most-engaged one. */
async function pickRelevantTrend(casts: any[]): Promise<any | null> {
  if (!casts.length) return null;
  const castList = casts
    .slice(0, 20)
    .map((c: any, i: number) => `[${i}] ${(c.text || '').slice(0, 120)}`)
    .join('\n');

  try {
    const { message } = await llmChat({
      messages: [
        { role: 'system', content: RELEVANCE_SYSTEM },
        { role: 'user', content: castList },
      ],
      maxTokens: 64,
      temperature: 0,
    });
    const raw = (message.content || '')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    const indices: number[] = JSON.parse(raw);
    if (!Array.isArray(indices) || !indices.length) return null;

    const candidates = indices
      .filter((i) => i >= 0 && i < casts.length)
      .map((i) => casts[i])
      .sort((a: any, b: any) => {
        const engA = (a.reactions?.likes_count || 0) + (a.replies?.count || 0);
        const engB = (b.reactions?.likes_count || 0) + (b.replies?.count || 0);
        return engB - engA;
      });
    return candidates[0] ?? null;
  } catch {
    return null;
  }
}

function cleanPost(text: string): string {
  return text
    .trim()
    .replace(/^["']|["']$/g, '') // strip wrapping quotes some models add
    .slice(0, 280)
    .trim();
}

// ─── Near-duplicate detection ─────────────────────────────────────────────────
// Word-overlap (Jaccard) check so the agent doesn't re-post the same idea reworded
// (e.g. two "block explorers / etherscan" tips a day apart).
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

/**
 * Generate a post.
 *
 * Prefers Claude when ANTHROPIC_API_KEY is set — posting is low-volume (a couple
 * a day) so the cost is negligible and the voice is noticeably better. Falls back
 * to the free provider stack (Groq/Gemini/OpenRouter) if there's no key or Claude
 * errors, so autonomous posting can never break from a missing/expired paid key.
 * (Replies stay fully on the free stack — they run far more often.)
 */
async function writePost(system: string, instruction: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const model = process.env.AGENT_POST_MODEL || 'claude-haiku-4-5-20251001';
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
      console.warn('[agent/tip] Anthropic post failed, using free providers:', err?.message);
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

    if (!HOMIEHOUSELOL_FID) {
      return NextResponse.json(
        { ok: false, error: 'HOMIEHOUSELOL_FID (or APP_FID) not configured' },
        { status: 500 }
      );
    }

    // Memory keeps the agent from repeating itself and biases toward what landed.
    const memoryContext = await buildFullMemoryContext(HOMIEHOUSELOL_FID);
    const system = buildPostSystem(memoryContext);

    // Recent posts drive dedup: avoid the last mode, avoid recently-used tip
    // topics, and reject content that's too similar to something posted recently.
    let recentPosts: Awaited<ReturnType<typeof getRecentPosts>> = [];
    try {
      recentPosts = await getRecentPosts(HOMIEHOUSELOL_FID, 12);
    } catch {}
    const recentTexts = recentPosts.map((p) => p.text).filter(Boolean);
    const recentTopics = recentPosts.map((p) => p.topic || '').filter(Boolean);
    const lastSource = recentPosts[0]?.source as PostMode | undefined;
    const lastMode: PostMode | null =
      lastSource === 'tip' || lastSource === 'trend-take' || lastSource === 'chill' || lastSource === 'question'
        ? lastSource : null;

    let chosen = pickPostMode(lastMode);

    // If the chosen mode reacts to a trend, resolve one — else fall back to a tip.
    let trend: { author: string; text: string } | undefined;
    if (chosen.needsTrend) {
      let trendCast: any = null;
      try {
        const trendData = await fetchTrendingFeed({ limit: 20 });
        const casts: any[] = trendData?.casts ?? trendData?.data?.casts ?? [];
        trendCast = await pickRelevantTrend(casts);
      } catch (err: any) {
        console.warn('[agent/tip] trend fetch failed:', err?.message);
      }
      if (trendCast) {
        trend = {
          author: trendCast.author?.username || 'someone',
          text: (trendCast.text || '').slice(0, 300),
        };
      } else {
        console.log('[agent/tip] no relevant trend — falling back to tip mode');
        chosen = { mode: 'tip', weight: 0, needsTrend: false };
      }
    }

    let topic = chosen.mode === 'tip' ? pickFreshTopic(recentTopics) : undefined;
    let content = await writePost(system, postInstruction(chosen.mode, { topic, trend }));

    // If it came out too close to a recent post, try once more with a different
    // topic (for tips) and an explicit "don't repeat yourself" nudge.
    if (content && tooSimilar(content, recentTexts)) {
      console.log('[agent/tip] first draft too similar to a recent post — retrying');
      if (chosen.mode === 'tip') topic = pickFreshTopic([...recentTopics, topic || '']);
      const retryInstruction = postInstruction(chosen.mode, { topic, trend }) +
        '\n\nIMPORTANT: you very recently posted something almost identical. Say something clearly DIFFERENT — different angle, different wording, different point.';
      const retry = await writePost(system, retryInstruction);
      if (retry) content = retry;
    }

    if (!content) throw new Error('LLM returned an empty post');

    // Still a near-duplicate? Skip this run rather than post a repeat.
    if (tooSimilar(content, recentTexts)) {
      console.log('[agent/tip] skipping — still too similar to a recent post');
      return NextResponse.json({ ok: true, skipped: 'duplicate', mode: chosen.mode, content });
    }

    // Dry-run: generate and return the post WITHOUT publishing. Lets you preview
    // the voice safely (e.g. ?dry=1) before trusting the cron to post for real.
    const dryRun = new URL(request.url).searchParams.get('dry') === '1';
    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, mode: chosen.mode, content });
    }

    const signerKey = process.env.HOMIEHOUSELOL_SIGNER_KEY;
    const { castHash } = await publishCast({
      text: content,
      fid: HOMIEHOUSELOL_FID,
      ...(signerKey ? { signerPrivateKey: signerKey } : {}),
    });

    await savePost({
      fid: HOMIEHOUSELOL_FID,
      castHash,
      text: content,
      source: chosen.mode,
      topic: topic || trend?.text?.slice(0, 80) || undefined,
    });

    console.log(`[agent/tip] Posted (${chosen.mode}): "${content}" → ${castHash}`);

    return NextResponse.json({
      ok: true,
      mode: chosen.mode,
      content,
      castHash,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[agent/tip] Error:', error?.message);
    return handleApiError(error, 'GET /agent/tip');
  }
}
