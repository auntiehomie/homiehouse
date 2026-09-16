import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { createApiLogger } from '@/lib/logger';
import { fetchTrendingFeed } from '@/lib/hypersnap';
import { publishCast } from '@/lib/farcaster-writes';
import { verifyCronSecret } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';
import { buildFullMemoryContext, savePost, getRecentPosts } from '@/lib/agent-memory';
import { llmChat } from '@/lib/llm';
import { splitThreadCasts, tooSimilar, writeAgentPost } from '@/lib/agent-post';
import { fetchCryptoNews } from '@/lib/ai/news';
import {
  buildPostSystem,
  pickPostMode,
  postInstruction,
  pickFreshTopic,
  type PostMode,
  type PostModeDef,
  type KBArticle,
} from '@/lib/ai/persona';
import { pickFreshKBArticle } from '@/lib/kb-sync';

const logger = createApiLogger('/agent/tip');
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

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const { success: rateLimitOk } = rateLimit(`agent-tip:${ip}`, 20, 3600);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

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
      lastSource === 'tip' || lastSource === 'trend-take' || lastSource === 'news-take' ||
      lastSource === 'chill' || lastSource === 'question' ||
      lastSource === 'culture' || lastSource === 'deep-dive'
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
        logger.warn('Trend fetch failed', err);
      }
      if (trendCast) {
        trend = {
          author: trendCast.author?.username || 'someone',
          text: (trendCast.text || '').slice(0, 300),
        };
      } else {
        logger.info('No relevant trend — falling back to tip mode');
        chosen = { mode: 'tip', weight: 0, needsTrend: false, needsNews: false, needsKB: false };
      }
    }

    // If the chosen mode wants a real news story, resolve one via Perplexity's
    // web-search-backed sonar model — else fall back to a tip (same pattern as
    // the trend fallback above, and gracefully covers a missing PERPLEXITY_API_KEY).
    let news: { headline: string; summary: string; source?: string } | undefined;
    if (chosen.needsNews) {
      const article = await fetchCryptoNews();
      if (article) {
        news = article;
      } else {
        logger.info('No crypto news found — falling back to tip mode');
        chosen = { mode: 'tip', weight: 0, needsTrend: false, needsNews: false, needsKB: false };
      }
    }

    let kbArticle: KBArticle | undefined;
    if (chosen.needsKB) {
      const dbArticle = await pickFreshKBArticle(recentTopics);
      if (dbArticle) {
        kbArticle = {
          title: dbArticle.title,
          summary: dbArticle.summary || '',
          source: dbArticle.source || undefined,
          tags: dbArticle.tags,
        };
      }
    }

    let topic = chosen.mode === 'tip' ? pickFreshTopic(recentTopics) : undefined;
    const maxPostLength = chosen.mode === 'deep-dive'
      ? 640
      : chosen.mode === 'culture' || chosen.mode === 'trend-take' || chosen.mode === 'news-take'
        ? 320
        : 280;
    let content = await writeAgentPost(
      system,
      postInstruction(chosen.mode, { topic, trend, news, kbArticle }),
      { maxLen: maxPostLength },
    );

    // If it came out too close to a recent post, try once more with a different
    // topic (for tips) and an explicit "don't repeat yourself" nudge.
    if (content && tooSimilar(content, recentTexts)) {
      logger.info('First draft too similar to a recent post — retrying');
      if (chosen.mode === 'tip') topic = pickFreshTopic([...recentTopics, topic || '']);
      if (chosen.needsKB) {
        const retryArticle = await pickFreshKBArticle([...recentTopics, kbArticle?.title || '']);
        if (retryArticle) {
          kbArticle = {
            title: retryArticle.title,
            summary: retryArticle.summary || '',
            source: retryArticle.source || undefined,
            tags: retryArticle.tags,
          };
        }
      }
      const retryInstruction = postInstruction(chosen.mode, { topic, trend, news, kbArticle }) +
        '\n\nIMPORTANT: you very recently posted something almost identical. Say something clearly DIFFERENT — different angle, different wording, different point.';
      const retry = await writeAgentPost(system, retryInstruction, { maxLen: maxPostLength });
      if (retry) content = retry;
    }

    if (!content) throw new Error('LLM returned an empty post');

    // Still a near-duplicate? Skip this run rather than post a repeat.
    if (tooSimilar(content, recentTexts)) {
      logger.info('Skipping — still too similar to a recent post');
      return NextResponse.json({ ok: true, skipped: 'duplicate', mode: chosen.mode, content });
    }

    // Dry-run: generate and return the post WITHOUT publishing. Lets you preview
    // the voice safely (e.g. ?dry=1) before trusting the cron to post for real.
    const dryRun = new URL(request.url).searchParams.get('dry') === '1';
    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, mode: chosen.mode, content });
    }

    const signerKey = process.env.HOMIEHOUSELOL_SIGNER_KEY;

    // Deep-dive mode: if the LLM used "---" to separate multiple casts,
    // publish them as a threaded reply chain. Falls back to single cast if
    // anything goes wrong or there's no separator.
    if (chosen.mode === 'deep-dive') {
      const casts = splitThreadCasts(content);
      if (casts.length > 1) {
        try {
          const firstText = casts[0].slice(0, 640);
          const { castHash: firstHash } = await publishCast({
            text: firstText,
            fid: HOMIEHOUSELOL_FID,
            ...(signerKey ? { signerPrivateKey: signerKey } : {}),
          });

          await savePost({
            fid: HOMIEHOUSELOL_FID,
            castHash: firstHash,
            text: firstText,
            source: chosen.mode,
            topic: kbArticle?.title?.slice(0, 80) || topic || undefined,
          });

          let parentHash = firstHash;
          for (let i = 1; i < casts.length && i < 3; i++) {
            const replyText = casts[i].slice(0, 640);
            const { castHash: replyHash } = await publishCast({
              text: replyText,
              fid: HOMIEHOUSELOL_FID,
              parentCastHash: parentHash,
              parentCastFid: HOMIEHOUSELOL_FID,
              ...(signerKey ? { signerPrivateKey: signerKey } : {}),
            });
            await savePost({
              fid: HOMIEHOUSELOL_FID,
              castHash: replyHash,
              text: replyText,
              source: chosen.mode,
              topic: kbArticle?.title?.slice(0, 80) || topic || undefined,
            });
            parentHash = replyHash;
          }

          logger.success(`Posted thread (${chosen.mode}): ${casts.length} casts → ${firstHash}`);
          return NextResponse.json({
            ok: true,
            mode: chosen.mode,
            threaded: true,
            casts: casts.length,
            content: firstText,
            castHash: firstHash,
            timestamp: new Date().toISOString(),
          });
        } catch (threadErr: any) {
          logger.warn('Thread publish failed, falling back to single cast', threadErr);
          content = content.slice(0, 640);
        }
      }
    }

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
      topic: topic || trend?.text?.slice(0, 80) || news?.headline?.slice(0, 80) || kbArticle?.title?.slice(0, 80) || undefined,
    });

    logger.success(`Posted (${chosen.mode}): "${content}" → ${castHash}`);

    return NextResponse.json({
      ok: true,
      mode: chosen.mode,
      content,
      castHash,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Unhandled error', error);
    return handleApiError(error, 'GET /agent/tip');
  }
}
