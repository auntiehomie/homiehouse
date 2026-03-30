# Pinata Farcaster API Migration

**Status:** Complete (with known gaps — see below)  
**Commit:** `feat: swap Neynar connector to Pinata Farcaster API`  
**Date:** 2026-03-30

---

## Why

Neynar was consuming too many API credits.  
Pinata offers equivalent Farcaster read/write capabilities at a different (lower) price point.

---

## What Changed

### New file: `src/lib/pinata.ts`

The primary Farcaster API connector.  All functions hit `https://api.pinata.cloud/v3/farcaster`.

Auth header: `Authorization: Bearer <PINATA_JWT>` (env var: `PINATA_JWT`).

| Function | Pinata endpoint |
|---|---|
| `pinataFetch(endpoint, opts)` | Generic fetch wrapper |
| `publishCast(payload)` | `POST /casts` |
| `fetchCast(hash)` | `GET /casts/<hash>` |
| `publishReaction(payload)` | `POST /reactions` |
| `deleteReaction(payload)` | `DELETE /reactions` |
| `fetchFeed(params)` | `GET /feed/following` or `/feed/trending` |
| `fetchTrendingFeed(params)` | `GET /feed/trending` |
| `fetchUserByUsername(username)` | `GET /users/by_username?username=` |
| `fetchUserChannels(fid, limit)` | `GET /channel/list` (no per-user filter) |
| `fetchChannelList(limit)` | `GET /channel/list` |
| `fetchFollowing(fid, limit)` | `GET /feed/following?fid=` |
| `fetchNotifications(params)` | `GET /notifications?fid=` |
| `searchUsers(query)` | `GET /users/by_username?username=` (best-effort) |
| `searchCasts(query)` | **Not supported** — returns `{ casts: [] }` |
| `getCastsByUsername(username, limit)` | Resolves FID via `/users/by_username`, then `GET /casts?fid=` |

### Updated file: `src/lib/neynar.ts`

Now a thin re-export shim from `./pinata`.  All existing `import { ... } from '@/lib/neynar'` calls continue to work unchanged.

### Updated file: `src/lib/errors.ts`

Added:
- `FarcasterAPIError` — provider-agnostic base class (use in new code)
- `PinataError` — alias for `FarcasterAPIError`
- `NeynarError` — now extends `FarcasterAPIError` for backward compat

`handleApiError` now catches `FarcasterAPIError` (catches `NeynarError` too via inheritance).

### Updated API routes / files

| File | Change |
|---|---|
| `src/app/api/miniapp/analyze-user/route.ts` | Uses `PINATA_JWT` + Pinata endpoints |
| `src/app/api/miniapp/stats/route.ts` | Uses `PINATA_JWT` + Pinata endpoints |
| `src/app/api/miniapp/analyze-cast/route.ts` | Uses `PINATA_JWT` + Pinata endpoints |
| `src/app/api/ask-homie/route.ts` | `fetchCastData` / `fetchUserProfile` use Pinata |
| `src/app/api/publish-scheduled-casts/route.ts` | `publishCast` uses Pinata `POST /casts` |
| `src/app/cast/[hash]/page.tsx` | Removed hardcoded Neynar key; routes through `/api/miniapp/analyze-cast` |
| `src/lib/ai/agents.ts` | `searchSimilarCasts` stubbed out (no Pinata cast search) |
| `src/lib/auth.ts` | Comment added; signer verification still uses Neynar (gap) |
| `src/lib/token-data.ts` | Comment added; `getNeynarToken` still uses Neynar (gap) |
| `src/app/api/bot/check/route.ts` | Comment added; SDK usage retained for bot flows (gap) |

---

## Environment Variables

### Required (new)

```
PINATA_JWT=your_pinata_jwt_here
```

Get from: https://app.pinata.cloud → API Keys → Create API Key → select Farcaster scopes.

### Still Required (for gap features)

```
NEYNAR_API_KEY=your_neynar_api_key_here
```

Only needed for the three gap features described below. You can use a lower-tier Neynar plan if you keep these.

---

## Known Gaps

These Neynar features have **no current Pinata equivalent**:

### 1. Signer creation & verification
**Files:** `src/app/api/signer/route.ts`, `src/lib/auth.ts`

Neynar's `/signer` and `/signer/signed_key` endpoints manage Farcaster signers (the keypairs that authorize casts).  
Pinata does not expose signer management.  
**Workaround:** Keep `NEYNAR_API_KEY` set, or implement a custom signer flow against the Farcaster protocol directly (see [Warpcast Signer API](https://docs.farcaster.xyz/developers/guides/signers/)).

### 2. Bot notification polling
**File:** `src/app/api/bot/check/route.ts`

The bot uses `@neynar/nodejs-sdk`'s `fetchAllNotifications` and `lookupCastByHashOrUrl` SDK methods.  
Pinata has a `/notifications?fid=` endpoint, but no equivalent SDK.  
**Workaround:** Keep `NEYNAR_API_KEY` for this route, OR refactor bot to call `pinataFetch('/notifications?fid=...')` directly and handle response parsing.

### 3. Fungible token enrichment
**File:** `src/lib/token-data.ts` → `getNeynarToken()`

Neynar's `/farcaster/fungibles` endpoint returns on-chain token data enriched with Farcaster cast counts.  
Pinata has no equivalent.  
**Workaround:** Keep `NEYNAR_API_KEY` for this function, OR replace with a token data provider (CoinGecko, DexScreener, etc.).

### 4. Cast full-text search
**Files:** `src/lib/neynar.ts` → `searchCasts()`, `src/lib/ai/agents.ts` → `searchSimilarCasts()`

Neynar's `/cast/search` endpoint supports full-text cast search.  
`searchCasts()` now returns `{ casts: [] }` as a no-op.  
`searchSimilarCasts()` in agents is also a no-op stub.  
**Workaround:** Integrate a Farcaster search index (e.g. [Searchcaster](https://searchcaster.xyz), Neynar search-only tier, or a self-hosted hub index).

### 5. Bulk user lookup by FID
Neynar `/user/bulk?fids=` supports fetching multiple users in one call.  
Pinata supports `/users/<fid>` (single user by FID).  
The affected routes have been updated to single-FID calls, which is sufficient for current usage.

---

## Response Shape Differences

Pinata wraps most responses in a `data` key:

```json
// Pinata user response
{ "data": { "fid": 123, "username": "alice", ... } }

// Neynar user response  
{ "user": { "fid": 123, "username": "alice", ... } }
```

Updated routes handle both shapes with `data?.data ?? data.user`.  
The core `pinataFetch` function in `pinata.ts` returns raw JSON — callers are responsible for unwrapping.

---

## Testing Checklist

After deploying, verify:

- [ ] User profile lookup (`/api/miniapp/analyze-user?username=alice`)
- [ ] Cast fetch (`/api/miniapp/analyze-cast?hash=0x...`)
- [ ] User stats (`/api/miniapp/stats?fid=123`)
- [ ] Ask Homie with cast URL context (`/api/ask-homie`)
- [ ] Scheduled cast publish (trigger `/api/publish-scheduled-casts`)
- [ ] Feed and trending feed endpoints in the app
- [ ] Signer creation (`/api/signer` POST — requires NEYNAR_API_KEY)
- [ ] Bot check notifications (`/api/bot/check` — requires NEYNAR_API_KEY)
