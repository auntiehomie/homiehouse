# Community feed experiment

Community is an optional feed tab. Following remains the member default and preserves native newest-first ordering; Discovery preserves node ordering. Mute/hide preferences still apply. No automatic spam exclusion is added.

## Candidate and history boundary

`GET /api/feed?feed_type=community` reads the existing Hypersnap trending endpoint, then reorders **only that page**, returning its original cursor. It cannot promote casts excluded by the upstream candidate feed, and is not a complete network index. Page boundaries remain upstream boundaries: a later page may contain a higher-scoring cast. The client appends pages, deduplicates hashes, and restores its saved ordered cards rather than reranking on detail return.

For every valid author FID, the server samples at most 50 recent casts through `/v2/farcaster/feed/user/casts`. Six concurrent requests maximum, each with a 1.5-second timeout. The process-local cache holds at most 500 public samples for 15 minutes. Cache misses can add up to roughly 13.5 seconds for a 50-author page; scale testing and a persistent index should precede broader adoption. Cache is expendable and may differ across server instances. History failures yield neutral scores without dropping candidates. Invalid author IDs never become requests.

Dates in the future, invalid dates, other authors' casts and duplicate hashes are ignored. Earliest observed is only the earliest date in that sample, not a first-ever cast, registration date, identity age, or durable reputation record. Frequent casters may have years of history absent from a recent sample.

## Version community-v1

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

## Evaluate before advancing

1. Review actual candidate pages for useful conversation discovery, old/new author distribution and short/non-English/personal posts. Compare with Discovery and Following.
2. Build a persistent public-event index with backfill, deletions/reorg handling, history coverage and freshness watermarks. Include broader recent candidates rather than relying solely on trending.
3. Add distinct-engager and conversation-depth evidence with capped per-person influence, repeat-ring checks and explicit coverage labels. Do not label aggregate counts as independent human engagement.
4. Collect voluntary “more/less like this” feedback and test contextual relevance; avoid a universal public authenticity score.
5. Benchmark latency and node load, consolidate concurrent sample requests, and validate ranking outcomes against a human-reviewed dataset before changing weights or defaults.

Rollback: remove/hide the Community tab; existing Following/Discovery have no ranking dependency at request time. This experiment is proposed via PR and is not automatically deployed by local validation.
