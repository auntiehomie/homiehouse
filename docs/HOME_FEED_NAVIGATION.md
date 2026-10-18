# Home preview, cast detail and Feed navigation

## Report and cause (2026-10-17)

The 18:19:54 iPhone recording opens casts from Home's **From your feed** preview.
The global `CastNavigationTracker` intercepted Feed links and used the previous
route (or the last cast) as their destination. As a result, Feed could return to
Home or reopen a conversation instead of opening `/feed`. Its capture listener
also stopped propagation, preventing mobile drawer links from closing the menu.

Separately, Home did not participate in FeedList's snapshot/anchor restoration.
Returning from a cast remounted Home, fetched a new preview and learning state,
and lost the reading position. Existing full-feed scroll tests did not cover this
entry point and one navigation test explicitly required Feed to resume a cast.

## Behavior

- Header, sidebar and drawer Feed links always open `/feed`, including from a
  nested conversation, Home preview, Compose or Learn.
- The detail Back button still retraces the actual source, including Home,
  profile queries and nested casts. Native browser Back/Forward remains available.
- Home captures the clicked cast, its viewport offset, the actual scroll host,
  exact preview cards and learning state. Back restores that snapshot and follows
  late layout changes until user input or timeout, using the full feed's existing
  anchor restoration utility.
- Home snapshots are scoped to the FID and retain an active in-tab return while
  reading. Persisted reload recovery expires after 30 minutes. After restoration,
  a fresh Home visit fetches new data rather than caching learning progress forever.
- Session storage failure retains Home data and route history in tab memory.
- Feed preserves a pending full-feed anchor; without one, normal route scrolling
  applies. Home's return marker is separate from the full-feed marker.

Next.js guidance checked in the installed package:
`next/dist/docs/01-app/03-api-reference/02-components/link.md` and
`04-functions/use-router.md` (scroll management and push/replace behavior).

## Validation

- 209 Jest tests / 42 suites pass, including Home snapshot/owner/expiry tests and
  the navigation storage-failure regression.
- TypeScript and changed-source ESLint pass; whitespace checks pass.
- `e2e/home-feed-navigation.spec.ts` covers 390, 820 and 1280px layouts. It checks
  Home → cast → Back without another Home feed request or anchor movement, then
  header/sidebar and mobile drawer Feed destinations and drawer closure.
- Existing cast-navigation tests now require Feed to open the full feed while
  retaining nested-cast Back and full-feed anchor checks.
- Local browser execution is **blocked**, not passed: Chromium exits before
  opening a page with `socket() failed: Operation not permitted (1)` in
  `process_singleton_posix.cc`. Nine attempted cases cannot exercise the app.
  No live posts, payments or production configuration changes were made.

Remaining device verification: run the Home-preview return and Feed menu paths
in a browser-capable environment and on physical iOS/Android. Check native Back
and Forward, nested quotes, and return to a previously scrolled full feed.
