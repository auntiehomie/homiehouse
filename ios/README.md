# Homiehouse for iOS and iPadOS

A separate SwiftUI client; the web application remains in its existing directories.
Open `Homiehouse.xcodeproj` on a Mac, select the shared **Homiehouse** scheme,
choose an iPhone or iPad simulator, then Run. Minimum deployment target: iOS 17.
For a physical device, choose your Apple development team under Signing & Capabilities.
There are no external Swift package dependencies and no paid service added by this client.

## First working slice

- Native Community / Following feeds, refresh, cursor pagination and deduplication.
- Native conversations with parent context, paginated replies, and links to embedded sites.
- Native text composer and replies, 1,024 UTF-8 byte limit, and node acknowledgement before dismissal.
- Existing Hypersnap login and signer approval in a contained web view.
- Device-only, unlocked-only Keychain credential persistence; an ephemeral web view receives
  the saved signer to run the existing message builder. The signer is never sent to `/api/compose`.
- iPhone stack navigation and iPad split navigation, system safe areas and Dynamic Type.

## Connecting to the backend

`HomiehouseApp.baseURL` defaults to `https://homiehouse.app`.
The same deployment must serve the new `/ios-connect` route. Point that constant at an
HTTPS preview of this PR for pre-merge testing. The public feed can work against an older
backend; account connection cannot. The adapter is hydrated after navigation, with a bounded
readiness handshake and a reload action for failure.

No server secret or node address belongs in the native bundle. Feed and cast reads use
Homiehouse's existing server routes and node configuration. Publishing reuses the web
client's local Ed25519/protobuf/BLAKE3 signer and `/api/submit-cast` relay, not the bot signer.
Identity-only login does not grant write access. Restored signers remain subject to node
validation, revocation and expiry when they submit messages.

## Validation

On macOS:

```sh
xcodebuild test -project ios/Homiehouse.xcodeproj -scheme Homiehouse \
  -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO
```

Choose a simulator installed on your Mac. `.github/workflows/ios.yml` discovers an available
simulator and runs the shared scheme. Adapter Jest tests cover write permission, byte limits,
reply targeting, acknowledgement failures and saved identity mismatches.

This implementation was authored on Linux: Xcode compilation, simulator UI and real wallet
handoffs must pass on macOS/device before this is considered release ready. This is an initial
client, not feature parity or an App Store submission. No App Store or TestFlight deployment
has been performed.

## Next milestones

See `../docs/ios/architecture.md` for the API audit, verification checklist and roadmap.
