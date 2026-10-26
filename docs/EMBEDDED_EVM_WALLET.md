# Embedded EVM wallet implementation plan

**Status:** discovery complete; Base Sepolia prototype is the next implementation step.
**Research date:** 2026-10-26

## Current HomieHouse state

HomieHouse uses Next.js, Wagmi 3, Viem 2, and RainbowKit. The wallet connector configuration supports external EVM wallets and lists Ethereum, Polygon, Optimism, Arbitrum, and Base. The wallet screen reads HH2 on Base and submits HH2 transfers; its trade link opens Uniswap outside HomieHouse. No embedded-wallet SDK is currently installed.

Hypersnap identity and posting authorization remain separate from EVM asset access. Hypersnap login issues a read-only HomieHouse session after verifying a wallet-signed protocol token. Posting uses a separately generated Ed25519 signer authorized by the FID custody EOA. The current signer implementation does not support smart-contract custody.

## Prototype direction

Use an embedded EOA for HomieHouse EVM actions, starting on Base Sepolia. Keep RainbowKit, external wallets, and WalletConnect QR available. Do not treat the embedded wallet as the FID custody wallet or Hypersnap posting signer.

Privy is the leading prototype candidate because its current documentation describes JWT-based integration with an existing auth provider and Wagmi support for embedded and external wallets. Privy also documents a passkey-owned wallet configuration. This is a technical fit, not a production vendor commitment; verify pricing, recovery behavior, and dashboard configuration before production.

- Existing HomieHouse auth can remain the account entry point if a short-lived, provider-specific JWT is issued only after verifying the HomieHouse session.
- Use a stable HomieHouse account subject. Never trust a user-supplied FID or wallet address as the account binding.
- Generate/create a wallet only after the user explicitly selects **Create HomieHouse wallet**.
- Configure passkey authorization and a documented recovery method that avoids requiring a recovery phrase in the app UI.
- Keep wallet signing in the provider/user-controlled path. Never store raw user private keys or recovery material on HomieHouse servers.
- Keep transaction prompts explicit and scoped to the selected chain, recipient, asset, and amount.

## Implementation sequence

1. **Provider spike:** configure a separate Privy test app and Base Sepolia. Confirm the supported current SDK versions, passkey creation/recovery behavior, allowed domains, and JWT requirements.
2. **Session binding:** add a server-minted, short-lived embedded-wallet auth token that derives its subject from a verified HomieHouse session. Keep Hypersnap protocol tokens and posting signer credentials out of the wallet-provider auth payload.
3. **Wallet provider integration:** add the provider at the client boundary and connect its embedded wallet to the existing Wagmi account/transaction hooks. Preserve RainbowKit and WalletConnect as alternate connectors.
4. **Wallet UI:** let the user create or reconnect their embedded wallet, view/copy/QR their address, see Base ETH and HH2 balances, send a small test transfer, and see pending/success/failure transaction states with an explorer link.
5. **Testnet validation:** test first-time creation, existing login linking, logout/session expiry, passkey cancellation and recovery, transaction rejection, insufficient gas, and provider outage. Verify the same account reconnects to the same address.
6. **Production gate:** configure production app ID/origins and server JWT verification only after testnet, recovery, and security review pass. Continue to require the FID custody EOA for Hypersnap posting approval.

## Acceptance criteria

- An authenticated user can explicitly create or reconnect a persistent embedded EVM wallet without entering a seed phrase.
- Wallet address and balances survive reload and are bound to the same verified HomieHouse account.
- A user can receive assets and send a Base Sepolia test transaction after reviewing and approving its details.
- Rejecting a transaction leaves no pending false success state.
- Disconnecting the embedded wallet does not disconnect or replace an external wallet unless the user chooses to switch.
- Read-only HomieHouse sessions cannot approve Hypersnap posting or authorize server-side payments.
- No private key, passkey secret, or recovery material is stored by HomieHouse.
- Mainnet transfers remain disabled in the prototype.

## Dependencies and open gates

- Privy test app ID and allowed preview origins.
- Provider JWT issuer/audience/JWKS configuration and a separate server signing secret.
- Confirm whether HomieHouse's current session subject can be mapped to provider JWT auth without widening session scope.
- Confirm passkey recovery across iPhone/iPad/desktop browsers, including a lost-device scenario.
- Confirm vendor costs and terms before any production rollout.

## Primary references

- [HomieHouse Wagmi config](../src/config/web3.ts)
- [HomieHouse wallet page](../src/app/wallet/page.tsx)
- [Hypersnap wallet signer migration](./HYPERSNAP_WALLET_SIGNER_MIGRATION.md)
- [Hypersnap protocol-token login](./HYPERSNAP_PROTOCOL_AUTH.md)
- [Privy JWT auth integration](https://docs.privy.io/authentication/user-authentication/jwt-based-auth/usage)
- [Privy Wagmi integration](https://docs.privy.io/wallets/connectors/ethereum/integrations/wagmi)
- [Privy wallet policies and controls](https://docs.privy.io/security/wallet-infrastructure/policy-and-controls)
- [Wagmi connector guide](https://wagmi.sh/react/guides/connect-wallet)
