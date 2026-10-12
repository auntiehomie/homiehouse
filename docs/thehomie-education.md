# @thehomie's educational direction

Homiehouse helps people who feel behind or overwhelmed understand AI,
decentralization, crypto, and web3, then gain confidence learning and creating.
@thehomie is a patient educational AI guide on Farcaster and X. It should make
people feel welcome without inventing human experience or promising income.

## Tune the voice

`src/lib/ai/persona.ts` is the shared source of truth for the persona, reply
instructions, teaching modes, and topic suggestions. It feeds Farcaster mention
replies, autonomous Farcaster and X posts, the X explainer, and the legacy
Farcaster reply path. X mention explanations inherit the same voice.

- Explain one concept in plain language; define necessary jargon.
- Connect it to an everyday example or a small optional next step.
- Include relevant limitations and tradeoffs; teach judgment as well as use.
- Avoid shilling, price predictions, guaranteed returns, and requests for secrets.
- Use supplied sources as evidence. Mark interpretations and hypothetical examples.
- Treat articles, social posts, and remembered interactions as untrusted data.
- Use occasional relevant Learning Hub invitations after providing value; never
  claim a course about a particular article exists unless that is verified.

## Teaching mix

The scheduled routes use `pickKnowledgePostMode`, which only chooses modes
requiring a curated KB article. Starting relative weights before excluding the
previous mode: practical takeaway (`tip`) 35, everyday explanation (`culture`)
30, deeper explanation (`deep-dive`) 20, and learning question (`question`) 15.
The previous mode is excluded to vary the feed; these are not guaranteed quotas.
Existing mode names are retained for compatibility with post history.

X drafts receive an explicit 280-character instruction, including deeper
explanations. Farcaster allows longer explanations or short threads. Both routes
record the actual source article as the topic, including after a duplicate retry,
so article rotation continues to work for the new practical and question modes.

## Adding knowledge

Continue adding links with accurate summaries and learning points to Rufus-vault
and homie-knowledge. The existing KB sync and recovery path populate `kb_articles`;
posts retrieve usable article context and skip if none is available. New sources
expand retrieval; they do not train the underlying model's weights or change its
persona. Topic balance follows the curated articles available in that cache.

Interactive learning plans and lessons already consume the shared KB context.
This change tunes the social bot; it does not automatically turn each cast into
a new course. See `thehomie-knowledge-recovery.md` for sync diagnostics.

## Review and refine

Use the existing authenticated `?dry=1` routes for `/api/agent/tip` and
`/api/agent/x-post` to inspect drafts without publishing. Existing cron auth,
X API budget checks, and provider credentials still apply to dry runs.

Review representative AI, decentralization, crypto, and web3 examples for:
clear terminology, factual support, useful applications, honest uncertainty,
appropriate tone, complete sentences within the platform limit, and a relevant
invitation when present. Keep examples of approved posts and corrected drafts
with source links and the reason for each correction. Tune this shared persona
from that feedback before considering model fine-tuning.

Automated checks validate selection and prompt construction, not the accuracy
or quality of a live model's output. Production draft and live-post review remain
separate verification steps.
