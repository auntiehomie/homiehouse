# Embedded EVM wallet implementation plan

**Status:** ZeroDev passkey wallet spike implemented for Preview on Base Sepolia; manual dashboard and device testing remains.
**Research date:** 2026-11-11

## Current HomieHouse state

HomieHouse uses Next.js, Wagmi 3, Viem 2, and RainbowKit. The wallet connector configuration supports external EVM wallets and lists Ethereum, Polygon, Optimism, Arbitrum, and Base. The wallet screen reads HH2 on Base and submits HH2 transfers; its trade link opens Uniswap outside HomieHouse. A separate `/wallet/embedded` preview route uses the ZeroDev Wallet SDK on Base Sepolia.

Hypersnap identity and posting authorization remain separate from EVM asset access. Hypersnap login issues a read-only HomieHouse session after verifying a wallet-signed protocol token. Posting uses a separately generated Ed25519 signer authorized by the FID custody EOA. The current signer implementation does not support smart-contract custody.

## Provider comparison

| Path | HomieHouse fit | Main tradeoff |
| --- | --- | --- |
| **MetaMask Embedded Wallets (formerly Web3Auth)** | Custom auth connections can use an existing HomieHouse identity provider. Supports EVM chains including Base, and Ethereum operations can use Wagmi. Its MPC design distributes key shares and provides recovery factors. | Custom auth is a paid production feature. Recovery options include backup-phrase flows, so verify the user experience can meet the no-phrase preference. Account identity and recovery configuration must stay stable to preserve wallet addresses. |
| **ZeroDev Wallet SDK** | Passkey sign-in, session reconnect across reloads, and a Wagmi connector are provided in one React SDK. Base Sepolia is supported. In default `7702` mode, the wallet address is the EOA address with Kernel smart-account execution; `4337` exposes a separate Kernel account address. | Built-in authentication is ZeroDev passkey, email OTP, Google, or magic link; it does not document a direct HomieHouse JWT login path. Use the verified HomieHouse session to gate wallet setup, then bind the passkey wallet to the HomieHouse user by signed challenge. The SDK's embedded-wallet key is TEE-protected; this is not the same as a passkey being the on-chain signer. |
| **ZeroDev Kernel with direct passkey validator** | Makes a WebAuthn passkey the smart account signer and supports guardian recovery. This is a separate, more user-key-centered implementation path. | More custom account plumbing; verify passkey-server needs, recovery UX, and signature gas on Base Sepolia. ZeroDev documents high gas for non-native P256 verification paths. |

## Prototype decision

Build a **small, testnet-only ZeroDev Wallet SDK spike** first, using passkey auth and `7702` mode. This keeps the EOA address shape familiar to HomieHouse while exercising ZeroDev's smart-account transaction path. Do not enable gas sponsorship initially; first verify ordinary Base Sepolia transfers and account reconnection. Keep MetaMask as the comparison path if ZeroDev cannot meet the account-linking or recovery requirements.

Do not assume a ZeroDev passkey is automatically linked to a HomieHouse account. The app must require an authenticated HomieHouse session before wallet creation/linking, verify ownership with a one-time signed challenge, and store the wallet address against the server-side HomieHouse account ID. Never bind by a client-supplied FID or unverified address.

## What Amanda needs to set up

1. Create a ZeroDev dashboard account and a separate test project for HomieHouse.
2. Enable **Base Sepolia** and the **passkey** auth method for that project.
3. Add the exact preview origin being tested and `http://localhost:3000` if local testing will be used. Do not allowlist production until the test flow is approved.
4. Copy the ZeroDev **project ID**. It is a client configuration value; do not send or commit secret API keys.
5. After the Preview branch deploys, allowlist its exact origin in ZeroDev. The project ID belongs in Vercel, not in a chat message or committed file.

Set `NEXT_PUBLIC_ZERODEV_PROJECT_ID=<project-id>` in local `.env.local` and in Vercel Project Settings → Environment Variables for **Preview only**. The `NEXT_PUBLIC_` prefix is required because the browser-side Wagmi configuration reads this value. The project ID is client-visible configuration, not a secret. Do not add it to Production for this spike.

Do not set a ZeroDev AA host variable initially; the Wallet SDK defaults to `https://rpc.zerodev.app`. A separate Base Sepolia chain RPC variable is only needed if the Wagmi transport is configured to read one from the environment. Keep all production origins and credentials out of the spike.

## Implemented preview slice

- `/wallet/embedded` is an isolated Base Sepolia wallet experience; it does not change the mainnet HH2 wallet or existing external wallet connectors.
- Signed-in HomieHouse users can create a ZeroDev wallet with a passkey or log in with a previously registered passkey.
- The route displays the test ETH balance and supports a user-entered native testnet transfer with transaction hash, confirmation, and error states.
- The entry point appears on the HH2 wallet page only when `NEXT_PUBLIC_ZERODEV_PROJECT_ID` is configured in the build environment.
- The wallet is not yet bound to a HomieHouse profile through a server-verified signed challenge. Do not treat it as a production account-linked wallet or use the address for mainnet HH2.
- Manual testing still needs the configured ZeroDev project, an allowlisted Preview origin, a passkey-capable browser/device, and Base Sepolia ETH.

