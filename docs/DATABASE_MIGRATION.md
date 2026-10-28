# Database migration — moving to Vercel-managed Neon

How to move the app's Postgres data onto a Neon database provisioned through
Vercel (one bill, auto-injected env vars). The app is already migration-ready:
`src/lib/db.ts` reads `DATABASE_URL` **or** `POSTGRES_URL`, so whichever Vercel
sets, the app connects with no code change.

## Link existing vs. create new — pick one

| | Link existing Neon project | Create Vercel storage (recommended) |
|---|---|---|
| Where | Neon console → Integrations → Vercel | Vercel → Storage → Create → Neon |
| Data | Kept as-is, no copy | New empty DB → copy data with the script below |
| Billing | Stays on Neon | Consolidated into Vercel |
| Use when | You only want the same DB, no migration | You want it managed + billed under Vercel |

Most of the time you want **create Vercel storage** — that's the whole point of
moving it under Vercel. The copy is ~2 minutes with the script.

## Steps (create Vercel storage)

1. Vercel dashboard → **homiehouse** project → **Storage** → **Create Database** → **Neon**.
2. Pick a region (match your functions' region for low latency) and a plan/tier.
3. Attach it to the project; select environments (Production, and Preview if wanted).
4. Vercel auto-adds `DATABASE_URL`, `POSTGRES_URL`, and the unpooled variants.

## Copy the data

Run locally (needs `pg_dump`/`pg_restore` — `brew install libpq` or
`apt-get install postgresql-client`). Use the **pooled** URLs (host contains `-pooler`):

```bash
OLD_DATABASE_URL="postgres://…current-neon…" \
NEW_DATABASE_URL="postgres://…new-vercel-neon…" \
npm run migrate-db
```

This dumps OLD → restores into NEW → prints a per-table row-count check. OLD is
only ever read from. When it prints **"✅ All tables match,"** move on.

Flags:
- `--verify-only` — compare row counts without copying (re-check before cutover).
- `--yes` — skip the confirmation prompt.

## Cut over

1. Confirm `DATABASE_URL` (or `POSTGRES_URL`) on Vercel points at the NEW DB (pooled).
2. Redeploy so functions pick up the new env var.
3. `npm run migrate-db --verify-only` once more against the live NEW DB.
4. Decommission the old Neon project.

## Gotchas

- **Pooled, not direct.** Use the `-pooler` connection string for serverless.
  The unpooled/direct URL will exhaust connections under load.
- **This does not raise your compute ceiling.** The earlier Neon `402` was a
  compute-limit; Vercel-Neon has its own plan limits — pick a tier that fits.
- **Tables self-create but data does not.** `/api/migrate` builds empty tables;
  only the dump/restore copies rows. Tables carrying real state: `users`,
  `learning_progress`, `agent_posts`, `saved_casts`, `saved_mini_apps`,
  `cast_notes`, `push_subscriptions`, `hh`.
