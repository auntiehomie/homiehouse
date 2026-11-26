# Device web push

The existing one-minute `/api/push/check-notifications` cron now delivers opted-in
reply/mention digests and optional new casts from the account’s Following feed.
No permission prompt occurs until the user chooses Enable in Alerts or Getting started.

## Deployment

1. Apply existing Next.js security update PR #471 before these feature branches.
2. Generate one VAPID pair with `npx web-push generate-vapid-keys`.
3. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` at build time and `VAPID_PRIVATE_KEY` server-side.
   Keep the pair stable; rotation requires devices to resubscribe.
4. Set `DATABASE_URL` and the existing `CRON_SECRET`. Vercel sends the cron bearer
   token; do not expose the secret or manually call the job without authorization.
5. Deploy. Schema bootstrap is idempotent in both subscription and cron paths:
   fixes expression-index creation and adds preferences, a separate Following-feed
   watermark, and a per-device processing lease. No production DB was changed by this PR.
6. In Alerts, select types, Enable, and grant browser permission. New Following casts
   are off by default. Save settings or Disable independently on each device.
7. From another Farcaster account, reply and mention the subscriber; opt into new casts
   and publish from an account they follow. Verify an OS notification, click destination,
   no duplicate on the next run, disable, and expiry cleanup. Check on iOS installed to
   the Home Screen as well as a desktop supporting Web Push.

## Semantics and limits

- The server fetches canonical Hypersnap notifications and at most 25 Following casts
  per run, not an event stream. This is best-effort recent-sample delivery: high volume,
  indexing delays, or events older than a successfully delivered watermark can be missed.
- One digest per device/run avoids one OS alert per cast; the newest update is the click
  target. Only replies, mentions, and explicitly opted-in Following casts are included.
  Existing likes/recasts/follows stay in the in-app Alerts inbox.
- Each source advances only to observed timestamps, never wall-clock delivery time.
  Failed delivery retains checkpoints; 404/410 endpoints are removed. Concurrent jobs
  use short database leases. A crash after sending but before checkpointing can still
  duplicate a digest (at-least-once retry semantics).
- Jobs take a fair bounded batch of 100 devices and stop starting work after 30 seconds.
  Larger subscriber sets can require more runs; monitor latency/errors before scaling.
- Push transport is encrypted by web-push and uses the existing SSRF-safe fetcher with
  HTTPS, no redirects, five-second timeout, and a five-minute TTL.
- Sign-out/account changes unsubscribe the old browser endpoint. Opt-in is device-local;
  switching to a new account requires explicit enable. Server upserts remove prior-account
  ownership for the same endpoint and preserve existing notification checkpoints.
- Server push does not read device-local mute/hide lists. OS previews can show public cast
  excerpts on a locked device. The body is capped to 100 characters.

Local automated tests use stubbed auth/indexer/push transport, not real delivery credentials.
A successful build/test does not prove production VAPID, database permissions, cron scheduling,
provider availability, browser permission, or OS delivery; run the deployment checklist above.
