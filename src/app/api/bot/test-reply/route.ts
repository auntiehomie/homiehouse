/**
 * GET /api/bot/test-reply
 *
 * Diagnostic endpoint: finds the first untracked mention/reply notification,
 * generates a reply via Groq, attempts to post it, and returns the full result.
 * Open (no auth) — remove after debugging.
 */
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { fetchNotifications, searchCasts } from '@/lib/hypersnap';
import { publishCast } from '@/lib/farcaster-writes';
import { hasRepliedToAny } from '@/lib/bot-reply-storage';

const HOMIEHOUSELOL_FID = parseInt(
  process.env.HOMIEHOUSELOL_FID || process.env.APP_FID || '0',
  10
);

function getGroq() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });
}

export async function GET(_req: NextRequest) {
  const url = new URL(_req.url);
  const result: any = {
    fid: HOMIEHOUSELOL_FID,
    groqKeySet: !!process.env.GROQ_API_KEY,
    signerKeySet: !!process.env.HOMIEHOUSELOL_SIGNER_KEY,
    steps: [],
  };

  try {
    // 1. Find a candidate notification
    const notifData = await fetchNotifications({ fid: HOMIEHOUSELOL_FID, limit: 20 });
    const rawNotifications: any[] =
      notifData?.data?.notifications ?? notifData?.notifications ?? [];
    result.steps.push(`fetchNotifications: ${rawNotifications.length} total`);

    const searchData = await searchCasts('@homiehouselol', 10);
    const searchList: any[] = searchData?.casts ?? [];
    const notifHashes = new Set(rawNotifications.map((n: any) => (n.cast ?? n)?.hash).filter(Boolean));
    const searchMentions = searchList
      .filter((c: any) => c.hash && !notifHashes.has(c.hash) && c.author?.fid !== HOMIEHOUSELOL_FID)
      .map((c: any) => ({ type: 'mention', cast: c }));
    result.steps.push(`searchCasts: ${searchMentions.length} additional`);

    const all = [...rawNotifications, ...searchMentions];
    let candidate: any = null;

    for (const notification of all) {
      const cast = notification.cast ?? notification;
      const notifType = notification.type ?? notification.notification_type;
      if (!cast?.hash) continue;
      if (notifType && !['mention', 'reply'].includes(notifType)) continue;

      const castHash = cast.hash;
      const parentHash = cast.parent_hash || cast.parent_url || cast.hash;
      const rootParentHash = cast.root_parent_url || parentHash;
      const keys = [`hl_cast_${castHash}`, `hl_parent_${parentHash}`, `hl_root_${rootParentHash}`];
      const alreadyReplied = await hasRepliedToAny(keys);
      if (alreadyReplied) {
        result.steps.push(`skip ${castHash.slice(0,10)}: already in DB (${alreadyReplied})`);
        continue;
      }
      candidate = { cast, castHash, parentHash, keys, notifType };
      break;
    }

    if (!candidate) {
      result.steps.push('no untracked mention/reply found');
      return NextResponse.json(result);
    }

    result.candidate = {
      hash: candidate.castHash,
      type: candidate.notifType,
      author: candidate.cast.author?.username,
      text: (candidate.cast.text || '').slice(0, 100),
    };
    result.steps.push(`candidate: @${candidate.cast.author?.username} "${(candidate.cast.text||'').slice(0,50)}"`);

    // 2. Generate reply (skip Groq if ?skipGroq=1)
    const skipGroq = url.searchParams.get('skipGroq') === '1';
    let reply: string;
    if (skipGroq) {
      reply = 'hey! 🏠';
      result.steps.push('groq: skipped (skipGroq=1), using fallback text');
    } else {
      try {
        const groq = getGroq();
        const response = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 150,
          messages: [
            { role: 'system', content: 'You are @homiehouselol, a helpful crypto/web3 friend on Farcaster. Reply in under 280 chars. Be warm and direct.' },
            { role: 'user', content: `@${candidate.cast.author?.username} said: "${(candidate.cast.text || '').slice(0, 300)}"` },
          ],
        });
        reply = response.choices[0]?.message?.content?.trim() || 'hey! 🏠';
        result.groqReply = reply;
        result.steps.push(`groq: generated "${reply.slice(0, 60)}"`);
      } catch (groqErr: any) {
        result.groqError = groqErr?.message;
        result.steps.push(`groq FAILED: ${groqErr?.message} — retry with ?skipGroq=1&post=1`);
        return NextResponse.json(result);
      }
    }

    // 3. Attempt publishCast — DRY_RUN by default, add ?post=1 to actually post
    const dryRun = url.searchParams.get('post') !== '1';
    const overrideHub = url.searchParams.get('hubUrl');
    if (overrideHub) {
      process.env.FARCASTER_HUB_URL = overrideHub;
      result.steps.push(`hub override: ${overrideHub}`);
    }
    result.dryRun = dryRun;

    if (!dryRun) {
      try {
        const signerKey = process.env.HOMIEHOUSELOL_SIGNER_KEY;
        const { castHash: replyHash } = await publishCast({
          text: reply,
          fid: HOMIEHOUSELOL_FID,
          parentCastHash: candidate.castHash,
          parentCastFid: candidate.cast.author?.fid,
          ...(signerKey ? { signerPrivateKey: signerKey } : {}),
        });
        result.publishSuccess = true;
        result.replyHash = replyHash;
        result.steps.push(`publishCast SUCCESS replyHash=${replyHash}`);
      } catch (pubErr: any) {
        result.publishError = pubErr?.message;
        result.steps.push(`publishCast FAILED: ${pubErr?.message}`);
      }
    } else {
      result.steps.push('dry run — add ?post=1 to actually post the reply');
    }
  } catch (err: any) {
    result.error = err?.message;
  }

  return NextResponse.json(result);
}
