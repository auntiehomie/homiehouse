import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { fetchNotifications, fetchCast } from '@/lib/hypersnap';
import { publishCast } from '@/lib/farcaster-writes';
import { verifyCronSecret } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';
import { hasRepliedToAny, recordReplyBatch } from '@/lib/bot-reply-storage';

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

Topics you know well: crypto wallets, DeFi, Layer 2, AI in web3, smart contract security, NFTs, on-chain privacy, gas optimization

Never start with "Great question!" or use: "fascinating", "incredible", "as an AI language model", "I'd be happy to"`;

async function generateReply(castText: string, authorUsername: string): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 150,
    system: BOT_PERSONA,
    messages: [
      {
        role: 'user',
        content: `@${authorUsername} mentioned you and said: "${castText.slice(0, 500)}"\n\nWrite a helpful reply under 280 chars.`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected non-text response from Claude');
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
      if (alreadyReplied) {
        console.log(`[agent/mention] Already replied to ${alreadyReplied}, skipping`);
        continue;
      }

      // Confirm bot hasn't already replied in-thread
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
        // Conservative: skip if we can't verify
        await recordReplyBatch({ trackingKeys, replyHash: 'check-error', commandType: 'mention' });
        continue;
      }

      try {
        const authorUsername = cast.author?.username || 'friend';
        const reply = await generateReply(cast.text || '', authorUsername);

        const signerKey = process.env.HOMIEHOUSELOL_SIGNER_KEY;
        await publishCast({
          text: reply,
          fid: HOMIEHOUSELOL_FID,
          parentCastHash: castHash,
          ...(signerKey ? { signerPrivateKey: signerKey } : {}),
        });

        console.log(`[agent/mention] Replied to @${authorUsername}: "${reply}"`);
        await recordReplyBatch({ trackingKeys, replyHash: castHash, commandType: 'mention', replyText: reply });
        repliedCount++;
      } catch (error: any) {
        console.error(`[agent/mention] Failed to reply to ${castHash}:`, error?.message);
        await recordReplyBatch({ trackingKeys, replyHash: 'error', commandType: 'mention' });
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
