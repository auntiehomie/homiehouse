# HomieHouse Go-to-Market & Onboarding Strategy

**Created:** 2026-08-19
**Status:** Active — executing Phase 1

## Vision

HomieHouse is the friendly, AI-powered gateway to Farcaster. Not another power-user tool — the client that makes Farcaster accessible to people who've never heard of protocols, FIDs, or signers. @thehomie is both the onboarding guide and the marketing voice.

## Market Position

### Competitor landscape
- **Warpcast/Farcaster app:** Default client, largest network effects, but crypto-native onboarding alienates newcomers. ~600k registered FIDs, DAU peaked ~70k in 2024 then contracted.
- **Herocast:** Open-source power-user desktop client (scheduling, multi-account, analytics). Validates paid creator operations but desktop-first limits reach.
- **Quorum Mobile:** Unconfirmed product identity. Watch item, not a benchmark.
- **Nook:** Defunct. Cautionary tale — differentiation without retention economics fails.

### HomieHouse's wedge
**Community operations + AI onboarding, not another generic feed.** The differentiators:
1. Email-only signup — no wallet, no seed phrase, no crypto knowledge required
2. @thehomie AI bot as onboarding guide, content coach, and community assistant
3. Interest-based starter packs that solve the cold-start problem
4. Creator/community tools (scheduling, analytics, moderation) as paid tiers

## Monetization Model

### Free tier
- Full feed browsing, casting, follows, channels
- @thehomie AI replies (rate-limited)
- Basic analytics
- Email onboarding sequence

### Creator tier ($9–19/mo, hypothesis to test)
- Scheduled casts
- Advanced analytics (engagement, reach, growth)
- @thehomie premium (draft assistance, thread summaries, content ideas)
- Custom feeds/filters
- Multi-account management

### Team/Community tier ($49–199/mo, hypothesis to test)
- Shared channel management
- Moderation queue + AI-assisted moderation
- Member CRM/directory
- Campaign scheduling across accounts
- Team analytics dashboard
- Priority @thehomie AI credits

### Transaction revenue (later)
- 3-8% on mini-app commerce (events, gated content, collectibles)
- Near-pass-through on tips

## Marketing Strategy — @thehomie as marketer

### Phase 1: Content marketing via Farcaster (now)
@thehomie already casts. Shift its content to:
- **Educational casts:** "What is Farcaster?" threads, onboarding tips, "how to" guides
- **Community engagement:** Reply to newcomers, welcome new users, answer questions
- **Product highlights:** Cast about new HomieHouse features with screenshots/demos
- **Curated content:** Daily/weekly "interesting casts" digest to showcase Farcaster value

### Phase 2: Email + social growth loop
- Onboarding emails include "share HomieHouse" referral links
- @thehomie mentions new users publicly (with opt-in) to create social proof
- Weekly Resend digest of best Farcaster content (drives return visits)

### Phase 3: Mini-app growth loop
- HomieHouse mini-app templates (polls, event RSVP, intro cards)
- Each template includes "Powered by HomieHouse" attribution
- Communities publish mini-apps in casts → new users discover HomieHouse

### Marketing metrics
- Weekly active @thehomie mentions/replies
- Referral signups per week
- Email digest open rate and click-through
- Mini-app shares and attributed signups
- Inbound mentions of HomieHouse on Farcaster

## Onboarding Strategy

### North star metric
**Activated user within 24 hours** = verified user who follows ≥3 accounts/channels AND publishes one cast.

### Critical path (simplified)
1. Landing page → email entry (no wallet mentioned)
2. Email verification (magic link via Resend)
3. Identity choice: "New to Farcaster?" (auto-create) vs "I have Farcaster" (connect)
4. Profile setup (30s, skippable: name, handle, avatar)
5. Interest selection → starter pack follows (3+ follows)
6. Orientation coachmark (4 cards: feed, channels, compose, @thehomie)
7. First cast (with templates + @thehomie coaching)
8. Hypersnap posting approval (only at first publish, not before)

### Email sequence (Resend)
| Trigger | Subject | Purpose |
|---|---|---|
| Signup | "Your HomieHouse sign-in link" | Magic link, 15min expiry |
| Verified | "Welcome home — your Farcaster profile is ready" | 3-step path, "no wallet required" |
| +1 day, no activation | "Want help finding your corner of Farcaster?" | Starter packs, interest picks |
| +3 days, no first cast | "Your first cast can be simple" | 3 editable examples |
| +5 days after first cast | "Three ways to make your feed yours" | Follow more, join channel, reply |
| +10-14 days, inactive | "Still here when you're ready" | One tip, support link, then suppress |
| Security events | "New sign-in / posting permission changed" | Transactional security alert |

### Onboarding state model (Neon)
```
onboarding_stage: email_verified | identity_ready | profile_ready | discovered | composer_ready | activated
identity_mode: new | existing_connected
profile_completed_at, first_follow_at, signer_approved_at, first_cast_at
selected_interests, starter_pack_version, email_sequence_version
last_step, draft_cast, completed_at
```

### Drop-off reduction priorities
1. **Landing → email:** Lead with "no wallet required," show product, minimize fields
2. **Email → verification:** Magic link + code fallback, spam guidance, branded sender
3. **Verification → profile:** Defaults, avatar initials, suggested handle, skip option
4. **Profile → discovery:** No empty feed — curated starter packs by interest
5. **Discovery → first cast:** Templates, @thehomie coaching, low-pressure prompts
6. **Composer → publish:** Request Hypersnap only at intent, preserve drafts through redirects

## Execution Plan

### Phase 1 — Foundation (this week)
- [ ] Resend integration (API route + email templates)
- [ ] Email signup flow (magic link auth)
- [ ] Onboarding state table in Neon
- [ ] Landing page copy update ("no wallet required" messaging)
- [ ] @thehomie marketing content plan (first 10 educational casts)

### Phase 2 — Core onboarding (next 2 weeks)
- [ ] Profile setup flow (skippable, with defaults)
- [ ] Interest selection + starter pack system
- [ ] Orientation coachmarks
- [ ] First-cast templates with @thehomie coaching
- [ ] Funnel analytics instrumentation

### Phase 3 — Growth loops (weeks 3-4)
- [ ] Resend onboarding email sequence (all 6 emails)
- [ ] Weekly digest email (best of Farcaster)
- [ ] @thehomie marketing cast schedule
- [ ] Referral system (share links in email + app)
- [ ] Mini-app template #1 (intro card)

### Phase 4 — Monetization (weeks 5-8)
- [ ] Creator tier paywall + Stripe integration
- [ ] Scheduled casts feature
- [ ] Advanced analytics dashboard
- [ ] Team/community tier features
- [ ] @thehomie premium mode

## Research documents
- `research/competitor-analysis.md` — full competitor landscape
- `research/onboarding-strategy.md` — detailed onboarding flow design