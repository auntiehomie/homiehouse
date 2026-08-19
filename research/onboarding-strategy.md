# HomieHouse first-time Farcaster onboarding strategy

**Audience:** people who have never used Farcaster (including people who do not know what a protocol, FID, signer, or cast is).  
**Product context:** email signup, Resend transactional/support email, Farcaster-native authentication and key-possession proof through Hypersnap, `@thehomie` mention replies, Next.js/Vercel/Neon.  
**Primary activation event:** a new user sees a useful feed, follows at least three relevant people/channels, and publishes their first cast successfully.

## Executive recommendation

Make HomieHouse feel like a normal social app first and teach the protocol progressively. Ask for one email, explain the benefit in plain English, create or connect the Farcaster identity behind the scenes, then guide the user through three small actions: **choose interests → follow people → post a low-pressure introduction**. Do not put recovery phrases, gas, wallets, FIDs, hubs, signers, or crypto jargon on the critical path.

The most important UX rule is to separate **account access** from **posting authorization**. A user may browse immediately after email verification and profile creation; request Hypersnap posting approval only when they are ready to post, explain exactly what is being approved, and provide a visible recovery/help path. This avoids losing users before they experience the product.

## 1. What successful products teach us

### Twitter/X
- A familiar email/phone-first account flow reduces perceived risk.
- Username, photo, interests, topics, and recommendations are progressively collected rather than presented as a protocol lesson.
- Following suggestions and a populated home timeline solve the cold-start problem before the first post.
- A composer is always visible and prompts such as “What’s happening?” reduce blank-page anxiety.

**Apply:** ask for interests before showing an empty feed; prefill a safe first-cast prompt; keep profile completion skippable.

### Bluesky
- Users can browse a familiar social timeline while the underlying AT Protocol is mostly invisible.
- Custom feeds and starter packs make discovery legible: people can follow a community or topic rather than understand a graph/protocol first.
- Handles, account portability, moderation choices, and hosting concepts need explanation, but are better introduced at the moment of relevance.

**Apply:** offer “starter packs” of Farcaster people/channels by interest; use a short “How this works” card with an optional deeper explanation; defer advanced identity concepts.

### Lens / web3 social apps
- Wallet and signature steps create major conversion loss when presented too early.
- Walletless, email, social-login, and embedded-key approaches improve first-session conversion, but users still need honest explanations about account ownership, portability, recovery, and what a signature does.
- A successful flow clearly distinguishes a free app account from optional on-chain actions and never requests a seed phrase in the app.

**Apply:** email is the front door; use Hypersnap proof-of-key-possession as a short, contextual approval; never call it “connect wallet” unless a wallet is truly involved.

### Farcaster / Warpcast
- Existing Farcaster users expect a quick identity-based sign-in and a social feed, not a long Web3 setup wizard.
- The concepts most likely to confuse newcomers are FID, custody/recovery, signers, storage, and the difference between a Farcaster account and a client.
- Farcaster’s value is immediate when a user can discover channels and people and interact with existing network activity.

**Apply:** say “Your Farcaster identity” and “permission to post from HomieHouse.” Put “What is Farcaster?” in a tooltip/learn card, not in required copy. If a user already has Farcaster, support import/connect without forcing account creation.

## 2. Biggest first-time Farcaster friction points

1. **Unknown vocabulary:** “cast,” “FID,” “signer,” “key,” “channel,” and “decentralized” are not self-explanatory.
2. **Identity uncertainty:** users do not know whether HomieHouse is creating a new identity, connecting an existing one, or merely acting as a client.
3. **Posting authorization:** a signer approval or Hypersnap flow can look like a failed login unless its purpose and progress are explicit.
4. **Cold-start feed:** an empty or irrelevant timeline makes the product look broken.
5. **Handle/profile decisions:** choosing a username, display name, and avatar can feel permanent and high stakes.
6. **Trust and recovery:** people need to know what happens if they lose email access, change clients, or want to leave.
7. **Mobile/deep-link issues:** external approval, popup blockers, app switches, and returning to the right step can strand users.
8. **First-post anxiety:** users do not know what is interesting, safe, or socially acceptable to post.
9. **Moderation expectations:** decentralized does not mean unmoderated; users need mute/block/report and community expectations.
10. **Email deliverability:** verification links expire, land in spam, or are opened on a different device.

