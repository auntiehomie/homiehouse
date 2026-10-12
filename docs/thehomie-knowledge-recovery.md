# @thehomie knowledge pipeline recovery — 2026-10-12

## Purpose
Homiehouse helps people gain the skills and confidence to succeed and create with AI and crypto. Curated articles in Rufus-vault and homie-knowledge provide the evidence; AI explains, connects and personalizes that material into casts and courses. Selected casts invite readers to the existing Learning Hub tracks without claiming an article-specific course exists.

## Cause and evidence
Production on October 12 fetched 101 source entries, upserted zero rows, and reported 68 errors. Posting and semantic retrieval reported `relation "kb_articles" does not exist`. The sync route nevertheless returned `ok: true`.

The code awaited `sql.unsafe(...)` for schema setup. In Neon serverless 1.x this constructs an interpolation fragment; it does not execute a query. The September 30 commit `fa37edc3` split the DDL into statements but retained that non-executing method. Knowledge-only post modes introduced in `2ddcd679` then exposed the broken cache as skipped posts. No evidence shows the sources were deleted or that this incident was caused by exhausted AI credits.

## Repairs and safeguards
- Use executable `sql.query()` for KB, curriculum and semantic schema DDL. Run individual DDL statements in dependency order.
- Fetch independent sources concurrently; preserve existing summaries and learning points when a source fails or an index row contains no enrichment.
- Compare recent article titles exactly with parameterized arrays, rather than interpreting them as regular expressions.
- Sync hourly at minute 30 UTC. Report actual upserts and usable articles. Failed or incomplete syncs return HTTP 503 and emit a Sentry error signal when Sentry is configured.
- If posting has no usable cached article, attempt one recovery sync without embeddings, then retry selection. Unrecoverable failures are errors, not successful skips.
- Remove duplicate semantic indexing from the sync route. Embedding availability is not required to select an article or generate a post.
- Restore richer article context to course planning; exclude title-only rows from curriculum modules.
- Retain the existing AI provider fallback chain, deduplication and publishing authentication.

## Verification and operations
Run `npm test -- --runInBand`, `npx tsc --noEmit`, ESLint on changed files and a production build. Regression tests cover executed DDL, sync preview without writes, source failure, exact title matching and cache recovery.

After release, check production logs for `[agent/kb-sync] DONE` with positive `upserted` and `usable` counts. Farcaster runs at 09:00 and 21:00 UTC. Confirm a `Posted` message with a cast hash; an HTTP 200 alone is not proof of publication. A source outage can still prevent initial recovery, and unavailable model providers or signers can independently prevent posting.

Authenticated manual checks use `/api/agent/kb-sync?dry=1` for a source preview, `/api/agent/kb-sync` for sync, and `/api/agent/tip?dry=1` for a generated preview. Posting dry runs can recover an empty cache but do not publish. Never put the cron secret in URLs or logs. Production CRON_SECRET is not retrievable through the current connector; use the existing scheduler or an operator's securely configured Authorization header.

## API reference
Neon driver documentation: https://github.com/neondatabase/serverless/blob/main/CONFIG.md — `query()` executes variable SQL; `unsafe()` embeds trusted SQL fragments within tagged templates.
