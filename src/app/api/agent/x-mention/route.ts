import { NextRequest, NextResponse } from 'next/server';
import { fetchXMentions, postToX } from '@/lib/x-client';
import { checkXBudget, recordXUsage } from '@/lib/x-budget';
import { hasRepliedToAny, recordReplyBatch } from '@/lib/bot-reply-storage';
import { verifyCronSecret } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';
import { llmChat } from '@/lib/llm';
import { buildReplySystem } from '@/lib/ai/persona';

export const maxDuration = 60;

/**
 * Reply-to-mentions cron for @homiehouselol on X — scaffold, not wired up.
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

async function generateXReply(text: string, authorUsername: string): Promise<string> {
  try {
    const { message } = await llmChat({
      messages: [
        { role: 'system', content: buildReplySystem() },
        {
          role: 'user',
          content: `@${authorUsername} mentioned you on X and said: "${text.slice(0, 500)}"\n\nWrite a helpful reply under 280 chars.`,
        },
      ],
      maxTokens: 200,
    });
    return (message.content || '').trim().slice(0, 280) || 'hey! 🏠';
  } catch (err: any) {
    console.error('[agent/x-mention] reply generation failed:', err?.message);
    return 'hey! 🏠';
  }
}

export async function GET(request: NextRequest) {
  try {
    verifyCronSecret(request, process.env.CRON_SECRET);

    const readBudget = await checkXBudget('read');
    if (!readBudget.allowed) {
      console.log(`[agent/x-mention] Skipping — ${readBudget.reason}`);
      return NextResponse.json({ ok: true, skipped: 'budget', ...readBudget });
    }

    const mentions = await fetchXMentions();
    await recordXUsage('read');

    let repliedCount = 0;
    let attempted = 0;

    for (const mention of mentions) {
      if (attempted >= 1) break; // one reply per cron run, same cap as the Farcaster mention cron

      const trackingKey = `x_${mention.id}`;
      const alreadyReplied = await hasRepliedToAny([trackingKey]);
      if (alreadyReplied) continue;

      const postBudget = await checkXBudget('post');
      if (!postBudget.allowed) {
        console.log(`[agent/x-mention] Skipping reply — ${postBudget.reason}`);
        break;
      }

      try {
        attempted++;
        const authorUsername = mention.authorUsername || 'friend';
        const reply = await generateXReply(mention.text, authorUsername);

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

    return NextResponse.json({
      ok: true,
      checked: mentions.length,
      replied: repliedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error?.message?.includes('X API not configured')) {
      console.log('[agent/x-mention] Not configured — skipping (this is expected until X credentials are provisioned)');
      return NextResponse.json({ ok: true, skipped: 'not-configured' });
    }
    console.error('[agent/x-mention] Error:', error?.message);
    return handleApiError(error, 'GET /agent/x-mention');
  }
}
