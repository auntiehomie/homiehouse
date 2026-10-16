# Hypersnap protocol-token login

**Status:** Server-side session exchange implemented; client token acquisition remains pending SDK/user-wallet validation.

HomieHouse now supports an additional `POST /api/auth/session` proof:

```json
{ "protocolToken": "hqa1.<message>.<signature>" }
```

The server verifies the short-lived, domain-bound wallet signature and its FID/address relationship against Hypersnap using `@farcasterorg/quick-auth`. It derives the session FID from that verified token; a body-supplied FID is never trusted. On success it issues a **read-only** HomieHouse session. Existing approved-signer login remains available during rollout and retains its current scopes.

This integration explicitly disables classic Quick Auth JWTs (`acceptQuickAuthJwt: false`), so it does not fall back to `auth.farcaster.xyz`. The Hub base URL is `NEXT_PUBLIC_HYPERSNAP_URL`, defaulting to `https://haatz.quilibrium.com`. Token audience/domain validation uses `HOMIEHOUSE_AUTH_DOMAIN` when set, otherwise the host from `NEXT_PUBLIC_BASE_URL` (default `homiehouse.app`). Set the exact preview hostname when validating a preview deployment.

## Client-side status and rollout gates

The installed `@farcaster/miniapp-sdk` 0.2.2 exposes `quickAuth`, but not the package README's `sdk.protocolAuth.getToken()` method; the published 0.3.0 type declarations were also checked and did not expose `protocolAuth`. The Quick Auth package does export token-message creation/encoding helpers, but a client must still obtain a wallet address linked to the FID and safely request its signature. Do not enable this login button until a supported SDK or a reviewed Mini App wallet-provider flow is available and has been tested with real linked addresses.

The verifier returns:

- `401` for malformed, expired, wrong-domain, invalid-signature, or unlinked-address tokens;
- `503` if Hypersnap cannot be reached or cannot answer the required protocol-state queries.

Live read-only checks against Hypersnap confirmed successful responses from `/v1/fidAddressType`, `/v1/verificationsByFid`, and `/v1/onChainEventsByFid`; a valid FID's verification signer resolved through `/v1/signer`. A generated token signed by an unlinked test address was correctly rejected as unlinked, not as a Hub/API error.

This only proves account identity and creates a HomieHouse session. It does **not** register or authorize an Ed25519 Farcaster signer for casts, likes, recasts, or quotes. Keep the existing signer approval flow for those writes until Hypersnap exposes and supports signer registration.
