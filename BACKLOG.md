---
kanban-plugin: basic
project: homiehouse
updated: 2026-10-11
---

## Next

- [ ] Prototype Coinbase CDP Embedded Wallets on Base Sepolia with HomieHouse custom-JWT auth and Wagmi connector; verify account recovery before production and keep Hypersnap posting authorization separate [added::2026-10-26] [doc::docs/EMBEDDED_EVM_WALLET.md]

## In Progress

- [ ] Deploy and verify the non-upgradeable HH2 escrow contract on Base; configure `NEXT_PUBLIC_HH2_STAKING_CONTRACT_ADDRESS` before enabling on-chain staking [added::2026-10-11]

## In Review

- [ ] Set @thehomie's autonomous Farcaster cadence to one cast per 72 hours; require question-only replies, explicit AI identity, and the fixed no-answer fallback [branch::codex/thehomie-question-cadence]

- [ ] Fix Ask Homie live Farcaster research: retrieve casts from Hypersnap before answering, fail closed for current-event questions without evidence, and suppress model-emitted tool-call markup [branch::codex/ask-homie-live-cast-research]

- [x] Ground personalized AI learning plans in synced KB source details and preserve KB modules in generation fallbacks [done::2026-10-10] [pr::https://github.com/auntiehomie/homiehouse/pull/219] [commit::cef139f]

- [ ] Fix HH2 reward attempts not being registered: send `moduleId` to `/api/lesson` so the server records the signed-in attempt [added::2026-10-10] [pr::https://github.com/auntiehomie/homiehouse/pull/210] [status::open]

## Backlog

## Done

- [x] Make the KB sync preview read-only and require source-bearing notes (summary or learning points) before scheduled X/Farcaster posts [done::2026-10-10] [pr::https://github.com/auntiehomie/homiehouse/pull/216] [commit::a7d14dc]

- [x] Refresh interactive lesson generation from the current knowledge base: invalidate pre-grounding 30-day Redis lessons and direct the lesson prompt to treat retrieved KB context as the primary factual source [done::2026-10-10] [pr::https://github.com/auntiehomie/homiehouse/pull/214] [commit::5be7d0f]

- [x] Ground interactive lesson generation and autonomous X/Farcaster posts in the synchronized Rufus-vault and homie-knowledge KB; fix the homie-knowledge `main` branch source, remove X's hard-coded KB article list, and skip social posts without a usable synced article [done::2026-10-10] [pr::https://github.com/auntiehomie/homiehouse/pull/212]

## Cancelled
