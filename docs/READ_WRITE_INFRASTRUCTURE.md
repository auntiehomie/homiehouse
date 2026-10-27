# Read/write infrastructure

**Status:** Hypersnap handles Farcaster protocol reads, signer registration, and writes. Private Direct Cast inbox reads are not supported by the current integration.

## Provider map

| Capability | Path | Provider / behavior |
|---|---|---|
| User/channel feeds and channel metadata | `/api/*` routes and query hooks → `src/lib/hypersnap.ts` | Hypersnap read APIs (`/v2/farcaster/...`) |
| Casts, reactions, follows | `useFarcasterWrites` → `/api/submit-cast` | Signed Farcaster protocol messages submitted to Hypersnap `/v1/submitMessage` |
| Signer registration/status | `/api/hypersnap/signer` | Custody-authorized `KEY_ADD`, Hypersnap nonce/status and message relay |
| Existing private conversations | `/messages` and profile Message links | Explicit handoff to Farcaster; no inbox sync or private-message fetch |
| Media/IPFS uploads | `src/lib/pinata.ts` | Pinata IPFS storage only |

## Channels

The channel selector in `CastComposer` loads channels from HomieHouse API routes backed by Hypersnap. The composer includes a canonical Farcaster channel URL such as `https://warpcast.com/~/channel/<id>` in the signed cast's `parent.url`. That value is protocol data identifying the channel; it is not an HTTP request to Warpcast. The resulting message is submitted to Hypersnap.

Keep the canonical channel URL format unless the Farcaster protocol changes it. API requests for channel lists, user channels, channel details, and channel feeds belong on Hypersnap.

## Signers

Current signer enrollment uses the user's FID custody wallet to authorize a scoped, expiring Hypersnap signer. The old `/api/signer` and `/api/register-user-key` Warpcast Signed Key Request endpoints return `410 Gone` and point callers to `/api/hypersnap/signer`. The old `setup-agent-signer` command is retired for the same reason; it no longer contacts Warpcast.

Legacy signer authentication can still verify a cached key, an active Hypersnap signer, or an older active key through the onchain Farcaster Key Registry. The app does not make Warpcast API calls to recover signed-key request status.

## Direct Cast inbox limitation

Direct Casts are private client-service data, not ordinary public casts in the protocol feed. HomieHouse does not currently have a supported Hypersnap inbox read endpoint or verified app authorization contract for private messages. The Messages UI therefore states that limitation and opens the existing Farcaster inbox/composer. Do not guess private endpoints or reuse a public-post signer for DM access.

The share URLs used for opening the inbox and starting a conversation are intentional user-facing handoffs. They are not provider API requests.

See [PRO_ACCESS_AND_MESSAGES.md](./PRO_ACCESS_AND_MESSAGES.md) for the current message product decision and [HYPERSNAP_WALLET_SIGNER_MIGRATION.md](./HYPERSNAP_WALLET_SIGNER_MIGRATION.md) for signer authorization details.
