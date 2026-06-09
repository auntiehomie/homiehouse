import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { fetchTrendingFeed } from '@/lib/hypersnap';
import { publishCast } from '@/lib/farcaster-writes';
import { verifyCronSecret } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';

const HOMIEHOUSELOL_FID = parseInt(
  process.env.HOMIEHOUSELOL_FID || process.env.APP_FID || '0',
  10
);

const DAILY_TOPICS = [
  'how blockchain wallets work and why your seed phrase is sacred',
  'what DeFi liquidity pools are and how AMMs price tokens',
  'how AI models are being used in Web3 and what to watch for',
  'wallet security: hardware wallets, seed phrases, and phishing',
  'Layer 2 solutions: how Optimism and Base scale Ethereum',
  'smart contract security: common exploits and how to stay safe',
  'on-chain privacy: what is and isn\'t private by default',
  'NFTs beyond art: digital ownership, provenance, and real utility',
  'gas fees explained: what they are and how to minimize them',
  'understanding token approvals and why you should revoke old ones',
  'what a DAO is and how on-chain governance actually works',
  'AI agents in crypto: autonomous bots trading and executing code',
];

const SYSTEM_PROMPT = `You are @homiehouselol on Farcaster — a friendly, knowledgeable guide for crypto, AI, and web3.

Your posts should be:
- Practical and specific (teach something actionable)
- Accessible (explain jargon when you use it)
- Max 280 characters
- Warm and conversational, not textbook-style
- Occasionally use a relevant emoji

Never use: "fascinating", "incredible", "game-changing", "revolutionary", "dive into", "unpack"
Write like a knowledgeable friend, not a press release.`;

const RELEVANCE_CHECK_PROMPT = `You are filtering trending Farcaster posts to find ones relevant to crypto, DeFi, AI, web3, wallets, security, or blockchain.

Given a list of trending cast texts, return ONLY the index numbers (0-based) of posts that:
- Discuss crypto, DeFi, NFTs, tokens, wallets, or blockchain
- Discuss AI, ML, or autonomous agents
- Discuss web3, decentralization, or on-chain activity
- Contain a security question or concern about digital assets

Return a JSON array of index numbers, e.g. [0, 2, 5]. Return [] if nothing is relevant.
Return ONLY the JSON array, no other text.`;

function getDailyTopic(): string {
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return DAILY_TOPICS[dayIndex % DAILY_TOPICS.length];
}

async function pickRelevantTrend(casts: any[]): Promise<any | null> {
  if (!casts.length) return null;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const castList = casts
    .slice(0, 20)
    .map((c: any, i: number) => `[${i}] ${(c.text || '').slice(0, 120)}`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 64,
    system: RELEVANCE_CHECK_PROMPT,
    messages: [{ role: 'user', content: castList }],
  });

  const block = response.content[0];
  if (block.type !== 'text') return null;

  let indices: number[] = [];
  try {
    indices = JSON.parse(block.text.trim());
  } catch {
    return null;
  }

  if (!indices.length) return null;

  // Pick the most-engaged relevant cast
  const candidates = indices
    .filter((i) => i >= 0 && i < casts.length)
    .map((i) => casts[i])
    .sort((a: any, b: any) => {
      const engA = (a.reactions?.likes_count || 0) + (a.replies?.count || 0);
      const engB = (b.reactions?.likes_count || 0) + (b.replies?.count || 0);
      return engB - engA;
    });

  return candidates[0] ?? null;
}

async function generateTrendPost(cast: any): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const author = cast.author?.username || 'someone';
  const text = (cast.text || '').slice(0, 300);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 150,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `This is trending on Farcaster right now — @${author} said: "${text}"\n\nWrite a standalone post (not a reply) that adds useful context, a tip, or a helpful take on this topic. Max 280 chars.`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected Claude response');
  return block.text.trim().slice(0, 280);
}

async function generateDailyTip(topic: string): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 150,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Write a helpful tip about: ${topic}. Max 280 characters. Be specific and practical.`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected Claude response');
  return block.text.trim().slice(0, 280);
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

    let content: string;
    let source: 'trend' | 'daily-tip';
    let meta: Record<string, string> = {};

    // Try trending first
    try {
      const trendData = await fetchTrendingFeed({ limit: 20 });
      const casts: any[] = trendData?.casts ?? trendData?.data?.casts ?? [];

      const trendCast = await pickRelevantTrend(casts);
      if (trendCast) {
        content = await generateTrendPost(trendCast);
        source = 'trend';
        meta = { trendAuthor: trendCast.author?.username || '', trendText: (trendCast.text || '').slice(0, 80) };
        console.log(`[agent/tip] Using trend from @${meta.trendAuthor}`);
      } else {
        throw new Error('No relevant trends found');
      }
    } catch (trendErr: any) {
      // Fall back to daily tip
      const topic = getDailyTopic();
      console.log(`[agent/tip] Trend unavailable (${trendErr?.message}), using daily topic: ${topic}`);
      content = await generateDailyTip(topic);
      source = 'daily-tip';
      meta = { topic };
    }

    const signerKey = process.env.HOMIEHOUSELOL_SIGNER_KEY;
    const { castHash } = await publishCast({
      text: content,
      fid: HOMIEHOUSELOL_FID,
      ...(signerKey ? { signerPrivateKey: signerKey } : {}),
    });

    console.log(`[agent/tip] Posted (${source}): "${content}" → ${castHash}`);

    return NextResponse.json({
      ok: true,
      source,
      content,
      castHash,
      ...meta,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[agent/tip] Error:', error?.message);
    return handleApiError(error, 'GET /agent/tip');
  }
}
