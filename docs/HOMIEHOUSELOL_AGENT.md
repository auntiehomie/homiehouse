# @homiehouselol — Farcaster agent runbook

The autonomous agent that posts and replies as **@homiehouselol**. Three
Vercel cron jobs (see `vercel.json`) drive everything:

| Cron | Schedule | What it does |
|------|----------|--------------|
| `/api/agent/mention` | every 5 min | Replies to mentions/replies directed at the bot |
| `/api/agent/tip` | 9am & 9pm UTC | Posts one autonomous cast (rotating modes) |
| `/api/agent/engagement-check` | 6am & 6pm UTC | Records likes/recasts/replies on past posts (feeds memory) |

## Voice

One shared persona lives in **`src/lib/ai/persona.ts`** and is used by both
replies and posts, so the bot sounds like one person everywhere. The vibe: a
crypto-native millennial from the Midwest — down to earth, warm, a little dry,
helps people understand crypto without hype, and is happy to just chill. Edit
`HOMIE_VOICE` there to adjust tone globally.

## Reply context and memory

`/api/agent/mention` validates the incoming cast text before generating a
reply, then builds context from the thread, keyword-matched KB articles,
semantically similar KB articles and previous mentions, recent related public
Farcaster casts, and (for questions or current-information requests) a sourced
web brief. Relevant public casts and successful mention/reply pairs are saved
in Neon so later replies can retrieve them by meaning. KB articles are indexed
in batches during the daily KB sync.

Semantic indexing uses the Gemini `gemini-embedding-001` model and Neon
`pgvector`; the route degrades to keyword KB matches and live cast search if
embeddings or vector search are unavailable. The vector extension and index
are created lazily by the agent. `PERPLEXITY_API_KEY` enables web research;
without it, Farcaster and KB retrieval still work. Retrieved casts and web
pages are treated as untrusted source data, not as prompt instructions.

## Autonomous post modes

`/api/agent/tip` picks one mode per run (weighted, never the same mode twice in
a row). Weights are in `POST_MODES` in `persona.ts`:

| Mode | Weight | What it is |
|------|--------|-----------|
| `tip` | 40% | Teach one practical crypto thing (rotates through `DAILY_TOPICS`) |
| `trend-take` | 30% | Helpful/relatable take on a relevant trending cast |
| `chill` | 20% | Relatable, no-lesson "lol same" post |
| `question` | 10% | Low-stakes question to spark replies |

Roughly 70% helpful / 30% chill. Change the numbers in `POST_MODES` to retune.

## Which model writes posts

- **Replies** always use the free provider stack (`llmChat` → Groq → Gemini →
  OpenRouter). They run often, so they stay free.
- **Posts** prefer **Claude** *if* `ANTHROPIC_API_KEY` is set (better voice, and
  ~2 posts/day costs pennies), and automatically fall back to the free stack if
  there's no key or Claude errors. So posting works for $0 by default and just
  gets better if you add a key. Override the model with `AGENT_POST_MODEL`
  (default `claude-haiku-4-5-20251001`).

## Required environment variables (Vercel)

Autonomous behavior silently no-ops if these aren't set:

| Var | Purpose |
|-----|---------|
| `APP_FID` or `HOMIEHOUSELOL_FID` | The bot's Farcaster ID |
| `HOMIEHOUSELOL_SIGNER_KEY` | Registered Ed25519 signer private key (hex, no `0x`) for that FID — must be approved in Warpcast |
| `CRON_SECRET` | Vercel sends this as `Authorization: Bearer …`; routes reject calls without it |
| One of `GROQ_API_KEY` / `GEMINI_API_KEY` / `OPENROUTER_API_KEY` | Free LLM for replies (and posts when no Anthropic key) |
| `ANTHROPIC_API_KEY` *(optional)* | Upgrades post voice to Claude |
| `DATABASE_URL` or `POSTGRES_URL` (Neon) *(optional for replies)* | Agent memory and semantic context store; semantic recall is disabled if the database is unavailable |
| `PERPLEXITY_API_KEY` *(optional)* | Topic-specific web research for substantive questions and current-information requests |
| `GEMINI_API_KEY` *(optional when another LLM provider is configured)* | Gemini fallback and semantic embedding generation; without it, live cast search and keyword KB retrieval remain available |

> The autonomous poster stopped working previously because it hard-depended on
> Anthropic with an invalid model id. It now defaults to the free stack, so a
> missing/expired paid key can't break it again.

## Testing / previewing

- **Preview a post without publishing** (safe — nothing is cast):
  ```
  curl -H "Authorization: Bearer $CRON_SECRET" "https://<your-app>/api/agent/tip?dry=1"
  ```
  Returns `{ mode, content }` so you can sanity-check the voice.
- **Post for real now**: same URL without `?dry=1`.
- **Force a reply pass**: `curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>/api/agent/mention`

## Tuning cadence

Edit the `crons` entries in `vercel.json`. To post 3–4×/day, add more
`/api/agent/tip` schedule lines (e.g. `0 13 * * *`, `0 1 * * *`). Replies are
independent of post cadence.
