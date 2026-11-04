# Community ranking experiment: Hypersnap polling and trust vs. cast quality

## What the poll can see

Hypersnap's public read API is an indexed query surface, not a complete chronological firehose. A bounded sample can be built from:

- `GET /v2/farcaster/feed/trending` for network-wide discovery candidates. It is already ranked by an engagement heuristic and is not an exhaustive cast stream.
- `GET /v2/farcaster/user/following?fid=…` for a viewer's seed accounts, with opaque cursor pagination.
- `GET /v2/farcaster/reaction/user?fid=…&type=likes|recasts` for recent actions by sampled accounts; reaction rows include the target cast and author.
- `GET /v2/farcaster/feed/user/casts?fid=…` for recent author history and counts; this is useful for existing Community participation diagnostics, not a first-ever account history.
- Hypersnap webhooks for ongoing `cast_created/deleted`, `follow_created/deleted`, and `reaction_created/deleted` events. A webhook-backed persistent event index is the appropriate next stage for continuous graph refresh; repeated request-time fan-out is not.

List endpoints use opaque cursors and have endpoint-specific caps. The poll script intentionally bounds itself to one 50-cast trending page, up to 100 followed accounts, 20 followed actors' recent like/recast pages, and four concurrent actors. This is a snapshot for algorithm comparison, not a full node mirror. Rerun at a chosen cadence to compare snapshots; do not treat offsets as durable time watermarks.

## Run a bounded sample

Set `COMMUNITY_EXPERIMENT_FID` and optionally `MY_HYPERSNAP_NODE_URL`, `HYPERSNAP_NODE_URL`, `NEXT_PUBLIC_HYPERSNAP_URL`, or `HYPERSNAP_FALLBACK_URL`. Then run:

```sh
npm run experiment:community-poll
```

By default the report is printed to stdout. Set `COMMUNITY_EXPERIMENT_OUTPUT=/path/to/new-file.json` to save one snapshot; the script refuses to overwrite an existing file. The snapshot includes cast hashes and public FIDs, not cast text. Keep generated samples out of git because they reveal a particular viewer's follow-derived context.

## Signals under comparison

The script produces three orderings for the same node-selected candidate page:

1. **Node order** — Hypersnap's own trending order, retained as the baseline.
2. **Sampled author trust** — personalized PageRank-style propagation from followed accounts over capped samples of follow, like, and recast edges.
3. **Cast engagement** — aggregate likes + 2× recasts + 2× replies, used as a deliberately simple cast-level baseline.

Author trust describes the sampled graph context of an author. It is not a cast-quality score. Cast engagement/context/history measures are also weak proxies: aggregate counts cannot establish distinct people, meaningful replies, accuracy, originality, or educational value. `castQualityReview` therefore starts as `null`; reviewers should add a human rubric separately rather than treating metadata as a quality judgment. Authors absent from the sampled graph get a `null` trust value and retain node order; they are not assigned a low score. None of these experimental scores hides a candidate.

## Limits and next step

The API does not expose a general public “all events since cursor” read endpoint. Polling the feed, follows, and reaction pages gives a bounded sample and can miss candidates or older interactions. A durable experiment needs a small service that accepts Hypersnap's signed webhooks, stores deduplicated events and deletions with timestamps, maintains a backfill watermark, and records index coverage. Before changing Community defaults, compare node order, the current `community-v1`, and trust-augmented ordering on a human-reviewed sample. Track topic fit, useful conversation discovery, newcomer exposure, language/post-length slices, graph coverage, and latency. Keep trust explainable and use it as a separate, modest author component after candidate selection.

## Competitor patterns observed

- **Firefly** is an aggregator: its product material describes user-selected feed sources/subscriptions across protocols, plus spam prevention. This suggests user control over sources and a clear separation between discovery subscriptions and ranking.
- **Quorum Mobile** currently reads the viewer's Hypersnap following feed in cursor-paginated pages and keeps the node's newest-first order. The client caches pages, refreshes only the head page, and has client-side scam-cast filtering and reply-visibility preferences. No personalized score/ranking formula appears in the inspected feed path. This makes it a useful baseline for completeness, cache behavior, and chronological order.
- **Farcaster/Hypersnap** separates the protocol data from client feed logic. Hypersnap currently offers following (newest first) and network trending (engagement heuristic); its compatibility `for_you` currently returns trending rather than personalized results.
- **Bluesky** lets independent feed generators publish selectable feeds; generators can maintain a bounded index from the event firehose and optionally receive interaction feedback. **Nostr** defines portable follow lists and relay queries, but no universal ranking formula; each client decides how to combine relay results. Both reinforce that feed policy can be independently chosen and inspected.
- **Mastodon** keeps the home timeline reverse chronological and exposes separate local, federated, and hashtag timelines. This reinforces that source scope and ordering are distinct user-facing choices.

## Sources

- [Hypersnap feed API](https://hypersnap.org/docs/reference/reads/feeds)
- [Hypersnap follows API](https://hypersnap.org/docs/reference/reads/follows)
- [Hypersnap reactions API](https://hypersnap.org/docs/reference/reads/reactions)
- [Hypersnap cast API](https://hypersnap.org/docs/reference/reads/casts)
- [Hypersnap pagination contract](https://hypersnap.org/docs/concepts/pagination)
- [Hypersnap webhook filters](https://hypersnap.org/docs/reference/webhooks/filters)
- [Hypersnap public read and webhook limits](https://hypersnap.org/docs/concepts/rate-limits)
- [OpenRank's Farcaster ranking description](https://docs.openrank.com/integrations/farcaster/ranking-strategies-on-farcaster)
- [Firefly feed source and spam-filter announcement](https://paragraph.com/%40firefly-app/fly-with-us-firefly-s-major-upgrades)
- [Current Firefly app overview](https://apps.apple.com/us/app/firefly-web3-everything-app/id1640183078)
- [Quorum Mobile feed hook](https://github.com/QuilibriumNetwork/quorum-mobile/blob/master/hooks/useFarcasterFeed.ts)
- [Quorum Mobile repository](https://github.com/QuilibriumNetwork/quorum-mobile)
- [AT Protocol feed generator architecture](https://atproto.com/guides/feeds)
- [Nostr follow-list spec](https://github.com/nostr-protocol/nips/blob/master/02.md)
- [Nostr search-relay spec](https://github.com/nostr-protocol/nips/blob/master/50.md)
- [Mastodon timeline API](https://docs.joinmastodon.org/methods/timelines/)
