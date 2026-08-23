# HomieHouse QA Regression Checklist

> Run through this checklist after every backlog update, monetization change, or deployment.
> Each section covers a feature area. Check every item before marking a release as verified.

---

## 1. Auth & Sign-in

- [ ] Privy SIWF sign-in completes and redirects to feed
- [ ] Farcaster-native sign-in (if implemented) authenticates and sets `hh_profile` in localStorage
- [ ] Sign-out clears all session state — no stale FID persists
- [ ] Account switch refreshes all user-scoped state (Pro badge, HH2 balance, owned items)
- [ ] Protected API routes return 401 without a valid Bearer token
- [ ] API routes that accept `fid` verify it against the authenticated user (no IDOR)

## 2. Scheduled Casts

### Client-side (all fetches must include Authorization header)
- [ ] `ScheduledCastsModal.tsx` — `fetchScheduledCasts()` sends Bearer token
- [ ] `ScheduledCastsModal.tsx` — `cancelCast()` sends Bearer token
- [ ] `ComposeModal.tsx` — schedule POST sends Bearer token
- [ ] `scheduled/page.tsx` — all fetch calls (GET, DELETE, cancelAll, POST) send Bearer token

### API-side
- [ ] POST `/api/schedule-cast` — no token → 401
- [ ] POST `/api/schedule-cast` — invalid/expired token → 401
- [ ] POST `/api/schedule-cast` — valid token without Farcaster identity → 403
- [ ] POST `/api/schedule-cast` — valid token, mismatched FID → 403, no DB mutation
- [ ] POST `/api/schedule-cast` — correct user/FID → success
- [ ] GET `/api/schedule-cast` — no token → 401
- [ ] GET `/api/schedule-cast` — valid token, no scheduled casts → empty list (not error)
- [ ] GET `/api/schedule-cast` — user A's casts visible only to user A
- [ ] DELETE `/api/schedule-cast` — no token → 401
- [ ] DELETE `/api/schedule-cast` — cancelAll=true cancels only the requesting user's casts
- [ ] PATCH `/api/schedule-cast` — no token → 401
- [ ] `signer_private_key` / `private_key` in request body is ignored and never stored
- [ ] Cron publish job (`/api/publish-scheduled-casts`) processes pending casts correctly
- [ ] Failed casts get `status='failed'` with error_message

## 3. HH2 Shop & Balance

### Balance calculation
- [ ] `claimed` is subtracted from the balance (earned - claimed - spent, not earned - spent)
- [ ] Completed lessons correctly count toward earned HH2
- [ ] HH2 claims reduce available balance
- [ ] Previous purchases reduce available balance

### Purchase flow (POST /api/hh2-purchase)
- [ ] Signed-out users cannot purchase (401)
- [ ] User A cannot purchase using User B's FID (403)
- [ ] Shop prices match server-side `ITEM_PRICES` for all 5 items
- [ ] Exact-balance purchase succeeds and leaves zero
- [ ] One-HH2-short purchase returns 402 without inserting anything
- [ ] Invalid item IDs are rejected (400)
- [ ] Repeat purchase of same item returns 409
- [ ] Concurrent purchases of same item create exactly one row (unique constraint)
- [ ] Concurrent purchases that together exceed balance cannot overspend

### Ownership query (GET /api/hh2-purchase)
- [ ] Signed-out users cannot retrieve ownership state (401)
- [ ] Returns only the authenticated user's owned items

## 4. Pro Tier

- [ ] `/api/pro-status` — unsigned-out → `is_pro: false`, subscription: null
- [ ] `/api/pro-status` — free user → `is_pro: false`, subscription: null
- [ ] `/api/pro-status` — active subscriber → `is_pro: true`, subscription with dates
- [ ] `/api/pro-status` — expired subscription → `is_pro: false`
- [ ] `expires_at` boundary: subscription is inactive at exact expiration time
- [ ] Pro badge shows/hides correctly based on subscription status
- [ ] Pro benefits (unlimited AI, deeper research, priority routing) are gated server-side
- [ ] Forged `hh_profile` FID in localStorage cannot unlock Pro features
- [ ] `/api/stripe/checkout` — Pro page CTA says "coming soon" or checkout works end-to-end
- [ ] Only one active subscription per account

