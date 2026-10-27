# Pro access and existing Farcaster messages — 2026-10-17

## Paid Pro remains locked

Production runtime logs show the Stripe webhook successfully activated the
reporting account before the screenshot. No payment or entitlement was manually
created or changed during this investigation.

The Pro page and Feed requested `/api/pro-status` without credentials, and the
Learning Hub premium list requested `/api/premium-track` without credentials.
The status endpoint returned a successful `is_pro: false` for authentication
failures. The track endpoint silently fell back to teasers and could share-cache
that response. An authenticated module route already existed, but the list did
not let a paying user open it.

Fix:

- Shared client helpers send `read:all` credentials on status, listing and lesson
  requests and use `cache: no-store`. A read-only login suffices; reading paid
  lessons does not require approval to post casts or make another payment.
- Status and all premium responses use private, no-store caching. Invalid auth
  is an error; database outages no longer become a free-user entitlement.
- The Pro page retries briefly after checkout and offers Refresh access. Pro
  status and the premium list recheck on window focus and activation events.
  Errors offer recovery rather than another payment button. A later request
  still verifies the authenticated identity and paid database record.
- User-scoped access is tested: another FID cannot be selected via a status
  query, public visitors only receive teasers, unpaid users remain gated, and
  full lessons require verified Pro access.

## Existing direct messages

Amanda chose **existing Farcaster inbox**, not a separate Homiehouse inbox.
The current official docs describe Direct Casts as client-service data, not
protocol messages. They publish a send API and composer intent:
`https://farcaster.xyz/~/inbox/create/[fid]`. The inspected Hypersnap API has no
Direct Cast inbox/auth endpoint. The draft FIP proposes separate custody-based
authorization; it is not an implemented API contract and does not authorize
reusing public-post signers to read private messages.

Implemented: Messages menu/page opens the existing Farcaster inbox, and profile
Message links open the documented composer for that exact FID. The Messages
page also accepts a FID. All links clearly hand off to Farcaster; Homiehouse
does not claim to sync messages, store a separate inbox or send automatically.
No private messages or messaging credentials were fetched or sent in testing.

**Full in-app inbox sync remains blocked** until a current supported inbox-read
API and app authorization flow/access are verified. Do not add guessed endpoints,
reuse a cast signer as DM authorization, request seed phrases, or describe this
handoff as a native synced inbox. The public Notion send-API reference could not
be retrieved during this investigation; that does not prove it is unavailable.

Primary references checked:

- https://github.com/farcasterxyz/docs/blob/main/docs/reference/farcaster/direct-casts.md
- https://github.com/farcasterxyz/protocol/discussions/226 (draft, not proof of deployment)
- https://github.com/farcasterorg/hypersnap/blob/main/src/api/mod.rs

## Verification

229 Jest tests / 44 suites pass, including 24 new entitlement and message-link
cases. TypeScript and changed-source lint pass (existing warnings). Three
browser fixtures cover paid return → premium list → full lesson and outbound
message links at phone/tablet/desktop widths. They have not executed successfully:
the current local browser environment rejects Chromium's required socket before
page launch, as recorded in the preceding navigation investigation.

Still required: verify the paid account through the deployed UI and check the
Farcaster handoff on physical iOS/Android and desktop after merge/deployment.
