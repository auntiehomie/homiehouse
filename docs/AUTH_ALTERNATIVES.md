# Farcaster authentication alternatives

**Research date:** 2026-08-15. Pricing and vendor capabilities change; verify in the linked documentation before committing to a migration.

## Executive summary

HomieHouse has two different requirements that are easy to conflate:

1. **Authentication:** prove that a user controls a Farcaster account (FIP-11 / SIWF).
2. **Farcaster actions:** sign casts, reactions, and recasts with an app/device signer authorized for that account.

FIP-11 is an authentication protocol, not a replacement for a Farcaster signer. The official Farcaster Auth Kit/Auth Client can handle the first requirement without Privy, but it does not automatically provide a hosted embedded signer for the second. This is the main reason the apparently simplest migration is not a complete Privy replacement.

## Comparison

| Option | FIP-11 / SIWF | Embedded signer for casts/reactions? | Pricing | Next.js 14 complexity | Replace Privy entirely? | Migration from current app |
|---|---|---|---|---|---|---|
| **Keep Privy + harden** | Yes (existing integration) | **Yes** (existing embedded Farcaster signer flow) | Privy plan-dependent; confirm current free/paid limits | Lowest | Yes | **Low**: rotate/recreate app config, update env ID, verify domains and signer state |
| **Farcaster Auth Kit + Auth Client** (`@farcaster/auth-kit`, `@farcaster/auth-client`) | **Yes; official/native SIWF** via QR/deep-link/wallet flows | **No hosted embedded signer**. It authenticates and can establish a connection; writes still need a signer/key-management strategy | Open source packages are free; any relay/hosting and Farcaster infrastructure costs are separate | Medium: client provider, SSR boundaries, nonce/state/callback handling, server verification | **No, not for this app alone** | Medium-high: replace Privy auth/session hooks and separately redesign signer provisioning/storage and action APIs |
| **Dynamic** | Vendor documentation should be checked for the current Farcaster connector/SIWF feature. It has web3 authentication and embedded-wallet support, but do not assume a Farcaster identity login equals a Farcaster app signer | No documented drop-in equivalent to Privy's Farcaster signer API; likely needs Auth Kit plus a separate signer service | Free/developer tier and paid usage tiers have changed over time; confirm current limits | Medium: Dynamic provider/hooks plus wagmi adapter; Farcaster flow and signer remain custom | **Usually no** for this requirement set | Medium-high: wallet/auth state mapping, account linking, all Privy signer APIs replaced |
| **Web3Auth / MetaMask Embedded Wallets** | No first-class FIP-11/SIWF support found in current public product positioning; social/email OAuth is not Farcaster SIWF | **No Farcaster signer**. It supplies an EVM wallet/key provider, which is a different key from a Farcaster app signer | Product has free/developer allowances and paid plans; verify current dashboard pricing | Medium: SDK initialization must be client-only and coordinated with wagmi | No | High if used for Farcaster login; only useful as a wallet replacement |
| **Coinbase Wallet SDK / Smart Wallet** | Wallet connection is not the same as SIWF; no first-class FIP-11 login documented | **No** Farcaster embedded signer. Smart Wallet signs EVM transactions, not Farcaster Hub/Snapchain messages | SDK is generally free; network/gas and optional Coinbase products have separate terms | Low-medium for wallet-only use with wagmi/RainbowKit; no help with Farcaster auth/signer | No | High for full replacement; low if only replacing wallet connector |

### Other “Privy alternatives”

The practical shortlist for **Farcaster embedded signing** is much smaller than the list of web3 login providers. Most providers offer an embedded *EVM* wallet, while Farcaster writes require a Farcaster signer key authorized for the user’s custody account. Confirm this distinction in any sales/demo claim. As of this review, Privy is the clearest integrated option for SIWF plus an embedded Farcaster signer. Farcaster Auth Kit is the strongest provider-independent authentication component, but needs a separate signer design.

## FIP-11 current state and native option

FIP-11 (Sign In With Farcaster) is available as the official Farcaster Auth Kit/Auth Client open-source packages. The packages expose React components/hooks and a TypeScript client for SIWF-style authentication, with QR/deep-link and relay-assisted connection flows depending on configuration. A server should verify the signed message, domain/origin, nonce, and expiration; do not treat a client-supplied FID as authentication.

