# Read/Write Infrastructure — Pinata + Neynar

**Status:** Complete (Pinata primary, Neynar for signer lifecycle only)  
**Updated:** 2026-04-12

---

## Architecture

HomieHouse uses a split-provider model:

| Capability | Provider | Notes |
|---|---|---|
| Feed reads | Pinata Farcaster API | `/feed/following`, `/feed/trending` |
| Cast reads | Pinata Farcaster API | `/casts/<hash>` |
| User reads | Pinata Farcaster API | `/users/by_username`, `/user/bulk` |
| Channel reads | Pinata Farcaster API | `/channel/list` |
| Notification reads | Pinata Farcaster API | `/notifications` |
| Cast writes (publish) | Pinata Farcaster API | `POST /casts` |
| Reaction writes (like/recast) | Pinata Farcaster API | `POST /reactions` |
| Signer creation | Neynar | `/signer`, `/signer/signed_key` — no Pinata equivalent |
| Signer verification | Neynar | `GET /signer?signer_uuid=` |

---

## Signer Flow

A **signer** is a Farcaster keypair that authorizes on-chain writes. The flow:

1. User clicks "Enable Posting" in the ComposeModal.
2. Client calls `POST /api/signer` → creates a signer via Neynar's API.
3. Neynar returns a `signer_uuid` and a `signer_approval_url`.
4. User approves the signer in Warpcast (QR code or deep link).
5. `signer_uuid` + status are stored in `localStorage` under key `signer_<fid>`.
6. All write calls (compose, reply, like, recast) include `signer_uuid`.
7. Pinata's write endpoints accept the Neynar-issued `signer_uuid` directly.

> **Why Neynar for signers?** Pinata's Farcaster API does not currently expose
> a signer management endpoint. Neynar handles signer creation and the
> delegation approval flow. This is the only remaining Neynar dependency.

---

## Environment Variables

```env
# Required for all Farcaster reads + writes
PINATA_JWT=your_pinata_jwt_here

# Required ONLY for signer creation/verification
NEYNAR_API_KEY=your_neynar_api_key_here
```

---

## Key Files

| File | Purpose |
|---|---|
| `src/lib/pinata.ts` | All Farcaster API functions (reads + writes) |
| `src/lib/neynar.ts` | Thin re-export shim for backward compat |
| `src/lib/auth.ts` | Signer verification via Neynar |
| `src/app/api/signer/route.ts` | Signer creation endpoint (uses Neynar) |
| `src/app/api/privy-compose/route.ts` | Cast publish (uses Pinata via `publishCast`) |
| `src/app/api/privy-reply/route.ts` | Reply publish |
| `src/app/api/like/route.ts` | Like / unlike |
| `src/app/api/recast/route.ts` | Recast / un-recast |

---

## Quote Casts

Quote casts are normal casts where the `embeds` array contains the URL of
the quoted cast. The canonical URL format is:

```
https://warpcast.com/~/conversations/<cast_hash>
```

The `ComposeModal` and the `FeedList.handleQuoteCast` function both produce
this embed automatically. The server-side `privy-compose` route guards against
duplicate embed insertion.

---

## Future: Privy Integration

Privy (`@privy-io/react-auth`, `@privy-io/server-auth`) is installed but not
yet wired for signer management. Privy's embedded wallet could replace the
Neynar signer flow by:

1. Creating a Farcaster signer keypair client-side via Privy's embedded wallet.
2. Broadcasting the signed delegation to the hub directly.

This would eliminate the last Neynar dependency. See Privy's Farcaster
integration docs for the implementation path.
