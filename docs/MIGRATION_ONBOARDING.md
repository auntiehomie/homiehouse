# First-visit migration guide

A first-time visitor sees “Make Homiehouse your home,” a dismissible native dialog loaded from the global client shell. It supports keyboard focus containment and Escape, a compact four-step overview with expandable details and a scrollable phone/iPad layout, a remembered dismissal, and manual reopening.

## Steps and boundaries

1. Preview an existing profile through GET `/api/profile?username=...`. This never writes a profile or creates a session; viewing the public profile uses the existing `user` query route.
2. Open the existing wallet login. This entry suppresses automatic posting enrollment so that login and posting remain separate visible steps. Other login entry points retain their behavior.
3. Explicitly request the existing signer approval UI. Posting still requires the FID custody wallet supported by that flow; a verified login wallet alone may be insufficient. No new FID or signer is created merely by opening the guide.
4. Show installation instructions, Alerts guidance, and an explicit notification opt-in. Initial load only restores push subscriptions when permission was already granted. Browser permission prompts are never requested by the eight-second startup timer.

Visitors can skip every step, explore the feed, or reopen Getting started from the mobile/desktop menu. Signed-out visitors also have a persistent Getting started button. Existing cached accounts are not automatically interrupted by this new introduction. Dismissal is per browser/device under `hh_migration_guide_v1`; account-bound cross-device progress is not claimed.

The guide does not import private messages, other apps' drafts/bookmarks, transfer assets, or promise complete node history. It reads existing network identity/data and routes into current supported auth/posting flows.

## Verification

- Unit coverage: new visit, remembered dismissal, existing-account suppression, malformed profiles, blocked storage.
- Browser scenarios: first render, responsive dialog width, profile preview without authentication, dismissal across reload, reopening, and handoff to wallet login at 390px and 820px widths. API fixtures and external-request blocking prevent real wallet/network actions.
- Real custody-wallet login, signer approval, iOS Home Screen installation, and push subscription delivery require manual device confirmation after deployment.

Validation result: all 157 Jest tests across 33 suites passed, TypeScript passed, and changed-source lint reported zero errors (two existing warnings in FarcasterLogin). The isolated Chromium scenarios passed at 390×844 and 820×1180. Local browser setup used a test WalletConnect project ID, blocked external requests, disabled service workers, and adjusted only the local Turbopack root to resolve shared dependencies. Blocked wallet configuration fetches were expected fixture errors; no real login signatures, signer submissions, notifications, or posts were performed. These local harness settings are not included in the change.
