# Message and channel provider audit

**Reviewed:** 2026-10-18

## Findings

- Channel list, user-channel membership, channel details, and channel feeds already use Hypersnap endpoints through `src/lib/hypersnap.ts` and the `/api/channels` and `/api/channel` routes.
- Cast publishing, replies, reactions, and follows construct protocol messages locally and submit them to Hypersnap. The `warpcast.com/~/channel/<id>` `parent.url` is a canonical protocol identifier, not an API call.
- HomieHouse cannot sync existing private Direct Cast conversations through the current Hypersnap API. The Messages page and profile links intentionally hand off to Farcaster's inbox and composer; they do not read or send private messages in the background.
- Direct Warpcast API calls were found in signer-cache recovery, two unused legacy signer routes, and the one-time agent signer script. Cache recovery now checks the active Hypersnap signer and then the onchain key registry. The old routes return `410 Gone` with the current Hypersnap signer route. The old script exits with a migration note and performs no network request.
- The unused generic Pinata Farcaster API fetch helper was removed. Pinata remains in use for IPFS media storage; social reads/writes are delegated to Hypersnap.

## Files changed

- `src/lib/auth.ts`: removed signed-key-request lookup at Warpcast; legacy cache recovery uses the onchain key registry.
- `src/app/api/signer/route.ts`, `src/app/api/register-user-key/route.ts`: retired old Warpcast signer routes with explicit `410 Gone` responses.
- `scripts/setup-agent-signer.ts`: retired the Warpcast registration/polling script.
- `src/lib/pinata.ts`: removed unused Pinata Farcaster API request implementation.
- `src/hooks/useFarcasterWrites.ts`: corrected stale signer setup copy and routes stale signer state into the Hypersnap enrollment UI.
- `src/app/compose/page.tsx`, `src/app/profile/ProfileClient.tsx`, `src/components/SmartEmbed.tsx`, and `src/app/settings/page.tsx`: removed obsolete Warpcast approval guidance and corrected the custody-wallet requirement.
- `src/config/web3.ts`: removed an unused Farcaster hub setting that defaulted to the sunset Pinata hub.
- `src/app/messages/page.tsx`: clarifies why inbox reads remain an external handoff.
- `docs/READ_WRITE_INFRASTRUCTURE.md`: replaced the obsolete Pinata/Warpcast architecture description.

## Verification

- All 229 Jest tests across 44 suites pass, including auth fallback and message-link coverage.
- Changed-source ESLint completes with zero errors; it reports existing warnings.
- `npm run build` passes, including TypeScript validation and route generation.
- `git diff --check` passes.
- The retired signer endpoints build and return the migration response from their route handlers. Preview should confirm those responses and verify channel discovery/feed/posting through Hypersnap.

Full inbox sync remains blocked on a documented provider API and authorization flow.
