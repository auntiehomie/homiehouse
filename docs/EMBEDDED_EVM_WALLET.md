# Embedded EVM wallet implementation plan

**Status:** provider research complete; Coinbase CDP Embedded Wallets is the recommended testnet prototype.
**Research date:** 2026-10-26

## Current HomieHouse state

HomieHouse uses Next.js, Wagmi 3, Viem 2, and RainbowKit. The wallet connector configuration supports external EVM wallets and lists Ethereum, Polygon, Optimism, Arbitrum, and Base. The wallet screen reads HH2 on Base and submits HH2 transfers; its trade link opens Uniswap outside HomieHouse. No embedded-wallet SDK is currently installed.

Hypersnap identity and posting authorization remain separate from EVM asset access. Hypersnap login issues a read-only HomieHouse session after verifying a wallet-signed protocol token. Posting uses a separately generated Ed25519 signer authorized by the FID custody EOA. The current signer implementation does not support smart-contract custody.

## Provider comparison and direction

| Avenue | Fit for HomieHouse | Main tradeoff |
| --- | --- | --- |
| **Coinbase CDP Embedded Wallets** | Custom JWT authentication can bridge a verified HomieHouse session; the CDP Wagmi connector exposes the embedded wallet through the existing Wagmi model. EVM EOAs work across EVM networks, including Base. | Current product documentation marks Embedded Wallets as beta. Confirm production readiness, terms, pricing, and recovery behavior before shipping beyond testnet. |
| **Base Account SDK Sub Accounts** | App-specific embedded accounts, EIP-1193 access, and Wagmi/Viem integration; passkey-oriented and designed around Base. | Requires a Coinbase/Base Account connection. Device changes can trigger signer-owner updates, so account continuity and recovery need testing. More Base-specific than the current multi-chain wallet surface. |

Proceed with a **Base Sepolia-only CDP Embedded Wallets spike**, using HomieHouse custom-JWT auth and the CDP Wagmi connector. This is a technical prototype choice, not a production vendor commitment. Keep RainbowKit and WalletConnect available. Create a regular embedded EOA for this spike; do not silently substitute a smart account or connect this wallet to FID custody.

## Security and account rules

- Mint a short-lived, provider-specific JWT on the server only after verifying an authenticated HomieHouse session. Derive the stable subject from the server-side HomieHouse account identity; never trust a client-supplied FID or wallet address as the binding.
- Do not put Hypersnap protocol tokens, Ed25519 signer credentials, or posting permissions in the wallet JWT. Embedded EVM asset access must not grant Hypersnap posting authority.
- Create a wallet only after the user explicitly selects **Create HomieHouse wallet**. Explain which provider/account backs it and how the user can recover access before confirmation.
- Do not store raw private keys or recovery material on HomieHouse servers. Verify the provider's actual export, recovery, and account-deletion semantics before production.
- Scope each transaction prompt to the selected chain, recipient, asset, and amount. Keep mainnet transfers disabled during the prototype.

## Implementation sequence

1. **CDP spike:** create a separate CDP test app and Base Sepolia configuration. Confirm current SDK versions, custom-JWT issuer/audience requirements, JWT refresh behavior, allowed origins, EOA creation, and whether the Wagmi connector works with the installed Wagmi 3 version.
2. **Auth binding:** add a server-minted, short-lived embedded-wallet JWT whose subject comes from a verified HomieHouse session. Keep auth tokens provider-specific and separate from Hypersnap identity/posting credentials.
3. **Wallet integration:** install and configure the CDP hooks and Wagmi connector at the client boundary. Preserve RainbowKit and WalletConnect as alternate connectors; avoid changing Hypersnap code.
4. **Wallet UI:** support explicit create/reconnect, view/copy/QR address, Base Sepolia ETH and HH2 balances, a small test transfer, and pending/success/failure states with an explorer link.
5. **Testnet validation:** exercise account linking, reload, session expiry, logout, passkey cancel/recovery, device change, rejected transaction, insufficient gas, and provider outage. Verify the same HomieHouse account reconnects to the same wallet.
6. **Production gate:** review beta status, terms, pricing, recovery and deletion guarantees, supported origins, security controls, and account portability before configuring production credentials or enabling mainnet. Continue to require the FID custody EOA for Hypersnap posting approval.

## Acceptance criteria

- An authenticated user can explicitly create or reconnect a persistent embedded EVM wallet without entering a seed phrase in HomieHouse.
- Wallet address and balances survive reload and bind to the same verified HomieHouse account.
- A user can receive assets and send a Base Sepolia test transaction after reviewing and approving its details.
- Transaction rejection never produces a false success state.
- Disconnecting the embedded wallet does not disconnect or replace an external wallet unless the user chooses to switch.
- A read-only HomieHouse session cannot approve Hypersnap posting or authorize server-side payments.
- HomieHouse stores no private key, passkey secret, or recovery material.
- Mainnet transfers remain disabled in the prototype.

## Dependencies and open gates

- CDP test app ID, Base Sepolia configuration, and allowed preview origins.
- Custom-JWT issuer/audience/JWKS and server signing-secret configuration.
- Verify custom JWT lifecycle, CDP account linking, Wagmi 3 compatibility, and address persistence.
- Confirm recovery and device-change behavior across iPhone, iPad, and desktop, including a lost-device scenario.
- Confirm the beta's terms, pricing, security posture, production support, and account portability before rollout.
- Compare the recovery/continuity experience against Base Account SDK Sub Accounts before committing to production.

## Primary references

- [HomieHouse Wagmi config](../src/config/web3.ts)
- [HomieHouse wallet page](../src/app/wallet/page.tsx)
- [Hypersnap wallet signer migration](./HYPERSNAP_WALLET_SIGNER_MIGRATION.md)
- [Hypersnap protocol-token login](./HYPERSNAP_PROTOCOL_AUTH.md)
- [CDP Embedded Wallets auth overview](https://docs.cdp.coinbase.com/embedded-wallets/authentication/auth-methods)
- [CDP custom JWT authentication](https://docs.cdp.coinbase.com/embedded-wallets/authentication/custom-auth)
- [CDP React hooks](https://docs.cdp.coinbase.com/embedded-wallets/react)
- [CDP Wagmi integration](https://docs.cdp.coinbase.com/embedded-wallets/wagmi)
- [Base Account SDK Sub Accounts](https://docs.base.org/base-account/guides/subaccounts)
- [Wagmi connector guide](https://wagmi.sh/react/guides/connect-wallet)
