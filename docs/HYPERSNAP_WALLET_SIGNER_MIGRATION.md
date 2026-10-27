# Hypersnap wallet sign-in and signer migration

## What this slice changes

- Login discovers FIDs linked to a connected wallet through Hypersnap and exchanges a short-lived, wallet-signed protocol token for a read-only HomieHouse session.
- Posting authorization creates an Ed25519 signer in the browser and asks the FID custody wallet to sign a scoped, expiring Hypersnap `KEY_ADD` authorization. The custody private key and recovery phrase are never requested or sent to HomieHouse.
- The server checks the FID's Optimism custody address, Hypersnap's current per-FID signer nonce, HomieHouse app metadata, the EIP-712 custody signature, and the Ed25519 message signature before relaying the protobuf to `/v1/submitMessage`.
- Only cast add/remove, reaction add/remove, and follow/unfollow message types are authorized. The key uses a 30-day sliding TTL.

## Identity and account creation boundary

HomieHouse does not create a new Hypersnap-native identity in this change. Hypersnap's current `KEY_ADD` protocol requires an existing FID. Legacy FIDs are found through wallet-linked account lookup; enabling writes requires the FID's custody EOA, even when a different linked address was enough to sign in. Smart-contract custody wallets are not supported by the current Snapchain Signers verifier.

New HomieHouse accounts still receive an FID through the existing ID Gateway/Registry flow (the registration transaction is sponsored by HomieHouse). After that transaction returns its hash, the user authorizes the Hypersnap `KEY_ADD` with the custody wallet. The Hypersnap signer path is direct; no legacy KeyRegistry signer is requested as part of onboarding. This is not a Hypersnap-native identity allocation flow—the protocol's current key registration attaches to an existing FID.

## Preview verification

1. Confirm `APP_FID` and `APP_MNEMONIC` resolve to the HomieHouse FID's custody address, and configure `OP_RPC_URL` plus `NEXT_PUBLIC_HYPERSNAP_URL` for Preview.
2. Use a disposable FID whose custody wallet is an EOA. Connect that custody wallet, sign in, then explicitly approve the `Farcaster KeyAdd` EIP-712 message. It should request no transaction and no recovery phrase.
3. Confirm Hypersnap shows the signer as active and its scopes/TTL match the permission summary in the modal.
4. Submit one harmless test cast, verify it appears from the expected FID, and test that an unrelated message type is rejected.
5. Verify key revocation before broad rollout. The current UI slice does not yet expose custody-signed `KEY_REMOVE`; do not treat it as production-complete until the revocation path is implemented and exercised. The 30-day TTL is not a substitute for immediate revocation.

## Known rollout blocker

Hypersnap's source includes `KEY_ADD` and signer nonce lookup, but HomieHouse still needs a Preview test against the deployed node. Do not use a production FID for the first test. A future account-creation flow must continue to use an EOA custody wallet because EIP-1271 support is deferred by the current protocol implementation.
