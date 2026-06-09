import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { publishCast } from '@/lib/farcaster-writes';

const HOMIEHOUSELOL_FID = parseInt(
  process.env.HOMIEHOUSELOL_FID || process.env.APP_FID || '0',
  10
);

const BOT_PERSONA = `You are @homiehouselol on Farcaster — a helpful friend for anyone learning about crypto, AI, and web3.

When someone mentions you:
- Give a clear, useful answer to their actual question
- Keep replies under 280 characters
- Be warm and direct, not robotic or over-formal
- For security questions, give cautious, practical advice
- If you're not sure about something, say so honestly
- It's fine to suggest they look something up or ask an expert for big financial decisions

Topics you know well: crypto wallets, DeFi, Layer 2, AI in web3, smart contract security, NFTs, on-chain privacy, gas optimization

Never start with "Great question!" or use: "fascinating", "incredible", "as an AI language model", "I'd be happy to"`;

function verifyNeynarSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.NEYNAR_WEBHOOK_SECRET;
  if (!secret) return true; // No secret configured — allow all (useful in dev)
  if (!signature) return false;

  const hmac = createHmac('sha512', secret);
  hmac.update(rawBody);
  const expected = hmac.digest('hex');

  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  let rawBody = '';
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not read body' }, { status: 400 });
  }

  const signature = request.headers.get('X-Neynar-Signature');
  if (!verifyNeynarSignature(rawBody, signature)) {
    return NextResponse.json({ ok: false, error: 'Invalid webhook signature' }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  // Only process cast.created events (mentions trigger this)
  if (body.type !== 'cast.created') {
    return NextResponse.json({ ok: true, skipped: `event type: ${body.type}` });
  }

  const cast = body.data;
  if (!cast?.hash) {
    return NextResponse.json({ ok: false, error: 'Missing cast data' }, { status: 400 });
  }

  // Don't reply to ourselves
  if (cast.author?.fid === HOMIEHOUSELOL_FID) {
    return NextResponse.json({ ok: true, skipped: 'own cast' });
  }

  if (!HOMIEHOUSELOL_FID) {
    console.error('[agent/mention] HOMIEHOUSELOL_FID not configured');
    return NextResponse.json({ ok: false, error: 'Bot FID not configured' }, { status: 500 });
  }

  try {
    const authorUsername = cast.author?.username || 'friend';
    const castText = (cast.text || '').slice(0, 500);

    console.log(`[agent/mention] Mention from @${authorUsername}: "${castText.slice(0, 80)}..."`);

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 150,
      system: BOT_PERSONA,
      messages: [
        {
          role: 'user',
          content: `@${authorUsername} mentioned you and said: "${castText}"\n\nWrite a helpful reply under 280 chars.`,
        },
      ],
    });

    const block = response.content[0];
    if (block.type !== 'text') {
      throw new Error('Unexpected non-text response from Claude');
    }

    const reply = block.text.trim().slice(0, 280);
    console.log(`[agent/mention] Reply to @${authorUsername}: "${reply}"`);

    const signerKey = process.env.HOMIEHOUSELOL_SIGNER_KEY;
    const { castHash: replyHash } = await publishCast({
      text: reply,
      fid: HOMIEHOUSELOL_FID,
      parentCastHash: cast.hash,
      ...(signerKey ? { signerPrivateKey: signerKey } : {}),
    });

    console.log(`[agent/mention] Reply posted: ${replyHash}`);
    return NextResponse.json({ ok: true, reply, replyHash });
  } catch (error: any) {
    console.error('[agent/mention] Error generating/posting reply:', error?.message);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to reply' },
      { status: 500 }
    );
  }
}