## 5. Sponsored Cast Slot

- [ ] Sponsored content appears in 3rd slot (index 2) and is labeled "Sponsored"
- [ ] Missing/deleted cast hash fails gracefully (no crash, sponsored slot hidden)
- [ ] No sponsor inventory → normal trending feed renders
- [ ] Sponsor DB failure doesn't break trending
- [ ] Organic feed shorter than 3 entries renders correctly
- [ ] `budget_remaining` is decremented per impression (not just checked for eligibility)
- [ ] Concurrent final-budget impressions cannot exceed campaign limit
- [ ] CDN-cached `/api/trending` responses don't cause impression undercounting or overcounting
- [ ] Sponsored payloads don't leak internal campaign info (budget, sponsor FID, etc.)
- [ ] Click tracking (POST `/api/sponsored-cast`) increments `click_count`

## 6. @thehomie Bot / Mention Agent

- [ ] Bot replies are not truncated mid-sentence across all LLM providers
- [ ] Empty/undefined model content falls through safely to next provider
- [ ] `recordReplyBatch` filters out null/empty tracking keys before inserting
- [ ] `recordReply` validates `parentHash` is non-empty before DB insert
- [ ] `hasRepliedToAny` fail-closed behavior works (returns true on DB error)
- [ ] No duplicate bot replies on overlapping cron runs
- [ ] Rate limits from LLM providers trigger fallback correctly
- [ ] Bot reply dedup checks all tracking keys (cast_hash, parent_hash, root_parent_url)
- [ ] `/.well-known/assetlinks.json` doesn't trigger React rendering (static response)

## 7. Feed & Trending

- [ ] Trending feed loads for signed-out visitors (guest-accessible)
- [ ] Trending feed loads for signed-in users with correct viewer context
- [ ] `viewer_fid` parameter is validated
- [ ] `limit` parameter is validated and capped
- [ ] `channel_id` parameter works when provided
- [ ] Rate limiting on `/api/trending` cannot be bypassed

## 8. LLM Provider Fallback Chain

- [ ] All configured providers (Anthropic, Gemini, GLM, GPT-OSS, Gemma, Nemotron) produce valid output
- [ ] Fallback triggers correctly on provider failure
- [ ] Increased token budget doesn't exceed Vercel function timeout in worst-case all-fallback scenario
- [ ] Slow generation doesn't cause duplicate bot replies on overlapping requests
- [ ] Multibyte characters (emoji, CJK) are not split at budget boundary

## 9. Push Notifications

- [ ] `/api/push/check-notifications` runs without errors
- [ ] Notification check respects user auth
- [ ] No spurious notifications for already-actioned items

## 10. Deployment & Build

- [ ] `npm run build` completes without errors locally
- [ ] Vercel production deployment is Ready (not Error)
- [ ] No runtime errors in Vercel logs for first 10 minutes post-deploy
- [ ] Environment variables are set (PRIVY, HYPERSNAP, CRON_SECRET, DB, LLM keys)
- [ ] Database migrations have been run (check `scripts/migrate-monetization.ts`)

---

## Regression Run Log

| Date | Run By | Commit | Result | Notes |
|------|--------|--------|--------|-------|
| | | | | |

---

## How to Use

1. **After every backlog update or deploy**: clone this checklist, go through every item
2. **Mark each**: ✅ pass, ❌ fail (with note), or ⏭ skip (with reason)
3. **Any ❌ blocks the release** — fix before announcing/deploying
4. **Log the run** in the table above
5. **Update this checklist** when new features are added — it's a living document
