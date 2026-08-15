import { NextRequest, NextResponse } from 'next/server';
import { isXConfigured, fetchXMentions, postToX } from '@/lib/x-client';
import { checkXBudget, recordXUsage } from '@/lib/x-budget';
import { hasRepliedToAny, recordReplyBatch } from '@/lib/bot-reply-storage';
import { getXState, setXState } from '@/lib/x-state';
import { verifyCronSecret } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';
import { explainXPost } from '@/lib/ai/x-explain';
import { rateLimit } from '@/lib/ratelimit';

export const maxDuration = 60;

const LAST_MENTION_KEY = 'last_mention_id';

/**
 * Reply-to-mentions cron for @thehomie on X — scaffold, not wired up.
 *
 * SCAFFOLD STATUS: same as agent/x-post — fetchXMentions()/postToX() throw
 * a clear "not configured" error until X credentials are set, so this is a
 * no-op until then, and it's not in vercel.json's cron list yet.
 *
 * Reuses bot-reply-storage.ts (already platform-agnostic — its
 * `parent_hash`/tracking-key columns are plain TEXT) for dedup, prefixing
 * keys with `x_` so X tweet IDs can never collide with Farcaster cast
 * hashes in the same bot_replies table.
 *
 * NOTE: does not yet use per-user memory (agent-user-memory.ts) the way the
 * Farcaster mention cron does — that table is keyed by numeric Farcaster
 * fid, and X user IDs are a different identifier space. See
 * docs/X_AGENT_STRATEGY.md's "future work" section: unifying cross-platform
 * user memory is a real product decision (do a Farcaster user and their X
 * account count as "the same person" to the agent?), not just a schema
 * tweak, so it's deliberately left out of this first scaffold.
 */

export async function GET(request: NextRequest) {
  try {
    verifyCronSecret(request, process.env.CRON_SECRET);

    // Rate limit: 10 requests/hour per IP (cron endpoint protection)
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`agent-x-mention:${ip}`, 10, 3600);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    // Explicit on-switch — off by default so live X spend never starts by accident.
    if (process.env.X_AGENT_ENABLED !== 'true') {
      return NextResponse.json({ ok: true, skipped: 'X_AGENT_ENABLED is not "true"' });
    }
    if (!isXConfigured()) {
      return NextResponse.json({ ok: true, skipped: 'not-configured' });
    }

    const readBudget = await checkXBudget('read');
    if (!readBudget.allowed) {
      console.log(`[agent/x-mention] Skipping — ${readBudget.reason}`);
      return NextResponse.json({ ok: true, skipped: 'budget', ...readBudget });
    }

    // since_id keeps the poll from re-reading (and re-paying for) handled mentions.
    const sinceId = (await getXState(LAST_MENTION_KEY)) ?? undefined;
    const mentions = await fetchXMentions(sinceId);
    await recordXUsage('read');

    let repliedCount = 0;
    let attempted = 0;
    let newestId = sinceId;

    // Oldest → newest so replies are chronological and the cursor advances past
    // everything we saw (even mentions we don't reply to).
    for (const mention of [...mentions].reverse()) {
      newestId = mention.id;

      if (attempted >= 1) continue; // one reply per cron run (matches the Farcaster cron)

      const trackingKey = `x_${mention.id}`;
      if (await hasRepliedToAny([trackingKey])) continue;

      // Explain the referenced (replied-to/quoted) post — that's the confusing
      // thing someone wants unpacked. Fall back to the mention's own text.
      const targetText = (mention.referencedText || mention.text || '').replace(/@\w+/g, '').trim();
      const targetAuthor = mention.referencedText ? mention.referencedAuthor : mention.authorUsername;
      if (!targetText) continue;

      const postBudget = await checkXBudget('post');
      if (!postBudget.allowed) {
        console.log(`[agent/x-mention] Skipping reply — ${postBudget.reason}`);
        break;
      }

      try {
        attempted++;
        const reply = await explainXPost(targetText, { author: targetAuthor });
        if (!reply) continue;

        const { id: replyId } = await postToX(reply, mention.id);
        await recordXUsage('post');

        await recordReplyBatch({
          trackingKeys: [trackingKey],
          replyHash: replyId,
          commandType: 'x-mention',
          replyText: reply,
        });
        repliedCount++;
      } catch (error: any) {
        console.error(`[agent/x-mention] FAILED reply to ${mention.id}:`, error?.message);
      }
    }

    if (newestId && newestId !== sinceId) {
      await setXState(LAST_MENTION_KEY, newestId);
    }

    return NextResponse.json({
      ok: true,
      checked: mentions.length,
      replied: repliedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error?.message?.includes('X API not configured')) {
      return NextResponse.json({ ok: true, skipped: 'not-configured' });
    }
    console.error('[agent/x-mention] Error:', error?.message);
    return handleApiError(error, 'GET /agent/x-mention');
  }
}
