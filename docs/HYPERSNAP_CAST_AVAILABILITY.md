# Hypersnap cast availability audit — 2026-10-17

## Findings and implementation

- `/api/feed` applied third-party OpenRank spam scores to node casts. Removed automatic reputation filtering; explicit user mute/hide preferences remain in FeedList.
- `fetchFeed` discarded global cursors. Native global trending now forwards cursors and preserves the node's next token.
- Channel trending used an external ranked subset; channel reads also tried an unsupported filter URL first. Use `/v2/farcaster/feed/channels` directly with pagination and node failover.
- Native trending had no node failover and could silently substitute casts from four seed users. Removed the substitute feed; node outages now produce retryable errors rather than a misleading sample or successful empty page.
- Author reads used the multi-FID filter (which fetches the same recent batch before applying a timestamp filter); username reads used the nonexistent `/feed/user-casts` route. Both now use `/v2/farcaster/feed/user/casts`, which passes actual hub page tokens. Profile includes load-older controls for casts/replies.
- Conversation reads lacked node fallback. Additionally the inspected upstream conversation service fetches a capped reply batch without pagination and increments the global reply counter before building children; busy threads can lose replies. Cast detail now pages `/v1/castsByParent`, with a single bulk author lookup per page. Missing profile enrichment does not hide a reply. A conversation fallback is marked incomplete and not cached; subsequent page failures remain retryable. Reply cards link to their own conversations for deeper threads.
- Search hook calculated but discarded its cursor; API also dropped cursor metadata. Forward both. The inspected node search implementation itself ignores cursors and returns no next token: forwarding does not manufacture pagination that the node lacks.

## Sources inspected

Hypersnap repository `farcasterorg/hypersnap`, commit `3dc7df14068e8e5b56fcb31e8e41bb956dacf183`:
- `src/api/http.rs`: native feed routes, author hub-token pagination, search cursor limitation.
- `src/api/conversations.rs`: `fetch_replies`, `build_conversation_tree`, max-replies handling.
- `src/network/http_server.rs`: `/v1/castsByParent`, fid/hash inputs, base64 page token and message serialization.

## Limits and rollout checks

This removes application-side visibility blockers; it cannot guarantee every historical network cast exists on a particular node. Trending is a ranked discovery view, not a complete chronological firehose. Following has node-configured limits (`max_following_fetch`) and a per-author recent-batch window. Search depends on the node's enabled/local index. Deleted/pruned messages, incomplete node sync, disabled features, and upstream storage/index limits require node-side investigation. Successful responses from two differently synced nodes are not exhaustively merged.

Live public-node HTTP testing from the coding environment failed at the outbound proxy (CONNECT timeout). After deployment:
1. Compare a known missing reply hash between primary/fallback nodes and Homiehouse; confirm its parent FID/hash.
2. Load a thread with more than 25 direct replies; advance to exhaustion, and open nested reply conversations.
3. Load a profile beyond 25 casts; check replies and retry after a failed page.
4. Scroll global/following/channel feeds across multiple pages; confirm distinct casts, no first-page loop, no switch to unrelated feeds at exhaustion.
5. Check node sync/index health and configuration if a cast is absent from the raw hub endpoint as well.
