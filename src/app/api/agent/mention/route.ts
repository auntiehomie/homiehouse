import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import OpenAI from 'openai';
import { fetchNotifications, fetchCast, fetchCastReplies, searchCasts } from '@/lib/hypersnap';
import { getTokenData, formatTokenDisplay } from '@/lib/token-data';
import { publishCast } from '@/lib/farcaster-writes';
import { verifyCronSecret } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';
import { hasRepliedToAny, recordReplyBatch } from '@/lib/bot-reply-storage';
import { buildFullMemoryContext, savePost } from '@/lib/agent-memory';
import { recordMention, buildUserMemoryContext, learnFromInteraction } from '@/lib/agent-user-memory';
import { llmChat } from '@/lib/llm';
import { buildReplySystem } from '@/lib/ai/persona';

export const maxDuration = 60;

const HOMIEHOUSELOL_FID = parseInt(
  process.env.HOMIEHOUSELOL_FID || process.env.APP_FID || '0',
  10
);

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_token_info',
      description:
        'Get current price, market cap, volume, and other details about a cryptocurrency token. Use this when someone asks about a specific token, its price, or market data.',
      parameters: {
        type: 'object',
        properties: {
          identifier: {
            type: 'string',
            description: 'Token name, symbol (e.g. "ETH"), or contract address',
          },
        },
        required: ['identifier'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_farcaster_casts',
      description:
        'Search recent Farcaster posts about a topic. Use this to find what the community is saying about something before responding.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Number of results, max 8' },
        },
        required: ['query'],
      },
    },
  },
];

async function runTool(name: string, input: Record<string, any>): Promise<string> {
  if (name === 'get_token_info') {
    try {
      const token = await getTokenData(input.identifier);
      if (!token) return `No data found for "${input.identifier}".`;
      return formatTokenDisplay(token).slice(0, 600);
    } catch (err: any) {
      return `Error fetching token data: ${err?.message}`;
    }
  }

  if (name === 'search_farcaster_casts') {
    try {
      const limit = Math.min(input.limit || 5, 8);
      const results = await searchCasts(input.query, limit);
      const casts: any[] = results?.casts ?? [];
      if (!casts.length) return 'No recent casts found on that topic.';
      return casts
        .map(
          (c: any) =>
            `@${c.author?.username || '?'}: "${(c.text || '').slice(0, 120)}" [${c.reactions?.likes_count || 0} likes]`
        )
        .join('\n');
    } catch (err: any) {
      return `Error searching casts: ${err?.message}`;
    }
  }

  return 'Unknown tool.';
}

/** Walk up the parent chain and return a formatted conversation thread (oldest first). */
async function fetchThreadChain(parentHash: string | null | undefined): Promise<string> {
  if (!parentHash) return '';
  const MAX_DEPTH = 4;
  const ancestors: Array<{ username: string; text: string }> = [];
  let currentHash: string | null = parentHash;

  for (let depth = 0; depth < MAX_DEPTH && currentHash; depth++) {
    try {
      const data = await fetchCast(currentHash);
      const c = data?.data?.cast ?? data?.cast;
      if (!c) break;
      ancestors.unshift({
        username: c.author?.username || 'unknown',
        text: (c.text || '').slice(0, 200),
      });
      currentHash = c.parent_hash || null;
    } catch {
      break;
    }
  }

  return ancestors.map(a => `@${a.username}: "${a.text}"`).join('\n');
}

