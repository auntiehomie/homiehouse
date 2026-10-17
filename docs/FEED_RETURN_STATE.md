# Feed return state

Returning from a cast must resume the loaded feed pages, cursor, selected scope/channel, and the original card's viewport offset. It must not request a fresh first page.

## Failure paths found

- The previous capture wrote a large JSON snapshot and then a small return marker in one `try`. A quota/security error in the first write skipped the marker as well. The remounted feed then fetched page one. A browser regression with blocked session writes reproduced two first-page requests instead of one.
- Cached items expired after five minutes while the return marker lived for ten. Reading a long cast could therefore retain the position but lose its list.
- Capture truncated the list to 300 items without changing its end cursor. A deeper anchor could be missing from the saved list, with pagination skipping the omitted rows.
- Layout CSS can make `body` or another ancestor scroll independently of `window`. Saving `window.scrollY` alone can record zero. The same check in pull-to-refresh could interpret a normal downward touch drag as a refresh.
- The old alignment stopped after roughly half a second of stable layout. A later embed above the anchor could move the card after restoration had ended.

## Implementation

`feed-session.ts` keeps the complete loaded array, cursor, pagination state, and return metadata in tab memory. Session storage is an optional reload backup; its writes are isolated and the small marker is attempted first. Both the list and scope/channel selector read the same return state. Account keys separate snapshots. Ordinary caches can expire, but an active in-tab return remains valid while the user is reading; persisted reload recovery is bounded to 30 minutes.

`FeedList` captures the containing card even when a parent or quoted-cast link is clicked. A matching return snapshot restores the list and skips the first-page fetch. A deliberate pull-to-refresh consumes the return marker and fetches a new first page.

`feed-scroll.ts` discovers the actual scrollable ancestor and restores the card's viewport offset, including an offset inside a tall post. A short-lived resize observer corrects late layout changes. Touch, wheel, or keyboard input releases the anchor; unmounting cancels all work. Pull-to-refresh uses the same scroll host and requires a gesture that starts at the top.

## Verification

Run `npx jest __tests__/lib/feed-session.test.ts --runInBand` and `npx playwright test e2e/feed-return.spec.ts`. Browser fixtures block outside requests; server-side Hypersnap metadata uses the local test node defined in `playwright.config.ts`.

The browser scenarios assert a single first-page request, exact viewport offset after returning from a long post, storage-quota fallback, extended reading time, delayed media reflow, and a downward drag away from the top. Navigation-history regressions remain in `e2e/cast-navigation.spec.ts`.

The screenshot/recording report alone does not establish that the user's device hit a storage quota. These are reproduced code failure paths. PR #249 was still open at investigation time; production had not received that navigation work.
