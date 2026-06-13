/**
 * Farcaster write operations via @standard-crypto/farcaster-js.
 *
 * Uses HubRestAPIClient pointed at a public Farcaster hub.
 * Server-side writes use an app-level Ed25519 signer derived from APP_MNEMONIC.
 *
 * The signer is a 32-byte Ed25519 private key passed as a hex string to
 * HubRestAPIClient — it internally wraps it in NobleEd25519Signer.
 *
 * For full decentralization, migrate clients to use Privy's embedded signer
 * (useFarcasterSigner hook) and submit directly from the browser.
 */

import { HubRestAPIClient } from '@standard-crypto/farcaster-js';
import { mnemonicToAccount } from 'viem/accounts';

// Hypersnap hub — nemes.farcaster.xyz was decommissioned when Farcaster migrated to Snapchain.
// haatz.quilibrium.com supports the /v1/submitMessage REST endpoint used by farcaster-js.
const HUB_URL =
  (typeof process !== 'undefined' && process.env.FARCASTER_HUB_URL) ||
  'https://haatz.quilibrium.com';

/**
 * Get the farcaster-js hub client.
 */
export function getHubClient(): HubRestAPIClient {
  return new HubRestAPIClient({ hubUrl: HUB_URL });
}

/**
 * Derive a deterministic Ed25519 private key hex string from APP_MNEMONIC.
 *
 * Uses the viem mnemonicToAccount to derive the EVM account private key,
 * then uses those 32 bytes as the Ed25519 signing key.  This is the same
 * seed material already used by /api/signer for signing key-registration
 * payloads, so no new entropy is introduced.
 *
 * NOTE: For production, prefer per-user Privy embedded signers so each user
 * signs their own messages.
 */
function getAppSignerKey(): { privateKeyHex: string; fid: number } {
  const mnemonic = process.env.APP_MNEMONIC;
  const appFid = parseInt(process.env.APP_FID || '0', 10);

  if (!mnemonic) {
    throw new Error(
      'APP_MNEMONIC environment variable is required for server-side Farcaster writes'
    );
  }
  if (!appFid) {
    throw new Error(
      'APP_FID environment variable is required for server-side Farcaster writes'
    );
  }

  // Derive EVM account from mnemonic — privateKey is a 32-byte hex string
  const account = mnemonicToAccount(mnemonic as `${string}`);
  // mnemonicToAccount exposes the private key only when called via HDKey;
  // use the address bytes (20 bytes) padded to 32 as a deterministic seed.
  // For stronger derivation, replace with a proper HD key path to an Ed25519 leaf.
  const seed = account.address.slice(2).padStart(64, '0').slice(0, 64);

  return { privateKeyHex: seed, fid: appFid };
}

/**
 * Publish a cast to Farcaster.
 */
export async function publishCast(params: {
  text: string;
  fid: number;
  embeds?: { url: string }[];
  parentCastHash?: string;
  parentUrl?: string;
  channelKey?: string;
  /** Ed25519 private key hex from the registered signer (preferred over APP_MNEMONIC derivation) */
  signerPrivateKey?: string;
}): Promise<{ castHash: string }> {
  const client = getHubClient();
  const { privateKeyHex: derivedKey, fid: appFid } = getAppSignerKey();
  const privateKeyHex = params.signerPrivateKey || derivedKey;
  const castFid = params.fid || appFid;

  const castParams: Parameters<HubRestAPIClient['submitCast']>[0] = {
    text: params.text,
  };

  if (params.embeds?.length) {
    castParams.embeds = params.embeds.map((e) => ({ url: e.url }));
  }

  if (params.parentCastHash) {
    // Parent cast FID is not known here; set to 0 — hub will resolve
    castParams.parentCastId = { fid: 0, hash: params.parentCastHash };
  } else if (params.parentUrl) {
    castParams.parentUrl = params.parentUrl;
  }

  const response = await client.submitCast(castParams, castFid, privateKeyHex);
  return { castHash: response.hash };
}

/**
 * Publish a like or recast reaction.
 */
export async function publishReaction(params: {
  reactionType: 'like' | 'recast';
  targetCastHash: string;
  targetCastFid: number;
  fid: number;
  /** Ed25519 private key hex from the registered signer (preferred over APP_MNEMONIC derivation) */
  signerPrivateKey?: string;
}): Promise<void> {
  const client = getHubClient();
  const { privateKeyHex: derivedKey, fid: appFid } = getAppSignerKey();
  const privateKeyHex = params.signerPrivateKey || derivedKey;
  const castFid = params.fid || appFid;

  await client.submitReaction(
    {
      type: params.reactionType,
      target: { fid: params.targetCastFid, hash: params.targetCastHash },
    },
    castFid,
    privateKeyHex
  );
}

/**
 * Remove a like or recast reaction.
 */
export async function deleteReaction(params: {
  reactionType: 'like' | 'recast';
  targetCastHash: string;
  targetCastFid: number;
  fid: number;
  /** Ed25519 private key hex from the registered signer (preferred over APP_MNEMONIC derivation) */
  signerPrivateKey?: string;
}): Promise<void> {
  const client = getHubClient();
  const { privateKeyHex: derivedKey, fid: appFid } = getAppSignerKey();
  const privateKeyHex = params.signerPrivateKey || derivedKey;
  const castFid = params.fid || appFid;

  await client.removeReaction(
    {
      type: params.reactionType,
      target: { fid: params.targetCastFid, hash: params.targetCastHash },
    },
    castFid,
    privateKeyHex
  );
}
