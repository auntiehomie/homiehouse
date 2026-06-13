import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { Tool, MessageParam, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages';
import { fetchNotifications, fetchCast, searchCasts } from '@/lib/hypersnap';
import { getTokenData, formatTokenDisplay } from '@/lib/token-data';
import { publishCast } from '@/lib/farcaster-writes';
import { verifyCronSecret } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';
import { hasRepliedToAny, recordReplyBatch } from '@/lib/bot-reply-storage';
import { buildFullMemoryContext, savePost } from '@/lib/agent-memory';

const HOMIEHOUSELOL_FID = parseInt(
  process.env.HOMIEHOUSELOL_FID || process.env.APP_FID || '0',
  10
);

const BOT_PERSONA = `You are @homiehouselol on Farcaster — a helpful friend for anyone learning about crypto, AI, and web3.

When someone mentions you:
- Give a clear, useful answer to their actual question
- Keep replies under 280 characters
- Be warm and direct, not robotic or over-formal
- Use your tools to look up real-time data when someone asks about a specific token, price, or topic
- For security questions, give cautious, practical advice
- If you're not sure about something, say so honestly

Topics you know well: crypto wallets, DeFi, Layer 2, AI in web3, smart contract security, NFTs, on-chain privacy, gas optimization

Never start with "Great question!" or use: "fascinating", "incredible", "as an AI language model", "I'd be happy to"`;

const TOOLS: Tool[] = [
  {
    name: 'get_token_info',
    description:
      'Get current price, market cap, volume, and other details about a cryptocurrency token. Use this when someone asks about a specific token, its price, or market data.',
    input_schema: {
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
  {
    name: 'search_farcaster_casts',
    description:
      'Search recent Farcaster posts about a topic. Use this to find what the community is saying about something before responding.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Number of results, max 8' },
      },
      required: ['query'],
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

async function generateReply(
  castText: string,
  authorUsername: string,
  memoryContext: string
): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages: MessageParam[] = [
    {
      role: 'user',
      content: `@${authorUsername} mentioned you and said: "${castText.slice(0, 500)}"\n\nWrite a helpful reply under 280 chars. Use a tool if you need real-time data to answer well.`,
    },
  ];

  // Tool-use loop — cap at 3 rounds to bound latency
  for (let round = 0; round < 3; round++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: BOT_PERSONA + memoryContext,
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find((b) => b.type === 'text');
      if (textBlock?.type === 'text') return textBlock.text.trim().slice(0, 280);
      throw new Error('No text in final response');
    }

    if (response.stop_reason === 'tool_use') {
      const toolCalls = response.content.filter((b) => b.type === 'tool_use');
      const toolResults: ToolResultBlockParam[] = [];

      for (const call of toolCalls) {
        if (call.type !== 'tool_use') continue;
        const result = await runTool(call.name, call.input as Record<string, any>);
        toolResults.push({ type: 'tool_result', tool_use_id: call.id, content: result });
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // Unexpected stop reason — extract whatever text is there
    const textBlock = response.content.find((b) => b.type === 'text');
    if (textBlock?.type === 'text') return textBlock.text.trim().slice(0, 280);
    throw new Error(`Unexpected stop_reason: ${response.stop_reason}`);
  }

  throw new Error('Tool-use loop exceeded max rounds');
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

    // Load memory (recent + top performers) once for this cron run
    const memoryContext = await buildFullMemoryContext(HOMIEHOUSELOL_FID);

    let repliedCount = 0;

    const notifData = await fetchNotifications({ fid: HOMIEHOUSELOL_FID, limit: 50 });
    const notifications: any[] =
      notifData?.data?.notifications ?? notifData?.notifications ?? [];

    console.log(`[agent/mention] ${notifications.length} notifications for FID ${HOMIEHOUSELOL_FID}`);

    for (const notification of notifications) {
      if (repliedCount >= 1) break; // One reply per cron run

      const cast = notification.cast ?? notification;
      if (!cast?.hash) continue;

      const notifType = notification.type ?? notification.notification_type;
      if (notifType && !['mention', 'reply'].includes(notifType)) continue;

      const castHash = cast.hash;
      const parentHash = cast.parent_hash || cast.parent_url || cast.hash;
      const rootParentHash = cast.root_parent_url || parentHash;

      const trackingKeys = [
        `hl_cast_${castHash}`,
        `hl_parent_${parentHash}`,
        `hl_root_${rootParentHash}`,
      ];

      const alreadyReplied = await hasRepliedToAny(trackingKeys);
      if (alreadyReplied) continue;

      // Confirm no existing in-thread reply
      try {
        const castData = await fetchCast(parentHash);
        const parentCast = castData?.data?.cast ?? castData?.cast;
        const directReplies: any[] = parentCast?.direct_replies ?? [];
        const botAlreadyReplied = directReplies.some(
          (r: any) => (r.author?.fid ?? r.fid) === HOMIEHOUSELOL_FID
        );
        if (botAlreadyReplied) {
          await recordReplyBatch({ trackingKeys, replyHash: 'already-replied', commandType: 'mention' });
          continue;
        }
      } catch {
        // Transient error — don't blacklist, retry next run
        console.warn(`[agent/mention] Could not fetch cast ${parentHash} to check replies — will retry`);
        continue;
      }

      try {
        const authorUsername = cast.author?.username || 'friend';
        const reply = await generateReply(cast.text || '', authorUsername, memoryContext);

        const signerKey = process.env.HOMIEHOUSELOL_SIGNER_KEY;
        const { castHash: replyHash } = await publishCast({
          text: reply,
          fid: HOMIEHOUSELOL_FID,
          parentCastHash: castHash,
          ...(signerKey ? { signerPrivateKey: signerKey } : {}),
        });

        // Persist reply to memory
        await savePost({
          fid: HOMIEHOUSELOL_FID,
          castHash: replyHash,
          text: reply,
          source: 'reply',
          topic: `reply to @${authorUsername}`,
        });

        console.log(`[agent/mention] Replied to @${authorUsername}: "${reply}"`);
        await recordReplyBatch({
          trackingKeys,
          replyHash,
          commandType: 'mention',
          replyText: reply,
        });
        repliedCount++;
      } catch (error: any) {
        // Don't blacklist on error — let next cron run retry
        console.error(`[agent/mention] Failed to reply to ${castHash}:`, error?.message);
      }
    }

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
