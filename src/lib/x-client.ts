/**
 * X (Twitter) client — scaffold for the @homiehouselol chat agent, mirroring
 * the shape of src/lib/farcaster-writes.ts and src/lib/hypersnap.ts so the
 * eventual cron routes (agent/x-post, agent/x-mention) can reuse the same
 * persona/memory patterns as the Farcaster bot.
 *
 * NOT WIRED UP: every function throws a clear "not configured" error until
 * X_APP_KEY / X_APP_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET are set. This
 * is intentional — see docs/X_AGENT_STRATEGY.md for why (X's API moved to
 * pay-per-use pricing; posting costs real money per call, so this should
 * only go live once budget tracking (see recordXUsage below) and rate caps
 * are actually enforced end-to-end, not just scaffolded).
 *
 * Auth model: OAuth 1.0a with a permanent user access token/secret,
 * generated once in the X Developer Portal for the @homiehouselol account —
 * same "provision once, never expires" pattern as HOMIEHOUSELOL_SIGNER_KEY
 * for Farcaster. (OAuth 2.0 with PKCE is the alternative X recommends for
 * multi-user apps, but that requires an interactive login + refresh-token
 * flow that doesn't fit a single always-on bot account.)
 */

import { TwitterApi } from 'twitter-api-v2';

function isConfigured(): boolean {
  return Boolean(
    process.env.X_APP_KEY &&
    process.env.X_APP_SECRET &&
    process.env.X_ACCESS_TOKEN &&
    process.env.X_ACCESS_SECRET
  );
}

let _client: TwitterApi | null = null;

function getClient(): TwitterApi {
  if (!isConfigured()) {
    throw new Error(
      'X API not configured — set X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET. See docs/X_AGENT_STRATEGY.md.'
    );
  }
  if (!_client) {
    _client = new TwitterApi({
      appKey: process.env.X_APP_KEY!,
      appSecret: process.env.X_APP_SECRET!,
      accessToken: process.env.X_ACCESS_TOKEN!,
      accessSecret: process.env.X_ACCESS_SECRET!,
    });
  }
  return _client;
}

export interface XPost {
  id: string;
  text: string;
  authorId: string;
  authorUsername?: string;
  createdAt: string;
}

/**
 * Post a standalone tweet (or a reply, if replyToId is given).
 * Costs money per call under X's 2026 pay-per-use pricing — callers MUST
 * check recordXUsage()'s budget gate before calling this, not after.
 */
export async function postToX(text: string, replyToId?: string): Promise<{ id: string }> {
  const client = getClient();
  const res = await client.v2.tweet(
    text,
    replyToId ? { reply: { in_reply_to_tweet_id: replyToId } } : undefined
  );
  return { id: res.data.id };
}

/**
 * Fetch recent mentions of the authenticated account.
 * `sinceId` limits results to mentions newer than a previously-seen tweet ID
 * — always pass the last-seen ID once this is live, since unbounded mention
 * polling is one of the easiest ways to blow through the monthly read cap.
 */
export async function fetchXMentions(sinceId?: string): Promise<XPost[]> {
  const client = getClient();
  const me = await client.v2.me();
  const timeline = await client.v2.userMentionTimeline(me.data.id, {
    since_id: sinceId,
    max_results: 20,
    expansions: ['author_id'],
    'tweet.fields': ['created_at', 'author_id'],
  });

  const users = new Map((timeline.includes?.users ?? []).map((u) => [u.id, u.username]));
  return timeline.data.data.map((t) => ({
    id: t.id,
    text: t.text,
    authorId: t.author_id!,
    authorUsername: users.get(t.author_id!),
    createdAt: t.created_at!,
  }));
}

/**
 * Fetch a user's profile by username. Useful for the same "who is this
 * person" context the Farcaster bot builds via fetchUserByUsername.
 */
export async function fetchXUserByUsername(username: string): Promise<{ id: string; username: string; name: string } | null> {
  const client = getClient();
  const res = await client.v2.userByUsername(username);
  if (!res.data) return null;
  return { id: res.data.id, username: res.data.username, name: res.data.name };
}