### Required plain-English glossary
- **Farcaster:** an open social network where identity and social activity can work across compatible apps.
- **Cast:** a post (similar to a tweet/post).
- **Channel:** a topic/community feed.
- **Farcaster identity:** the account/profile that can be used across Farcaster clients.
- **Posting permission:** a secure approval that lets HomieHouse publish for this identity; it is not a request for a seed phrase.

## 3. Complete in-app journey

### Stage 0 — Landing page (before signup)

Headline: **“Your friendly home on Farcaster.”**  Subhead: “Discover people and communities, ask AI for help, and share your first cast—no wallet required.” Primary CTA: **Get started with email**. Secondary CTA: **I already use Farcaster**. Include a three-item trust strip: free, no seed phrase requested, you can leave anytime. Show a sample populated feed and one example of `@thehomie` helping.

Do not lead with “decentralized,” “permissionless,” or “signer.” Explain those after activation.

### Stage 1 — Email entry and verification

1. User enters email; validate and normalize it client/server side.
2. Send a one-time magic link or short code. Say what happens: “We’ll use this to save your HomieHouse access and help you recover your account.”
3. Verification screen has resend, change email, spam-folder help, expiry time, and “I opened this on another device” fallback.
4. Consume tokens once, expire them quickly, rate-limit requests, and avoid revealing whether an email is registered.
5. On return, restore the intended route and show a small progress indicator.

Do not ask for a password, wallet, or recovery phrase in this path.

### Stage 2 — Identity choice

Ask one clear question: **“Are you new to Farcaster?”**

- **New:** create/link a Farcaster identity automatically, explain that HomieHouse is setting up a portable social profile. Show a progress state, retry, and support option.
- **Existing:** choose “Sign in with Farcaster / connect existing identity,” then complete native auth. Never make existing users create a duplicate identity.

Capture an explicit account model in Neon: `new`, `existing-connected`, `pending-auth`, `active`; maintain an audit trail for auth and signer events.

### Stage 3 — Profile setup (30–60 seconds, skippable)

Collect display name, suggested handle, avatar (upload or generated initials), and one-line bio. Preview the profile as others will see it. Mark handle as editable if that is technically true. Ask for timezone/language only if it improves recommendations. Avoid collecting sensitive personal data.

Success copy: “Your profile is ready. You can change any of this later.”

### Stage 4 — Interest selection and starter pack

Offer 6–12 large, recognizable choices (for example: AI, builders, crypto, art, music, sports, memes, founders, learning). Require at least one only if needed to generate a useful feed; otherwise allow skip. For each selected interest, automatically recommend a small starter pack: 5–10 people and 1–3 channels, with short reasons and visible follow checkboxes.

Use a “Follow 3 to shape your feed” goal, not “follow everyone.” Confirm each follow and make undo easy. Include a preview of what the feed will contain.

### Stage 5 — First-session orientation

Show a four-card coachmark, dismissible and replayable:
1. Home = your feed.
2. Channels = topic communities.
3. Compose = write a cast.
4. Mention `@thehomie` = ask the AI bot for help.

A “Try it” panel should ask `@thehomie what should I post about [selected interest]?` Use canned prompts so the user does not face an empty text box.

### Stage 6 — First cast (activation moment)

Trigger a friendly composer after the user has seen at least a few feed items, or let them choose “Post my introduction.” Provide editable templates:
- “Hi Farcaster 👋 I’m new here and interested in [interest]. What should I check out?”
- “I’m learning about [topic]. What’s one resource you recommend?”
- “Testing my first cast from HomieHouse—hello!”

Show character count, audience/context, preview, and a privacy/moderation note. Suggest one or two relevant channels, but never force cross-posting. If the user mentions `@thehomie`, disclose that it is an automated AI account and replies may be delayed or imperfect.

Before first publish, request Hypersnap/native posting approval in a focused modal:
- “You are signed in. One last step lets HomieHouse publish your cast.”
- “Approve posting permission; HomieHouse cannot see or request your recovery phrase.”
- “This is needed once; you can revoke/manage it in Settings.”

Provide a single primary button, a QR/deep-link fallback where relevant, a visible step counter, and robust return handling. If approval fails, preserve draft and offer retry, help article, and “browse without posting.” Never delete the draft.

After publish, show the cast immediately, celebrate, suggest one relevant next action (reply to a person, follow a channel, or ask `@thehomie`), and do not launch a tour wall.

### Stage 7 — First-week habit loop

