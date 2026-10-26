# Native iOS client: architecture and delivery

## Decision

Keep a separate SwiftUI app in `ios/`. Share backend contracts and protocol behavior with the
web client. Do not refactor the web app into a native shell. Feed, conversation, pagination,
compose and navigation are SwiftUI. Login, signer authorization and protocol signing use a
transitional same-origin adapter at `/ios-connect`.

The adapter is intentional: duplicating the Hypersnap gasless KEY_ADD custody signature,
protobuf and BLAKE3 implementations before compatibility testing would create two signing
stacks to maintain. The native app supplies text and a reply target, not a caller-selected FID.
The existing hook selects the authenticated signer and signs locally.

## API audit

| Capability | Contract | Current iOS handling |
| --- | --- | --- |
| Community | GET `/api/feed?feed_type=community` → `{data,cursor}` | Native; server page ranking retained |
| Following | GET `/api/feed?feed_type=following&fid=...` | Native after connection |
| Thread | GET `/api/cast?hash=...&replies_cursor=...` | Native parents, replies, unavailable state and cursor |
| Login | Existing wallet / Hypersnap sign-in UI | Web adapter; no FID-only authentication endpoint |
| Signer approval | Existing `/api/hypersnap/signer` policy | Existing web approval UI |
| Publish | Locally signed bytes → POST `/api/submit-cast` | Native text editor invokes existing hook via adapter |
| Server compose | POST `/api/compose` | Deliberately unused: server bot signer is not a user's signer |
| Learning / AskHomie | Existing web APIs | Pending native contract audit and UI |
| Encrypted messages | Selectable mailbox node design | Pending native crypto and mailbox integration |
| Embedded wallet / mini apps | Separate signing and hosting requirements | Pending native lifecycle validation |

Native Community currently consumes server ranking only. The web client's device-local
like-based personalization, reactions, muting and other feed controls are not yet ported.
The feed cannot show casts outside the node's available coverage.

## Credential boundary

The native host calls adapter functions only on the configured HTTPS origin and exact
`/ios-connect` path. Arguments use WebKit's structured `callAsyncJavaScript` API, not string
interpolation. No script-message handler exposes native storage to subframes or arbitrary pages.
Foreign top-level navigation is canceled; permitted user links and wallet deep links open
through the OS. External links never receive native Keychain state.

A saved approved signer plus profile is held in an unlocked-only, device-only Keychain item.
The signing web view uses a nonpersistent data store. On restore, the adapter checks the saved
profile/FID/key shape; this is local restoration, not server proof. The node checks actual signer
permission when publishing. The web adapter's JavaScript has access to that signer while
running, just as the web client does. Native signing should eventually remove this dependency.
No recovery phrase or custody private key is requested. Sign-out removes the Keychain item and
web data; it does not revoke the protocol signer on the node. Identity-only sessions require
reconnection on relaunch until a dedicated native session flow is added.

## Required macOS and device verification

1. Run shared-scheme unit tests and simulator build on macOS CI.
2. Check iPhone compact navigation and iPad split layout, rotation, keyboard, VoiceOver and large text.
3. Connect using a real wallet. Test wallet deep links, return to app and canceled authorization.
4. Approve a signer, publish a short cast, a multibyte long cast and a reply. Verify each hash at the node.
5. Relaunch and unlock: confirm Keychain restore, then test expired/revoked signer rejection.
6. Sign out, relaunch and confirm both native and web credentials are gone.
7. Simulate feed failures, pagination failures and a node outage after submission. Preserve drafts;
   avoid automatic publication retry because the node may already have accepted the message.

## Remaining implementation

1. Port native reactions, local feed preferences, photo picker/upload (four photos plus gallery
   fallback), rich embeds and cast text threading. Current native composer is text-only.
2. Add native course browsing, lesson rendering, progress and AskHomie using audited contracts.
3. Implement native Hypersnap signer provisioning and protocol signing with cross-language vectors;
   replace the web adapter after parity tests, keeping Keychain custody of signer credentials.
4. Integrate user-selectable encrypted mailbox nodes and test interoperability with the web client.
5. Implement wallet and mini-app host interfaces, universal links, push and background lifecycle.
6. Complete native/network privacy declarations, backend data inventory, icons, moderation/reporting,
   account deletion and App Store purchase requirements before TestFlight/App Store review.

The included privacy manifest declares no native tracking or required-reason APIs. It is not a
claim that the existing web backend collects no data; audit both before distribution.
