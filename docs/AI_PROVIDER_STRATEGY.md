# AI provider strategy

Backlog item: "AI provider strategy... needs a decision: formalize the
fallback-chain architecture as-is, or actually consolidate/remove
Perplexity." This doc makes that decision explicit, and — because writing it
required actually auditing every AI call site — documents what's really
there, including a few places that don't match the policy below.

## The decision

**Formalize the free-tier-first fallback chain as the intentional
architecture. Keep Perplexity, but recognize it's solving a different
problem than the chat-completion stack, not competing with it.**

Rationale:

- The original backlog framing ("consolidate to one provider, e.g. Claude
  Haiku") predates the free-tier stack in `src/lib/llm.ts` (Cerebras → Groq
  → Gemini → OpenRouter). That stack exists specifically so autonomous,
  high-frequency calls (bot replies run every 5 min) cost $0 and don't die
  the moment one provider's free-tier daily cap is hit. Collapsing that back
  to a single paid provider would reintroduce the exact problem it was built
  to avoid, and add a real per-call cost to features that currently have
  none.
- **Perplexity is not a chat-completion provider being used for chat
  completion — it's the only thing in this codebase that does live web
  search.** None of Cerebras/Groq/Gemini/OpenRouter's free models search the
  web; they answer from training data. `analyze-token` (token research) and
  `lesson.ts` (pulling in current context for a lesson) both need real,
  current information a static model can't have. Removing Perplexity
  wouldn't "consolidate providers" — it would remove a capability with no
  replacement in the free stack. It stays.
- **Claude (paid) has one legitimate, narrow, already-justified use**:
  writing the ~2/day autonomous posts (`agent/tip`, and now `agent/x-post`).
  That's documented in-line in both files — low volume, voice quality
  matters more than cost there, and it already falls back to the free stack
  automatically if the key is missing or the call fails. This is the kind of
  case-by-case override the "formalize as-is" decision endorses: paid
  providers are fine where the volume is low and the reason is explicit, not
  as a silent default.

## What's actually out there (the audit)

This is the part that wasn't obvious from `llm.ts`'s comment alone — the
"deliberately do NOT fall back to Claude or OpenAI" policy is stated in
`llm.ts`, but several other files have their own, separate provider logic
that doesn't go through `llm.ts` at all:

| File | Provider(s) | Matches the policy? |
|---|---|---|
| `src/lib/llm.ts` (`llmChat`/`getLLMProviders`) | Cerebras → Groq (x2) → Gemini (x2) → OpenRouter (x2), all free | ✅ this *is* the policy |
| `src/app/api/agent/tip/route.ts`, `agent/x-post/route.ts` | Claude (if `ANTHROPIC_API_KEY` set) → falls back to `llmChat` | ✅ documented, justified exception (see above) |
| `src/lib/ai/x-explain.ts`, `src/app/api/agent/mention/route.ts` | `llmChat` only | ✅ |
| `src/app/api/lesson/route.ts` | `llmChat` → Claude (if key set) → Perplexity (if key set, as a last-resort content source) | ⚠️ partially — the Claude fallback here isn't documented as narrowly as `agent/tip`'s; worth a comment explaining why lessons get a paid fallback but most other free-stack consumers don't |
| `src/app/api/miniapp/analyze-token/route.ts` | Perplexity directly (`sonar`), no free-stack fallback | ✅ intentional — this needs live search, not chat completion |
| `src/app/api/learning-plan/route.ts` | `ChatAnthropic` → `ChatGroq` → **`ChatOpenAI` (`gpt-4o-mini`)** | ❌ **violates the "no OpenAI fallback" policy** — this is langchain-based provider selection, entirely separate from `llm.ts`, and its last resort is paid OpenAI |
| `src/lib/ai/agents.ts` (`AgentOrchestrator` — composer/coach/researcher agents used by `ask-homie`) | `ChatAnthropic` **or** `ChatOpenAI`, selected by which key is set — no free-tier option at all | ❌ **doesn't use the free stack at all** |
| `src/app/api/ask-homie/route.ts` | Its own local getters: self-hosted Ollama (if `OLLAMA_URL` set) → Groq directly — separate from both `llm.ts` and `agents.ts`, despite importing `AgentOrchestrator` | ⚠️ a *third* independent provider-selection scheme in the same route |
| `src/app/api/bot/test-reply/route.ts` | Groq directly (diagnostic endpoint, explicitly marked "remove after debugging") | not production traffic, low priority |

**Bottom line: there are at least four independent provider-fallback
implementations in this codebase** (`llm.ts`, `lesson.ts`'s local additions,
`learning-plan/route.ts`'s langchain chain, `agents.ts`'s langchain chain),
each making its own decision about when a paid provider is acceptable. Only
`llm.ts` documents its policy. This audit is the first time that's been
written down in one place.

## What this PR does and doesn't do

This is a decision + documentation change, not a refactor. It does **not**
touch `learning-plan/route.ts` or `agents.ts`'s provider logic — rewriting
either risks changing the actual behavior of live, user-facing AI features
(personalized learning plans, the Ask Homie coach/composer/researcher
agents) without a way to test the change end-to-end here. That's real
follow-up work, tracked below, not silently done as a side effect of
"formalizing a strategy."

## Recommended follow-up (not done here)

1. **`learning-plan/route.ts`**: swap its `ChatOpenAI` last resort for the
   shared `llmChat` free stack (or at minimum add a Groq-via-`llm.ts` step
   before OpenAI), so a personalized learning plan degrades to a free model
   instead of a paid one when Anthropic/Groq keys are both absent.
2. **`agents.ts`**: has no free-tier fallback at all — if this is still the
   live path behind `ask-homie` (worth confirming; `ask-homie/route.ts` also
   has its own separate Ollama/Groq getters, which is a strong hint the
   `AgentOrchestrator` path may be partially superseded), either wire it
   through `llm.ts` or retire it in favor of whichever path is actually
   serving traffic.
3. Pick ONE of `ask-homie/route.ts`'s local Ollama/Groq getters vs.
   `agents.ts`'s `AgentOrchestrator` as *the* Ask Homie implementation —
   having both in the same route file is its own source of confusion
   independent of the provider question.

## Policy going forward

- Default every new AI call site to `llmChat`/`getLLMProviders()` from
  `src/lib/llm.ts`.
- A paid-provider exception (Claude, OpenAI, Perplexity) needs a one-line
  comment at the call site explaining why the free stack can't do the job —
  "needs live web search" and "low-volume + voice quality matters" are the
  two accepted reasons so far. "I didn't know the free stack existed" is not
  a reason — check `llm.ts` first.