On subsequent sessions, show a compact checklist: profile complete, 3 follows, first cast, first reply, first channel. Stop showing it once the user reaches a meaningful activation threshold. Personalize the home feed based on follows and behavior, not email content. Add a clear notification preference center.

## 4. How @thehomie should assist

Use the bot as a **guide and safety net**, not a mandatory gate.

- In signup: “Ask the Homie” explains Farcaster in one sentence and answers “What is a cast?”
- In discovery: generate starter-pack explanations: “These three builders post about AI; follow any you like.”
- In composer: propose prompts, rewrite a draft in the user’s voice, explain jargon, and warn before accidental personal data or hostile language. Always show the final text and require user publish action.
- After posting: suggest a reply or explain where the cast appears.
- In authorization: explain why posting permission is needed and troubleshoot stuck approval; it must never ask for a seed phrase/private key.
- In support: collect a diagnostic event ID and route account/auth issues to human support via Resend, without exposing private keys.

Bot boundaries: clearly label AI, no autonomous posting by default, no impersonation, no fabricated engagement, rate limits, prompt-injection-resistant handling of casts, and report/mute controls. Consider a safe default: `@thehomie` can reply only when mentioned, while onboarding suggestions are private UI unless the user explicitly posts them.

## 5. Email sequence with Resend

Email is a recovery and education channel, not a substitute for in-app activation. Every message has one primary CTA, deep-links back to the exact next step, plain-text fallback, unsubscribe/preferences (where applicable), and “contact support.” Do not send behavioral/social content without consent.

| Timing / trigger | Subject and purpose | Content / CTA |
|---|---|---|
| Immediately after request | “Your HomieHouse sign-in link” | One-time link/code, expiry, device/browser hint, security note, resend/help link. Transactional. |
| Immediately after verification | “Welcome home—your Farcaster profile is ready” | What HomieHouse is, three-step path, “Choose your interests.” Mention no wallet/seed phrase required. |
| +1 day if no activation | “Want help finding your corner of Farcaster?” | Two-minute explanation of casts/channels, 3 starter-pack links, “Pick an interest.” Avoid guilt. |
| +3 days after profile but no first cast | “Your first cast can be simple” | Three editable examples and link to composer; explain posting approval in one sentence. |
| +5 days after first cast | “Three ways to make your feed yours” | Follow more people, join a channel, reply to one cast; link to personalized feed. |
| +10–14 days, only if inactive | “Still here when you’re ready” | One useful tip, support link, preference controls; then suppress sequence. |
| Event-based | “New sign-in / posting permission changed” | Security alert, timestamp/device, revoke/help route. Transactional and never promotional. |

Stop or branch sequences on verification, first cast, support request, unsubscribe, bounce, or complaint. Avoid daily email. Use Resend tags/metadata such as `user_id`, `onboarding_stage`, and `campaign`; never put secrets in metadata or URLs. Verify the sending domain, configure SPF/DKIM/DMARC, use a dedicated onboarding sender, monitor bounces/complaints, and keep support replies separate from marketing preference logic.

Implementation notes for Next.js: send from server-only route handlers/server actions using `RESEND_API_KEY`; never expose the key client-side. Use React Email/templates if already adopted. Use idempotency keys such as `welcome-user/{id}` for retries, enqueue/schedule delayed messages rather than blocking signup, and make every job safe to replay. Resend provides transactional Sending API/SDKs, batch sending, scheduling, templates, automations, delivery logs, and deliverability insights; its documentation notes a default team rate limit of 10 requests/second, so batch or queue safely.

## 6. Drop-off reduction by step

- **Landing → email:** clear “no wallet required,” show the product, offer existing-Farcaster path, minimize fields.
- **Email request → verification:** magic link plus code fallback, resend cooldown, device handoff, spam guidance, branded sender, short expiry with safe reissue.
- **Verification → identity:** explain what is being created/connected; preserve state; retry with clear error copy; do not expose protocol internals.
- **Identity → profile:** defaults, avatar initials, suggested handle, skip option, immediate preview.
- **Profile → discovery:** no empty feed; curated starter packs; follow progress and undo.
- **Discovery → first cast:** template, private draft, `@thehomie` coaching, no requirement to be clever.
- **Composer → publish:** request Hypersnap only at intent; preserve drafts through redirects; deep-link/QR fallback; status polling and recovery.
- **Publish → return:** instant confirmation and visible cast; one next action; avoid modal overload.