## Implementation sequence

1. **Compatibility check:** confirm installed Wagmi 3, Viem 2, and Next.js versions against the current ZeroDev Wallet SDK peer requirements. Read the installed Next.js documentation before changing application code.
2. **Test environment:** enable Base Sepolia in ZeroDev and add local/preview origins. Configure the Wagmi connector for Base Sepolia with `mode: '7702'`; verify the exact project ID is only exposed to the browser and no secret is.
3. **Passkey and account link:** while signed into HomieHouse, let the user explicitly create a ZeroDev passkey wallet. Sign a short-lived, one-time challenge and verify it server-side before binding that wallet address to the authenticated HomieHouse account. Reject address reuse by another account.
4. **Reconnect and recovery:** verify reload reconnects to the same address; test logout, expired sessions, passkey cancellation, another browser/device, and recovery using the platform passkey manager. Document whether the selected flow needs ZeroDev's export/recovery mechanism.
5. **Wallet actions:** show the address and Base Sepolia ETH balance; send a tiny native test transfer and show pending/confirmed/rejected states plus an explorer link. Then test an ERC-20 call using an existing Base Sepolia test token or a dedicated test contract. Do not use mainnet HH2 for the prototype.
6. **Compare MetaMask:** only if ZeroDev passes the first flow, run the same auth, reconnect, recovery, and transaction checklist with MetaMask Embedded Wallets. Compare identity binding, no-phrase recovery, address stability, Wagmi compatibility, cost, and provider dependencies.
7. **Production gate:** review pricing, key export, recovery and deletion behavior, account portability, origin controls, security, and supported chains. Continue to require the FID custody EOA for Hypersnap posting approval.

## Acceptance criteria

- An authenticated HomieHouse user can explicitly create a passkey wallet without entering a recovery phrase in HomieHouse.
- The wallet address survives reload and is bound to the same verified HomieHouse account.
- Another account cannot bind or control the same wallet address through the HomieHouse linking endpoint.
- A user can receive Base Sepolia ETH and approve a tiny test transaction after reviewing its details.
- Rejected transactions never produce a false success state.
- Disconnecting the embedded wallet does not replace an external wallet unless the user chooses to switch.
- Wallet access does not grant Hypersnap posting authority or server-side payment authority.
- HomieHouse stores no private key, passkey secret, or recovery material.
- Mainnet transfers remain disabled in the prototype.

## Dependencies and open questions

- ZeroDev test project ID, Base Sepolia enabled, and preview/local origins allowlisted.
- Confirm ZeroDev Wallet SDK compatibility with the installed Wagmi 3 / Viem 2 versions; the SDK and its required ZeroDev peer packages are included in the prototype branch.
- Decide how the HomieHouse session gates first-time wallet enrollment while ZeroDev's passkey session handles wallet authentication.
- Verify cross-device passkey recovery on iPhone/iPad and desktop. RP ID must be chosen before registration because changing it can require users to register a new passkey.
- Confirm whether mode `7702` is supported for the enabled Base Sepolia project. If not, evaluate `4337` and document the resulting address difference.
- Test a Base Sepolia ERC-20 contract before claiming HH2 compatibility; the production HH2 address is on Base mainnet.
- Confirm current plan credits, overages, key export, recovery, and service dependency before production.

## Primary references

- [HomieHouse Wagmi config](../src/config/web3.ts)
- [HomieHouse wallet page](../src/app/wallet/page.tsx)
- [Hypersnap wallet signer migration](./HYPERSNAP_WALLET_SIGNER_MIGRATION.md)
- [Hypersnap protocol-token login](./HYPERSNAP_PROTOCOL_AUTH.md)
- [ZeroDev Wallet quickstart](https://docs.zerodev.app/wallets/quickstart)
- [ZeroDev connector options and account modes](https://docs.zerodev.app/wallets/connector-options)
- [ZeroDev passkey authentication](https://docs.zerodev.app/wallets/auth/passkeys)
- [ZeroDev passkey validator guide](https://docs.zerodev.app/onboarding/passkeys/overview)
- [ZeroDev account recovery](https://docs.zerodev.app/advanced/account-recovery/sdk-recovery)
- [ZeroDev supported networks](https://docs.zerodev.app/api-and-toolings/faqs/chains)
- [MetaMask Embedded Wallets custom authentication](https://docs.metamask.io/embedded-wallets/sdk/react/advanced/custom-authentication/)
- [MetaMask Embedded Wallets React and Wagmi integration](https://docs.metamask.io/embedded-wallets/sdk/react/)
- [MetaMask MPC architecture](https://docs.metamask.io/embedded-wallets/infrastructure/mpc-architecture/)
- [Wagmi connector guide](https://wagmi.sh/react/guides/connect-wallet)
