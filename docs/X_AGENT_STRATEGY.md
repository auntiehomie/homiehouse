# @homiehouselol on X — strategy & activation guide

Status: **scaffolded, not live.** Code exists (`src/lib/x-client.ts`,
`src/lib/x-budget.ts`, `src/app/api/agent/x-post/route.ts`,
`src/app/api/agent/x-mention/route.ts`) but nothing calls X's API today —
every function throws a clear "not configured" error until credentials are
set, and the new routes are deliberately **not** in `vercel.json`'s cron
list yet. This doc is the plan for actually turning it on, and the reasoning
behind the choices already baked into the scaffold.

See `docs/HOMIEHOUSELOL_AGENT.md` for how the existing Farcaster side of the
bot works — this extends the same agent to a second platform rather than
building a separate bot.

## Why this needs a plan before code

Unlike Farcaster (Hypersnap's read API is free and unauthenticated, writes go
straight to a hub with no per-call cost), **X's API costs real money per
call as of 2026.** In February 2026 X moved new developers to pay-per-use by
default and closed the flat-rate Basic ($200/mo) and Pro ($5,000/mo) tiers to
new signups:

- **Writes**: ~$0.015 per post, $0.20 per post that contains a link
- **Reads**: ~$0.005 per read, with a hard 2,000,000 reads/month cap before
  you're forced onto Enterprise (~$42,000+/month)
- Legacy Basic/Pro tiers still exist for developers who already had them
  (50,000 posts/mo + 15,000 reads/mo on Basic), but aren't available to sign
  up for fresh

This is the opposite of every other integration in this codebase, where the
existing security audit's "uncontrolled AI costs" warning was about LLM
tokens, not the social platform itself. **A bug in a polling loop here isn't
just annoying — it's a bill.** That's why `x-budget.ts` exists and why the
routes are gated on it before every single API call, not just at startup.

## Architecture (mirrors the Farcaster bot)

| Farcaster | X (scaffolded) | Notes |
|---|---|---|
| `src/lib/hypersnap.ts` / `farcaster-writes.ts` | `src/lib/x-client.ts` | Thin wrapper; `twitter-api-v2` npm package instead of hand-rolling OAuth signing |
| `src/app/api/agent/tip/route.ts` | `src/app/api/agent/x-post/route.ts` | Same `persona.ts` voice, same `pickPostMode`/`postInstruction`. `trend-take` (needs a Farcaster cast) silently falls back to `tip`, same pattern as when no trend/news is found today |
| `src/app/api/agent/mention/route.ts` | `src/app/api/agent/x-mention/route.ts` | Same reply voice (`buildReplySystem`). One reply per cron run, same cap as the Farcaster version |
| `src/lib/agent-memory.ts` (`agent_posts`, keyed by Farcaster fid) | new `agent_x_posts` table, no fid — there's only one X account | Kept separate rather than overloading the fid-keyed schema |
| `src/lib/bot-reply-storage.ts` (`bot_replies`) | **reused directly** | Its tracking-key columns are already plain TEXT, not Farcaster-specific — X tweet IDs are stored as `x_<tweetId>` so they can never collide with Farcaster cast hashes in the same table |
| n/a (Hypersnap reads are free) | `src/lib/x-budget.ts` (`agent_x_usage`) | New: hard monthly caps on posts and reads, checked *before* every paid call |

### What's deliberately NOT reused: per-user memory

`src/lib/agent-user-memory.ts` (the Farcaster mention cron's "learn as users
mention it" memory, added alongside this scaffold) is keyed by numeric
Farcaster `fid`. X user IDs are a different identifier space, so the X
mention route doesn't build per-user context yet. Wiring that up isn't just a
schema change — it's a product decision: **does a Farcaster user and their X
account count as "the same person" to the agent's memory, or are they
separate relationships?** That needs an actual answer before building it,
not a default. See "Future work" below.

## Auth model: OAuth 1.0a, not OAuth 2.0 PKCE

X's docs recommend OAuth 2.0 with PKCE for posting, but that's built for
apps where *other people* log in with their own X accounts (interactive
authorization + refresh-token rotation). This bot only ever posts as itself.
OAuth 1.0a with a permanent user access token — generated once in the X
Developer Portal for the `@homiehouselol` account and never expiring — is
the standard pattern for single-account bots and matches how the rest of
this codebase already handles long-lived credentials (`APP_MNEMONIC`,
`HOMIEHOUSELOL_SIGNER_KEY`): provision once, store as an env var, done.

## Environment variables (not yet set anywhere)

```
X_APP_KEY=              # from X Developer Portal, "API Key"
X_APP_SECRET=            # "API Key Secret"
X_ACCESS_TOKEN=          # generated for the @homiehouselol account specifically
X_ACCESS_SECRET=
X_MONTHLY_POST_CAP=300   # optional, defaults to 300 (~10/day)
X_MONTHLY_READ_CAP=3000  # optional, defaults to 3000
```

## Activation checklist

1. Create/access an X Developer Portal project for `@homiehouselol`
2. Confirm write access is enabled (pay-per-use is enabled by default for
   new projects; double-check `tweet.write` scope is on)
3. Generate a permanent access token/secret pair for the account itself
   (not an OAuth2 app-login flow)
4. Set the five env vars above in Vercel
5. Hit `GET /api/agent/x-post?dry=1` manually (with the cron secret) and
   confirm it generates a post *without* publishing — check the voice reads
   right before spending a single cent on a real post
6. Run `GET /api/agent/x-post` once for real, confirm a post lands, confirm
   `agent_x_usage` incremented
7. Only then add both routes to `vercel.json`'s `crons` array, at a lower
   frequency than the Farcaster crons to start — e.g. once daily for
   `x-post`, every 15 min for `x-mention` — until real usage numbers justify
   matching the Farcaster cadence
8. Monitor `agent_x_usage` for the first week; adjust `X_MONTHLY_POST_CAP`/
   `X_MONTHLY_READ_CAP` based on what the account actually needs vs. what
   the pay-per-use bill looks like

## Future work / open product decisions

- **Cross-platform identity**: should a user who's active on both Farcaster
  and X be recognized as the same person by the agent's memory? If yes, that
  requires a way to *link* a Farcaster fid to an X user ID (self-reported?
  matched by username? not at all?) before `agent-user-memory.ts` can be
  extended to cover X.
- **Content strategy**: should X posts be the same content as Farcaster
  posts (cross-posted), fully independent, or overlapping-but-distinct
  (e.g. same `tip`/`chill`/`question` topics, different phrasing per
  platform's audience)? The scaffold currently generates fully independent
  content per platform — cheapest to reason about, but worth revisiting once
  there's real audience data on both sides.
- **Elevated read access**: the mention-polling cron currently does one
  `userMentionTimeline` call per run. If mention volume grows, consider
  X's filtered stream / webhook-based mention delivery instead of polling,
  which would change the read-cost math significantly.
