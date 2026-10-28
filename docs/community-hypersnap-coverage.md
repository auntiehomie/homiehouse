# Community: Hypersnap coverage and EigenTrust path

## Run the read-only coverage probe

Use a cast hash known to exist on the operator's Hypersnap node. The probe uses the first configured server-only URL in this order:

1. `MY_HYPERSNAP_NODE_URL`
2. `HYPERSNAP_NODE_URL`
3. `SNAPCHAIN_NODE_URL` (legacy Homiehouse name for the operator's Hypersnap node)
4. `NEXT_PUBLIC_HYPERSNAP_URL`
5. Hypersnap's public Haatz node

Run from the Homiehouse repository:

```sh
FID=3 CAST_HASH=0x... npm run check:hypersnap-coverage
```

Optional variables: `MAX_PAGES` (default 10, capped at 50) and `HOMIEHOUSE_PRODUCTION_URL` (default `https://homiehouse.lol`). The script only issues GET requests. Its output reports page counts, cursor continuation, duplicate counts, reaction/trending endpoint support, and the overlap between the node's trending sample and deployed Community. It does not emit node URLs, cast contents, or reactor identities.

The probe requests 50 items per page and does not claim that 50 is the node's maximum. It stops after `MAX_PAGES` to keep this diagnostic bounded. If the private node cannot be reached from the execution environment, run the same command from a host with network access to that node. Do not copy the private URL into `NEXT_PUBLIC_HYPERSNAP_URL`.

## Preview measurement (2026-10-26)

The PR Preview was configured with the existing personal-node URL as an encrypted, branch-scoped Preview variable. Its Community and global trending routes returned 50 casts each with another page cursor; following returned 100 users with another cursor; author history returned 25 casts with another cursor. All four responses reported `configured: personal`, `servedBy: fallback`, and `fallbackReason: request_error`. The returned data came from the public fallback. This establishes that Homiehouse falls back successfully in Preview; it does not establish reachability or coverage on the personal node. The exact cause is still unresolved, and the cast reaction-list endpoint has not been checked directly against that node.

## How to interpret results

- `following.hasMore`, `userCastHistory.hasMore`, and the cursor list show whether the queried endpoint supports pagination. `pages` and `count` show the amount sampled, not total network coverage.
- `oldestTimestamp` indicates the age reached within the bounded cast-history sample.
- `reactionsForKnownCast.status` and `count` establish whether a cast's reactor list is exposed. Aggregate counts alone cannot create user-to-cast graph edges.
- `productionCommunityComparison.hashOverlapWithNodeTrending` compares samples, not complete feeds. A mismatch may result from different node data, time window support, sorting, or current cursor state.
- The node index determines actual coverage. A successful request does not mean every Farcaster cast or reaction is available.

## EigenTrust implementation gates

1. Confirm the personal node is the actual production read source, then record route status, endpoint support, page depth, oldest available cast, and sample overlap.
2. Confirm whether reaction lists and follow edges are paginated and whether historical data can be backfilled. If only live webhooks are available, document that the graph starts from subscription time and will be incomplete.
3. Define an event/edge schema with source node, event time, observed time, relation type, and deduplication key. Preserve reaction removals and follow removals; don't treat deleted relations as active trust.
4. Backfill only what the node can provide, subscribe to supported created/deleted events, and measure dropped, delayed, and duplicate events before scoring.
5. Start with a non-ranking shadow computation on a small, explicit graph. Keep user-personal seeds separate from any community-wide seeds selected through the Quorum process. Don't select shared seed FIDs in code.
6. Compare candidate EigenTrust rankings against current Community impressions and coverage. Only then decide whether to expose an optional trust signal or use it as a tie-breaker. Keep the node's eligible casts visible; trust should complement discovery, not silently remove candidates.

OpenRank's precomputed Farcaster rankings and a locally computed EigenTrust graph are separate approaches. This integration path uses the latter only if Homiehouse can maintain sufficient interaction edges; no EigenTrust score is enabled by this change.
