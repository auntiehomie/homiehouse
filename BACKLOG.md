---
kanban-plugin: basic
project: homiehouse
updated: 2026-10-10
---

## Next

## In Progress

## In Review

- [ ] Fix HH2 reward attempts not being registered: send `moduleId` to `/api/lesson` so the server records the signed-in attempt [added::2026-10-10] [pr::https://github.com/auntiehomie/homiehouse/pull/210] [status::open]

## Backlog

## Done

- [x] Refresh interactive lesson generation from the current knowledge base: invalidate pre-grounding 30-day Redis lessons and direct the lesson prompt to treat retrieved KB context as the primary factual source [done::2026-10-10] [pr::https://github.com/auntiehomie/homiehouse/pull/214] [commit::5be7d0f]

- [x] Ground interactive lesson generation and autonomous X/Farcaster posts in the synchronized Rufus-vault and homie-knowledge KB; fix the homie-knowledge `main` branch source, remove X's hard-coded KB article list, and skip social posts without a usable synced article [done::2026-10-10] [pr::https://github.com/auntiehomie/homiehouse/pull/212]

## Cancelled
