import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { publishCast } from '@/lib/farcaster-writes';
import { verifyCronSecret } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';

const HOMIEHOUSELOL_FID = parseInt(
  process.env.HOMIEHOUSELOL_FID || process.env.APP_FID || '0',
  10
);

const TOPICS = [
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

Your tips should be:
- Practical and specific (teach something actionable)
- Accessible (explain jargon when you use it)
- Max 280 characters
- Warm and conversational, not textbook-style
- Occasionally use a relevant emoji

Never use: "fascinating", "incredible", "game-changing", "revolutionary", "dive into", "unpack"
Write like a knowledgeable friend, not a press release.`;

function getTopicForNow(): string {
  // Rotate through topics based on day — gives variety without randomness
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return TOPICS[dayIndex % TOPICS.length];
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

    const topic = getTopicForNow();
    console.log(`[agent/tip] Generating tip on: ${topic}`);

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
    if (block.type !== 'text') {
      throw new Error('Unexpected non-text response from Claude');
    }

    const tip = block.text.trim().slice(0, 280);
    console.log(`[agent/tip] Generated: "${tip}"`);

    const signerKey = process.env.HOMIEHOUSELOL_SIGNER_KEY;
    const { castHash } = await publishCast({
      text: tip,
      fid: HOMIEHOUSELOL_FID,
      ...(signerKey ? { signerPrivateKey: signerKey } : {}),
    });

    console.log(`[agent/tip] Posted cast ${castHash}`);

    return NextResponse.json({
      ok: true,
      tip,
      castHash,
      topic,
      fid: HOMIEHOUSELOL_FID,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[agent/tip] Error:', error?.message);
    return handleApiError(error, 'GET /agent/tip');
  }
}