This is a native Farcaster protocol/client option and does not require Privy. It is **not** a complete account-and-signer custody service. For posting, liking, and recasting, the app still needs an authorized signer key and a safe way to provision, persist, revoke, and use it. A user-controlled wallet can authorize a signer, but that adds an approval step and UX/security work; never silently generate or retain a custody key.

## Recommendation

**Keep the replacement Privy app and harden it first.** This is the lowest-risk path because the current architecture already depends on Privy for all three needed pieces: wallet login, SIWF, and the embedded Farcaster signer. Migrating to Auth Kit would remove the compromised app ID but would leave the hardest requirement—Farcaster write signing—to rebuild and audit.

The compromise of a public Privy app ID is not, by itself, evidence that the embedded signer private material was exposed: app IDs are identifiers and are intended to be present in browser bundles. The incident should nevertheless be treated seriously. Rotate/revoke anything actually secret, inspect logs and user/signer state, and use the new app ID. Domain allowlisting reduces unauthorized origins using the app configuration but cannot make a public identifier secret.

### Hardening checklist

- In the Privy dashboard, allowlist only production and explicitly needed preview domains; remove wildcard/old domains.
- Set the exact allowed origins/redirects for SIWF and wallet flows; review every Vercel preview URL policy.
- Store the new app ID in Vercel environment variables (public client ID may be exposed); never put server secrets in `NEXT_PUBLIC_*`.
- Rotate/revoke server keys, webhook secrets, Supabase/service-role credentials, and any signer-related secrets if they could have been exposed; update Vercel and local environments.
- Audit Privy users, Farcaster FIDs, signer registrations, and recent casts/reactions for unexpected activity; revoke unknown signers.
- Keep server-side authorization checks on every write route. Do not authorize from a wallet address or FID sent only in JSON.
- Enable MFA/RBAC for dashboard access, minimize team access, and monitor provider/Vercel/Sentry logs for unusual origin or auth activity.
- Test production, localhost, and the chosen preview policy after rotation; do not commit IDs or secrets.

## Migration estimate and code changes

### Recommended hardening migration: ~0.5–2 engineering days

1. Create/configure the new Privy app and capture the new client ID.
2. Update Vercel production/preview environment values and local `.env` files; redeploy.
3. Review `src/components/PrivyAuthProvider.tsx` and `src/components/UnifiedAuthProvider.tsx` configuration, especially Farcaster login, embedded-wallet, and signer settings.
4. Re-check auth synchronization in `PrivyAuthSync.tsx` and signer initialization/registration in `SignerInit.tsx`, plus write routes (`api/cast`, `api/like`, `api/privy-*`, signer routes).
5. Re-authorize or migrate existing users’ signers as required by the new Privy app; test existing-user continuity explicitly rather than assuming app deletion preserves it.
6. Run an end-to-end matrix: new SIWF user, returning user, external wallet, embedded wallet, signer add/revoke, cast/reaction/recast, logout/login, bad origin, and unauthorized write.

### If choosing Auth Kit instead: roughly 1–3+ weeks

This is a larger architectural migration: add `@farcaster/auth-kit`/`@farcaster/auth-client`, implement nonce/session verification on the server, replace `usePrivy` and Privy account-linking hooks, preserve the existing wagmi/RainbowKit wallet path, and design a separate signer authorization/key-management service. Estimate the upper end if existing users must be re-linked or if a user-controlled signer approval flow is required. Do not start by removing Privy; build the Auth Kit flow behind a feature flag and prove signer provisioning and revocation first.

## References

- Official Farcaster Auth monorepo (Auth Kit/Auth Client): https://github.com/farcasterxyz/auth-monorepo
- FIP-11 specification: https://github.com/farcasterxyz/protocol/blob/main/docs/SPECIFICATION.md (see Sign In With Farcaster / authentication sections; check current path)
- Privy Farcaster documentation: https://docs.privy.io/guide/react/recipes/farcaster
- Dynamic documentation: https://docs.dynamic.xyz/
- MetaMask Embedded Wallets (formerly Web3Auth): https://docs.metamask.io/embedded-wallets/
- Coinbase Wallet SDK: https://docs.cdp.coinbase.com/wallet-sdk/docs/welcome

Vendor feature/pricing claims are deliberately marked as “verify current” where a public documentation page did not provide a stable, authoritative guarantee. Before migration, obtain written confirmation that a provider supports **Farcaster signer** operations—not merely EVM embedded wallets or SIWF authentication.
