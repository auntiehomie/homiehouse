# Hypersnap protocol-token login

**Status (2026-10-17):** Wallet token acquisition and server-side session exchange are implemented. Amanda confirms posting works through the separate Hypersnap signer flow. The earlier server-only rollout status below was outdated; this does not establish that every wallet/provider combination has been tested.

HomieHouse now supports an additional `POST /api/auth/session` proof:

```json
{ "protocolToken": "hqa1.<message>.<signature>" }
```

The server verifies the short-lived, domain-bound wallet signature and its FID/address relationship against Hypersnap using `@farcasterorg/quick-auth`. It derives the session FID from that verified token; a body-supplied FID is never trusted. On success it issues a **read-only** HomieHouse session. Existing approved-signer login remains available during rollout and retains its current scopes.

This integration explicitly disables classic Quick Auth JWTs (`acceptQuickAuthJwt: false`), so it does not fall back to `auth.farcaster.xyz`. The Hub base URL is `NEXT_PUBLIC_HYPERSNAP_URL`, defaulting to `https://haatz.quilibrium.com`. Token audience/domain validation uses `HOMIEHOUSE_AUTH_DOMAIN` when set, otherwise the host from `NEXT_PUBLIC_BASE_URL` (default `homiehouse.app`). Set the exact preview hostname when validating a preview deployment.

## Client-side status and rollout gates

`FarcasterLogin` now uses the connected Wagmi wallet, Quick Auth token-message creation/encoding helpers, and `useSessionAuth.createSessionFromProtocolToken`. The server verifies the signed token before creating a read-only session. This flow does not depend on an unavailable `sdk.protocolAuth.getToken()` method. Validate supported wallets on physical devices when changing this integration.

The verifier returns:

- `401` for malformed, expired, wrong-domain, invalid-signature, or unlinked-address tokens;
- `503` if Hypersnap cannot be reached or cannot answer the required protocol-state queries.

Live read-only checks against Hypersnap confirmed successful responses from `/v1/fidAddressType`, `/v1/verificationsByFid`, and `/v1/onChainEventsByFid`; a valid FID's verification signer resolved through `/v1/signer`. A generated token signed by an unlinked test address was correctly rejected as unlinked, not as a Hub/API error.

This only proves account identity and creates a HomieHouse session. It does **not** register or authorize an Ed25519 Farcaster signer for casts, likes, recasts, or quotes. The implemented `/api/hypersnap/signer` flow separately authorizes a browser-generated key using custody-wallet approval and submits a Hypersnap `KEY_ADD` message.

## Pro billing and Hypersnap signers

Posting signs messages in the browser and submits them to the node. Pro checkout and the customer portal use HomieHouse server authentication. A Hypersnap offchain signer is absent from the legacy Warpcast approval cache and Optimism Key Registry, so checking only those sources incorrectly rejects users who can post.

On a legacy-cache miss, server authentication now checks `/v1/signer?fid=...&signer=...` on the configured Hypersnap node. It sends only the derived public key, verifies the exact returned FID/key, Ed25519 key type and source, and rejects expired/malformed records. Offchain approvals are not written to the permanent legacy cache. Node failures do not grant access; the existing legacy recovery remains available.

Payment buttons request `write:shop` credentials. A read-only wallet session no longer masks an available approved signer; a shop-capable session is still preferred. The server independently verifies every credential and derives the billing FID. Stripe price, webhook verification and subscription activation are unchanged. Auth failures return 401/403 rather than 500.

Regression checks cover actual checkout/portal route handlers with real signer authentication and mocked node/Stripe responses. They do not constitute a live payment or webhook test.