async function generateReply(
  castText: string,
  authorUsername: string,
  memoryContext: string,
  threadContext: string,
  userContext: string,
): Promise<string | null> {
  try {
    const userContent = threadContext
      ? `Thread context (oldest → newest):\n${threadContext}\n\n@${authorUsername} then mentioned you: "${castText.slice(0, 400)}"\n\nWrite a helpful reply under 280 chars that fits this conversation. Use a tool if you need real-time data.`
      : `@${authorUsername} mentioned you and said: "${castText.slice(0, 500)}"\n\nWrite a helpful reply under 280 chars. Use a tool if you need real-time data to answer well.`;
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: buildReplySystem(memoryContext, userContext) },
      { role: 'user', content: userContent },
    ];

    // Tool-use loop — cap at 3 rounds to bound latency. llmChat falls back
    // across providers (Groq → Gemini → OpenRouter) if one is rate-limited.
    for (let round = 0; round < 3; round++) {
      const { message: msg } = await llmChat({
        messages,
        maxTokens: 300,
        tools: TOOLS,
      });
      if (!msg) break;

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        const text = (msg.content || '').trim().slice(0, 280);
        return text || null; // Don't fallback to 'hey' — return null if empty
      }

      // Execute tool calls and feed results back
      messages.push(msg);
      for (const call of msg.tool_calls) {
        const fn = (call as any).function;
        if (!fn) continue;
        const input = JSON.parse(fn.arguments || '{}');
        const result = await runTool(fn.name, input);
        messages.push({ role: 'tool', tool_call_id: call.id, content: result });
      }
    }
  } catch (err: any) {
    console.error('[agent/mention] All LLM providers failed:', err?.message);
    return null; // Don't fallback — return null so caller skips posting
  }

  return null; // All rounds exhausted without a final reply
}

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const { success: rateLimitOk } = rateLimit(`agent-mention:${ip}`, 20, 3600);
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

    // Load memory (recent + top performers) once for this cron run
    const memoryContext = await buildFullMemoryContext(HOMIEHOUSELOL_FID);

    let repliedCount = 0;

    const notifData = await fetchNotifications({ fid: HOMIEHOUSELOL_FID, limit: 50 });
    const rawNotifications: any[] =
      notifData?.data?.notifications ?? notifData?.notifications ?? [];

    const notifSummary = rawNotifications.map((n: any) => {
      const t = n.type ?? n.notification_type ?? '?';
      const h = ((n.cast ?? n)?.hash ?? '?').slice(0, 10);
      return `${t}:${h}`;
    }).join(' | ');
    console.error(`[agent/mention] DIAG fid=${HOMIEHOUSELOL_FID} count=${rawNotifications.length} types=[${notifSummary}]`);

    // Also search for recent casts mentioning @thehomie.
    // The notification index can lag by hours; cast search is usually fresh.
    let searchMentions: any[] = [];
    try {
      const searchData = await searchCasts('@thehomie', 15);
      const searchCastList: any[] = searchData?.casts ?? [];
      const notifHashes = new Set(
        rawNotifications.map((n: any) => (n.cast ?? n)?.hash).filter(Boolean)
      );
      searchMentions = searchCastList
        .filter((c: any) => c.hash && !notifHashes.has(c.hash))
        .filter((c: any) => c.author?.fid !== HOMIEHOUSELOL_FID)
        .map((c: any) => ({ type: 'mention', cast: c }));
      if (searchMentions.length > 0) {
        console.log(`[agent/mention] ${searchMentions.length} additional mention(s) via cast search`);
      }
    } catch (err: any) {
      console.warn('[agent/mention] Cast search fallback failed:', err?.message);
    }

    const notifications = [...rawNotifications, ...searchMentions];

    let attempted = 0;
    for (const notification of notifications) {
      if (attempted >= 1) break; // One Groq call per cron run regardless of outcome

      const cast = notification.cast ?? notification;
      const notifType = notification.type ?? notification.notification_type;
      const hash = cast?.hash ?? '(no hash)';
      console.log(`[agent/mention] notif type=${notifType} hash=${hash} author=@${cast?.author?.username ?? '?'}`);

      if (!cast?.hash) continue;

      if (notifType && !['mention', 'reply', 'curate', 'save'].includes(notifType)) {
        console.log(`[agent/mention] skip: type "${notifType}" not mention/reply`);
        continue;
      }

      // Skip mentions older than 24 hours to avoid processing the backlog
      const FARCASTER_EPOCH_MS = 1609459200000;
      const ts: number = cast.timestamp ?? 0;
      const castMs = ts > 1_000_000_000_000 ? ts : ts > 1_000_000_000 ? ts * 1000 : FARCASTER_EPOCH_MS + ts * 1000;
      const ageHours = (Date.now() - castMs) / 3_600_000;
      if (ts && ageHours > 24) {
        console.log(`[agent/mention] skip: ${cast.hash?.slice(0, 10)} is ${ageHours.toFixed(1)}h old`);
        continue;
      }

      const castHash = cast.hash;
      const parentHash = cast.parent_hash || cast.parent_url || cast.hash;
      const rootParentHash = cast.root_parent_url || parentHash;

      const trackingKeys = [
        `hl_cast_${castHash}`,
        `hl_parent_${parentHash}`,
        `hl_root_${rootParentHash}`,
      ];

      const alreadyReplied = await hasRepliedToAny(trackingKeys);
      if (alreadyReplied) {
        console.log(`[agent/mention] skip: already replied (matched key: ${alreadyReplied})`);
        continue;
      }

      // ─── HUB-BACKED DEDUP: Check the actual Farcaster thread for existing replies ───
      // This is the source-of-truth check. The DB cache (hasRepliedToAny) is a
      // secondary fast-path; this hub check catches cases where the DB was
      // wiped, cold-started, or out of sync.
      //
      // We use fetchCastReplies (feed filter by parent_hash) instead of
      // fetchCast because Hypersnap's /v2/farcaster/cast endpoint does NOT
      // return direct_replies (Hypersnap doesn't support that field). Without
      // this fix, the old code always saw an empty array and proceeded to
      // reply again, causing duplicate replies every cron run.
      try {
        const repliesData = await fetchCastReplies(castHash);
        const threadReplies: any[] = repliesData?.casts ?? repliesData?.data?.casts ?? [];
        const botAlreadyReplied = threadReplies.some(
          (r: any) => (r.author?.fid ?? r.fid) === HOMIEHOUSELOL_FID
        );
        if (botAlreadyReplied) {
          console.log(`[agent/mention] skip: bot already replied in thread (found via hub)`);
          await recordReplyBatch({ trackingKeys, replyHash: 'already-replied', commandType: 'mention' });
          continue;
        }
      } catch (fetchErr: any) {
        // FAIL-CLOSED: If we can't verify whether we already replied, skip.
        // Proceeding would risk duplicate replies when the hub API is unavailable.
        console.warn(`[agent/mention] Could not fetch replies for ${castHash} — skipping to prevent duplicates:`, fetchErr?.message);
        await recordReplyBatch({
          trackingKeys,
          replyHash: 'fetch-failed-skip',
          commandType: 'mention',
        }).catch(() => {});
        continue;
      }

      try {
        attempted++;
        const authorUsername = cast.author?.username || 'friend';
        const authorFid: number | undefined = cast.author?.fid;
        const threadContext = await fetchThreadChain(cast.parent_hash);
        if (threadContext) console.log(`[agent/mention] thread context (${threadContext.split('\n').length} turns)`);
        const userContext = authorFid ? await buildUserMemoryContext(authorFid) : '';
        const reply = await generateReply(cast.text || '', authorUsername, memoryContext, threadContext, userContext);

        // If all LLM providers failed, generateReply returns null.
        // DO NOT post a fallback "hey" — record as deferred and skip.
        // This prevents the bot from spamming generic replies when LLMs are down.
        if (!reply) {
          console.error(`[agent/mention] All LLM providers failed for ${castHash} — deferring, not posting`);
          await recordReplyBatch({
            trackingKeys,
            replyHash: 'llm-failed-deferred',
            commandType: 'mention',
          }).catch(() => {});
          continue;
        }

        // RECORD BEFORE POSTING: Insert dedup records BEFORE publishCast so that
        // if publishing succeeds but a subsequent step (savePost, recordMention,
        // learnFromInteraction) throws, the dedup entry already exists and
        // prevents the next cron run from re-replying to the same cast.
        await recordReplyBatch({
          trackingKeys,
          replyHash: 'pending',
          commandType: 'mention',
          replyText: reply,
        });

        const signerKey = process.env.HOMIEHOUSELOL_SIGNER_KEY;
        console.error(`[agent/mention] ATTEMPTING reply to @${authorUsername} (cast ${castHash.slice(0, 10)}): "${reply.slice(0, 60)}"`);
        const { castHash: replyHash } = await publishCast({
          text: reply,
          fid: HOMIEHOUSELOL_FID,
          parentCastHash: castHash,
          parentCastFid: cast.author?.fid,
          ...(signerKey ? { signerPrivateKey: signerKey } : {}),
        });

        // Update the dedup record with the actual reply hash (best effort).
        // ON CONFLICT DO UPDATE in recordReply ensures this overwrites 'pending'.
        await recordReplyBatch({
          trackingKeys,
          replyHash,
          commandType: 'mention',
          replyText: reply,
        }).catch(() => {});

        // Persist reply to memory (best-effort — reply already posted)
        await savePost({
          fid: HOMIEHOUSELOL_FID,
          castHash: replyHash,
          text: reply,
          source: 'reply',
          topic: `reply to @${authorUsername}`,
        }).catch(() => {});

        if (authorFid) {
          await recordMention(authorFid, authorUsername).catch(() => {});
          await learnFromInteraction({
            fid: authorFid,
            username: authorUsername,
            userMessage: cast.text || '',
            agentReply: reply,
          }).catch(() => {});
        }

        console.error(`[agent/mention] SUCCESS reply to @${authorUsername} replyHash=${replyHash}`);
        repliedCount++;
      } catch (error: any) {
        // Record the attempt even on failure to prevent infinite retry loops.
        // The previous code said "Don't blacklist on error — let next cron run retry"
        // which caused the bot to re-reply to the same cast every 5 minutes forever.
        console.error(`[agent/mention] FAILED reply to ${castHash}:`, error?.message);
        await recordReplyBatch({
          trackingKeys,
          replyHash: 'error-no-reply',
          commandType: 'mention',
        }).catch(() => {});
      }
    }

    console.error(`[agent/mention] DONE: checked=${notifications.length} replied=${repliedCount} fid=${HOMIEHOUSELOL_FID}`);
    return NextResponse.json({
      ok: true,
      checked: notifications.length,
      replied: repliedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[agent/mention] Error:', error?.message);
    return handleApiError(error, 'GET /agent/mention');
  }
}
