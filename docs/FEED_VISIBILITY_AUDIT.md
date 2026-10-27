# Feed visibility and responsive UI audit — 2026-10-17

## Findings and changes

- Signed-in fresh visits default to Following. Returning from cast detail still restores the saved scope, loaded pages and position.
- Following uses Hypersnap's native chronological endpoint. An empty result no longer silently becomes Global. Requests without a FID get a sign-in error. Read failures no longer call a host application's SDK feed, which could reintroduce that host's feed policy.
- Automated reputation filtering is temporarily disabled centrally in `feed-policy.ts`, including OpenRank notifications and reputation lookups. Interest sorting and “see less” downranking are suspended. Explicit user mute/hide choices remain; their saved preferences are not deleted. Write rate limits and bot duplicate-post guards are not display filters.
- Browser and server feed reads use `no-store`. Visible Following/Global views check the first page every minute and on return to the tab (30-second throttle). New hashes produce a Load new casts button; background checks do not insert rows, reset cursors, or move the reader. Refresh is explicit and available without a touch gesture. Failures remain visible/retryable.
- Global and Trending are labeled ranked discovery. Trending's request cache already expired after 60 seconds, but its mounted list never reloaded; it now has explicit Refresh discovery. Ranked discovery can legitimately retain old top casts.
- Feed tabs wrap and remain accessible instead of needing sideways navigation. Header actions wrap, desktop content has a readable maximum width, long toasts wrap, and dialogs use visual viewport height/offset. This addresses Android keyboard/browser chrome and short landscape layouts as well as desktop window resizing/zoom.

## Live read-only evidence

The primary node (`https://haatz.quilibrium.com`) returned HTTP 200 for `/v1/info`, native Trending and native Following during this task. Info reported version 0.13.5 and shard block delays 0–2 at that snapshot; this alone does not prove complete indexing.

- `/v2/farcaster/feed/trending?limit=3` returned the screenshot's SwarmHood cast first, timestamp `2026-10-17T11:14:41.000Z`. Other top results dated 02:00 and 03:52 UTC. The old top result originates in the ranking response, not solely the device cache.
- `/v2/farcaster/feed/following?fid=3&limit=3` returned casts at `21:21:58`, `21:12:42` and `21:07:47` UTC, newest first, with a pagination cursor. This verifies a public test account, not Amanda's full graph or any particular missing account.
- The configured fallback node's `/v1/info` timed out after 8 seconds from this environment. Do not treat failover as verified, or infer its universal availability from this single observation.
- Native response hashes are unprefixed 40-digit hex. Thread acknowledgement now accepts both prefixed and unprefixed hashes, avoiding a false failure after a successful publish.

## Pledges, app bans, Quorum and completeness

Inspected Homiehouse feed/profile reads and upstream `farcasterorg/hypersnap/src/api/feeds.rs` contain no pledge/NFT membership or Farcaster-app ban predicate. Following reads the node's social graph and cast store; Trending uses metrics ranking. This is evidence about these code paths, not proof that every upstream index, node configuration or network has every user's messages.

The inspected public `QuilibriumNetwork/quorum-desktop/src/components/farcaster/FarcasterPage.tsx` currently renders a “Coming soon” placeholder. It supplies no feed implementation to reuse. Do not present a guessed Quorum algorithm as verified. Homiehouse already reads the independent Hypersnap node rather than the Farcaster app's curated feed.

Upstream Following has a configurable graph cap (`max_following_fetch`, default 1,000; live value unknown) and fetches a recent batch per author before applying the timestamp cursor. Thus deep history can end early, equal-timestamp items can be missed, and a large following graph can be truncated. Client refresh and removal of spam filtering do not eliminate these node-side limits.

For a concrete missing account/cast:

1. Resolve its FID using node profile reads, then compare `/v1/castsByFid?fid=FID&pageSize=25&reverse=true` and paginated native author reads with the Following result. Do not classify absence as a spam verdict.
2. Compare that exact FID/hash on independently synced nodes, inspect sync/index/follow-graph coverage and protocol compatibility, and verify the fallback is reachable. A metrics-ranked feed is not an availability test.
3. If raw messages exist but native Following omits them, fix/reconfigure the node index or implement a dedicated indexed chronological feed from the complete paginated follow graph and per-author streams, with persistent cursors and hash tie-breakers. Avoid an unbounded per-user fan-out on each web request. Operating a compatible independent node/index is the durable direction; data that a node never stored cannot be recovered by a UI filter switch.

## Verification limits

Automated tests cover no-filter policy, no ranked substitution, credentials for Following, cache behavior, unseen-hash comparison and accepted node hash formats. Added a fixture browser matrix for Android-sized portrait/landscape, iPad and desktop. Physical Android, desktop browser layouts, keyboard interaction and all-account coverage are not yet verified; local browser runs remain blocked by the previously recorded optional wallet dependency and missing Chromium binary. No wallet signing, live posting, payment, server reconfiguration or external moderation changes were performed.

## Approved preview browser follow-up

Amanda approved temporary preview access. A 1363×936 desktop browser showed the migration guide, sidebar and feed controls within the viewport. The check exposed `Distributed rate limiting is unavailable` on Preview: Redis credentials are configured for Production, and these public feed routes had not opted into the existing Preview-only local limiter. Feed/trending reads now opt in; the shared limiter remains required in Production, with regression coverage. This does not alter deployment protection or production access controls.

Global and Trending were duplicate presentations of the same native ranking endpoint. The navigation now offers Following and Discovery; guests start on Discovery, and signed-in fresh visits remain Following. This removes the misleading impression of two independent global feeds.