Accessibility and reliability requirements: keyboard-usable controls, readable error states, reduced-motion support, mobile-first external-auth return path, stable deep links, analytics that do not capture cast text or email, and support links on every irreversible-looking step.

## 7. Metrics and instrumentation

### Funnel metrics
Track event name, anonymous/session ID, user ID after verification, platform/device, and onboarding variant:

1. landing CTA click / landing unique visitor
2. email submitted / CTA click
3. email verified / email submitted
4. identity created or connected / verified
5. profile saved / identity ready
6. first interest selected / identity ready
7. starter-pack viewed and follows completed
8. posting approval started / composer opened
9. approval completed / approval started
10. first cast publish success / composer opened
11. first reply or second session within 7 days

Report conversion and median time between steps, with error rates by device/browser and auth provider. The north-star onboarding metric is **activated user within 24 hours** = verified user who follows ≥3 accounts/channels and successfully publishes one cast (also report a browse-only activation variant).

### Quality and retention
- D1/D7/D30 retained users
- feed relevance: follows, dwell/reads, likes/recasts/replies per active user
- first-cast reply rate and time to first meaningful interaction
- percentage completing profile, first channel, and first `@thehomie` interaction
- Hypersnap approval success, latency, retry count, abandonment, and support tickets
- email delivery, open, click, bounce, complaint, unsubscribe, and reactivation rates
- AI helpfulness rating, suggestion acceptance/edit rate, wrong-answer reports, and bot mention response latency

Use a privacy-safe event schema in Neon; do not log email verification tokens, private keys, recovery phrases, full cast text, or raw AI prompts unless explicitly consented and protected. Build a funnel dashboard and alert on sudden verification/auth/publish regressions.

### Experiment backlog
A/B test one variable at a time: “Get started with email” vs value-led CTA; interests before profile vs profile before interests; three starter packs vs a larger list; immediate composer vs delayed composer; template wording; Hypersnap explanation length. Guard experiments with activation, complaint/support rate, publish failures, and D7 retention—not clicks alone.

## 8. Suggested data and state model

Persist an onboarding record keyed to the HomieHouse user, not only browser local storage:

```text
onboarding_stage: email_verified | identity_ready | profile_ready | discovered | composer_ready | activated
identity_mode: new | existing_connected
profile_completed_at, first_follow_at, signer_approved_at, first_cast_at
selected_interests, starter_pack_version, email_sequence_version
last_step, draft_cast (encrypted/protected as appropriate), completed_at
```

Keep server truth for email/auth/authorization and use local state only for transient UI. Make stage transitions idempotent and monotonic except for explicit recovery. This matters because the current app can have a profile in local storage while signer approval is a separate state; onboarding must explain and reconcile those states rather than treating a profile as posting-ready.

## 9. Launch plan

**Phase 1 (must-have):** landing copy, email verification/recovery, new-vs-existing identity choice, profile defaults, interest/starter packs, first-cast templates, draft preservation, clear Hypersnap modal, core funnel events, and support route.

**Phase 2:** Resend triggered sequence, `@thehomie` onboarding help and composer suggestions, starter-pack personalization, delivery/auth dashboards, accessibility and mobile deep-link hardening.

**Phase 3:** experiments, adaptive onboarding based on source/referrer, channel-specific welcome paths, human-curated community guides, and a user-controlled educational “How Farcaster works” tour.

## Sources and research notes

External research access was partially unavailable in this environment, so recommendations are grounded in established product patterns and the following official documentation/primary product references to validate during implementation:

- Farcaster documentation and protocol repository: https://docs.farcaster.xyz/ and https://github.com/farcasterxyz/protocol
- Farcaster app: https://warpcast.com/ (now commonly branded Farcaster)
- Bluesky / AT Protocol: https://bsky.social/ and https://atproto.com/
- Lens: https://lens.xyz/ and https://docs.lens.xyz/
- Resend sending overview: https://resend.com/docs/dashboard/emails/introduction
- Resend Next.js SDK guide: https://resend.com/docs/send-with-nextjs
- Resend email types: https://resend.com/docs/email-types
- Resend automations, scheduling, templates, idempotency, and deliverability documentation linked from the sending overview.

These links should be checked against current product terminology before publishing user-facing copy, especially Farcaster’s current auth/key-management wording and Resend’s current automation/broadcast capabilities.
