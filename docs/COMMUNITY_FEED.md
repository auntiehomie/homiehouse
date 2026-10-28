# Community Feed

Community is an optional feed tab. Following remains the member default and preserves native newest-first ordering; Discovery preserves node ordering. Mute/hide preferences still apply. No automatic spam exclusion is added.

## Candidate selection and history boundary

`GET /api/feed?feed_type=community` asks the configured Hypersnap node for its broadest supported trending window (`7d`) and the maximum trending page size currently supported (`50`), then follows the node's cursor. The server reorders **only each page**, preserving its original cursor; the client personalizes the new page and appends it. The node still determines which clients, casts and history it has indexed, so this is not a complete network index. It cannot promote casts excluded by the node or guarantee access to every network cast. Page boundaries remain upstream boundaries: a later page may contain a higher-scoring cast. The client deduplicates hashes and restores its saved ordered cards rather than reranking on detail return.

On the member's device, recent likes provide a separate, private personalization pass over each returned page. Recent liked cast text, authors and channels are compared with candidates; topic overlap carries the most weight. This reorders page candidates without deleting them, with every fifth slot preserving the node's original discovery order. The interaction profile is local to the signed-in FID on that device and is not sent to the server for this pass. The node's own trending candidate selection remains broader and is not filtered by likes.

The optional environment settings `HOMIEHOUSE_COMMUNITY_TRENDING_WINDOW`, `HOMIEHOUSE_COMMUNITY_INCLUDE_SIGNER_FIDS`, and `HOMIEHOUSE_COMMUNITY_EXCLUDE_SIGNER_FIDS` refine the candidate page before local ranking. The default window is the broadest currently supported value, `7d`; it can be narrowed to `1h`, `6h`, `12h`, or `24h`. The signer FIDs are **publishing client app IDs** that registered cast signing keys; they are not author FIDs. Inclusion accepts casts signed by listed apps and excludes unknown clients. Exclusion drops casts from listed apps; exclusion wins if an app appears in both lists. Leave both lists unset so the node can provide candidates from all clients it indexes. Signer filtering requires a node running the Hypersnap [`trending_exclude_signer_fids` change](https://github.com/farcasterorg/hypersnap/tree/feature/trending_exclude_signer_fids) or a compatible build; do not claim the filter is active until the node responds with filtered results.

For every valid author FID, the server samples at most 50 recent casts through `/v2/farcaster/feed/user/casts`. Six concurrent requests maximum, each with a 1.5-second timeout. The process-local cache holds at most 500 public samples for 15 minutes. Cache misses can add up to roughly 13.5 seconds for a 50-author page; scale testing and a persistent index should precede broader adoption. Cache is expendable and may differ across server instances. History failures yield neutral scores without dropping candidates. Invalid author IDs never become requests.

Dates in the future, invalid dates, other authors' casts and duplicate hashes are ignored. Earliest observed is only the earliest date in that sample, not a first-ever cast, registration date, identity age, or durable reputation record. Frequent casters may have years of history absent from a recent sample.

## Current scoring: community-v1

All components are bounded 0–1. Weights sum to one:

| Component | Weight | Evidence and limits |
| --- | ---: | --- |
| Context | 30% | Neutral 0.5, +0.25 for replying to a cast and +0.25 for an embed. These are affordances, not proof of accuracy or quality. |
| Engagement | 25% | Capped logarithmic aggregate likes + twice recasts + twice replies, divided by a logarithmic audience-size reference with a minimum of 10. Missing audience size uses that minimum. This cannot distinguish meaningful replies, independent people or coordinated rings. |
| Participation | 20% | Equal mix of unique normalized nonempty text ratio and active weeks (capped at eight). Fewer than three valid sampled casts yields neutral 0.5. Exact repeats are weak evidence and can be legitimate. |
| Freshness | 15% | Exponential decay with a three-day time constant. Missing/invalid/future dates receive neutral 0.5. |
| Observed history span | 10% | Logarithmic span between earliest and latest sampled casts, capped at 365 days. Fewer than three casts yields neutral 0.5. No FID or wallet-age inference. |

Stable ties retain original node order. Prefer at most two casts per author while other authors with fewer than two remain. Every fifth position may promote an as-yet-unshown author with an engagement component below 0.5. This is exploration **within this candidate page**, not a guarantee of newcomer exposure across the network. All candidates remain in the result.

Each cast includes score components, sample size, earliest observed and reasons under `community_ranking`; the UI exposes “Why this cast?” and a feed-level explanation. No grammar, writing-length, language, sentiment, AI detector or human-authenticity classifier is used. Context is not personalized relevance. No LLM calls, paid APIs, database migrations, private messages or wallet information are required.

## EigenTrust as a complementary signal

EigenTrust is not part of the current Community score. The right next step is to compute a separate, explainable trust score for authors from a **Hypersnap-derived interaction graph**, then blend it with the existing cast signals after review. It should help answer “does this author sit in a trusted part of this community's network?” It cannot answer “is this cast about the topic I want?”

1. Build a rolling public-event index from the Hypersnap node: follows, likes, recasts, and replies. Form directed, weighted edges from the acting FID to the cast author FID. Deduplicate events, apply time decay, and cap each account's influence so repeated activity cannot dominate. Do not construct this graph by fanning out to many node endpoints on each feed request.
2. Compute separate contexts: personalized scores seeded by accounts a member follows or engages with, and an optional shared score seeded by accounts the Quorum-led community explicitly chooses. Keep these scopes distinct and record the seed set and graph coverage with each snapshot.
3. Use trust only as one ranking component after candidate selection. Keep topic relevance, recency, conversation context, and newcomer exploration in the blend. Do not remove casts based on a single trust score, and show the trust path or score coverage in “Why this cast?”
4. Compare EigenTrust against current Community ordering on a human-reviewed sample and watch for new-author exposure, topic fit, and latency before choosing weights or changing the default.

OpenRank's existing Farcaster rankings are precomputed against their own Farcaster graph. They are not automatically scores from the personal Hypersnap node. OpenRank documents a custom-graph SDK, but its compute path has its own setup and access requirements. A local EigenTrust computation over a maintained Hypersnap event index gives Homiehouse control over data provenance, seeds, contexts, and refresh cadence.

## Evaluate before advancing

1. Review actual candidate pages for useful conversation discovery, old/new author distribution and short/non-English/personal posts. Compare with Discovery and Following.
2. Build a persistent public-event index with backfill, deletions/reorg handling, history coverage and freshness watermarks. Include broader recent candidates rather than relying solely on trending.
3. Add distinct-engager and conversation-depth evidence with capped per-person influence, repeat-ring checks and explicit coverage labels. Do not label aggregate counts as independent human engagement.
4. Collect voluntary “more/less like this” feedback and test contextual relevance; avoid a universal public authenticity score.
5. Benchmark latency and node load, consolidate concurrent sample requests, and validate ranking outcomes against a human-reviewed dataset before changing weights or defaults.

Rollback: remove/hide the Community tab; existing Following/Discovery have no ranking dependency at request time. Community remains an optional view and does not change Following or Discovery.
