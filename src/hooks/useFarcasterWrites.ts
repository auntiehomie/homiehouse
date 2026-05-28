'use client';

/**
 * useFarcasterWrites
 *
 * Farcaster write operations using Privy's embedded Farcaster signer +
 * Hypersnap as the write layer (POST /v1/submitMessage to haatz.quilibrium.com).
 *
 * No app FID, no APP_MNEMONIC, no Warpcast approval flow.
 * Privy manages the Ed25519 key; we build + sign protobuf messages locally
 * and submit directly to Hypersnap.
 *
 * Architecture mirrors QuilibriumNetwork/quorum-shared/src/farcaster/.
 */

import { useCallback } from 'react';
import { usePrivy, useFarcasterSigner } from '@privy-io/react-auth';
import {
  buildSignedMessage,
  hexToBytes,
  MessageType,
  ReactionType,
  type FarcasterSigner,
  type CastEmbed,
} from '@/lib/fc-message-builder';

const HYPERSNAP_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_HYPERSNAP_URL) ||
  'https://haatz.quilibrium.com';

async function submitToHypersnap(message: Uint8Array): Promise<unknown> {
  const res = await fetch(`${HYPERSNAP_BASE}/v1/submitMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream', accept: 'application/json' },
    body: message as unknown as BodyInit,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`submitMessage HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return res.json();
}

export interface SubmitCastParams {
  text: string;
  embeds?: { url: string }[];
  channelKey?: string;
  parentUrl?: string;
}

export interface ReactionParams {
  targetCastHash: string;
  targetCastFid: number;
}

export interface ReplyParams {
  text: string;
  parentCastHash: string;
  parentCastFid: number;
  embeds?: { url: string }[];
}

export interface UseFarcasterWritesReturn {
  hasActiveSigner: boolean;
  /** Request Privy to provision a Farcaster signer (opens Privy modal) */
  requestSigner: () => Promise<void>;
  submitCast: (params: SubmitCastParams) => Promise<{ castHash: string }>;
  likeCast: (params: ReactionParams) => Promise<void>;
  unlikeCast: (params: ReactionParams) => Promise<void>;
  recast: (params: ReactionParams) => Promise<void>;
  removeRecast: (params: ReactionParams) => Promise<void>;
  reply: (params: ReplyParams) => Promise<{ castHash: string }>;
  /** @deprecated No longer used — signer approval is handled by Privy */
  signerApprovalUrl: null;
  /** @deprecated No longer needed */
  checkSignerStatus: () => Promise<void>;
}

export function useFarcasterWrites(): UseFarcasterWritesReturn {
  const { user, authenticated } = usePrivy();
  const {
    getFarcasterSignerPublicKey,
    signFarcasterMessage,
    requestFarcasterSignerFromWarpcast,
  } = useFarcasterSigner();

  const farcasterAccount = user?.linkedAccounts?.find(
    (a: any) => a.type === 'farcaster'
  ) as any | undefined;
  const fid: number = farcasterAccount?.fid ?? 0;

  // Privy considers a signer active when the user is authenticated and has a
  // Farcaster account linked.
  const hasActiveSigner = !!(authenticated && fid);

  /** Build a FarcasterSigner from Privy's hook for fc-message-builder */
  const getSigner = useCallback(async (): Promise<FarcasterSigner> => {
    if (!hasActiveSigner) {
      throw Object.assign(new Error('No active Farcaster signer. Sign in first.'), {
        code: 'NO_SIGNER',
      });
    }
    const publicKeyBytes = await getFarcasterSignerPublicKey();
    return {
      publicKey: publicKeyBytes,
      sign: (hash) => signFarcasterMessage(hash),
    };
  }, [hasActiveSigner, getFarcasterSignerPublicKey, signFarcasterMessage]);

  const requestSigner = useCallback(async () => {
    await requestFarcasterSignerFromWarpcast();
  }, [requestFarcasterSignerFromWarpcast]);

  const submitCast = useCallback(async (params: SubmitCastParams): Promise<{ castHash: string }> => {
    const signer = await getSigner();

    const embeds: CastEmbed[] = params.embeds?.map((e) => ({ url: e.url })) ?? [];

    const message = await buildSignedMessage(
      {
        type: MessageType.CAST_ADD,
        fid,
        body: {
          castAddBody: {
            text: params.text,
            embeds: embeds.length ? embeds : undefined,
            parent: params.parentUrl ? { url: params.parentUrl } : undefined,
          },
        },
      },
      signer,
    );

    const result: any = await submitToHypersnap(message);
    const castHash: string =
      result?.hash ?? result?.cast?.hash ?? result?.data?.hash ?? '';
    return { castHash };
  }, [getSigner, fid]);

  const likeCast = useCallback(async (params: ReactionParams): Promise<void> => {
    const signer = await getSigner();
    const targetHashBytes = hexToBytes(params.targetCastHash);
    const message = await buildSignedMessage(
      {
        type: MessageType.REACTION_ADD,
        fid,
        body: {
          reactionBody: {
            type: ReactionType.LIKE,
            target: { castId: { fid: params.targetCastFid, hash: targetHashBytes } },
          },
        },
      },
      signer,
    );
    await submitToHypersnap(message);
  }, [getSigner, fid]);

  const unlikeCast = useCallback(async (params: ReactionParams): Promise<void> => {
    const signer = await getSigner();
    const targetHashBytes = hexToBytes(params.targetCastHash);
    const message = await buildSignedMessage(
      {
        type: MessageType.REACTION_REMOVE,
        fid,
        body: {
          reactionBody: {
            type: ReactionType.LIKE,
            target: { castId: { fid: params.targetCastFid, hash: targetHashBytes } },
          },
        },
      },
      signer,
    );
    await submitToHypersnap(message);
  }, [getSigner, fid]);

  const recast = useCallback(async (params: ReactionParams): Promise<void> => {
    const signer = await getSigner();
    const targetHashBytes = hexToBytes(params.targetCastHash);
    const message = await buildSignedMessage(
      {
        type: MessageType.REACTION_ADD,
        fid,
        body: {
          reactionBody: {
            type: ReactionType.RECAST,
            target: { castId: { fid: params.targetCastFid, hash: targetHashBytes } },
          },
        },
      },
      signer,
    );
    await submitToHypersnap(message);
  }, [getSigner, fid]);

  const removeRecast = useCallback(async (params: ReactionParams): Promise<void> => {
    const signer = await getSigner();
    const targetHashBytes = hexToBytes(params.targetCastHash);
    const message = await buildSignedMessage(
      {
        type: MessageType.REACTION_REMOVE,
        fid,
        body: {
          reactionBody: {
            type: ReactionType.RECAST,
            target: { castId: { fid: params.targetCastFid, hash: targetHashBytes } },
          },
        },
      },
      signer,
    );
    await submitToHypersnap(message);
  }, [getSigner, fid]);

  const reply = useCallback(async (params: ReplyParams): Promise<{ castHash: string }> => {
    const signer = await getSigner();
    const parentHashBytes = hexToBytes(params.parentCastHash);
    const embeds: CastEmbed[] = params.embeds?.map((e) => ({ url: e.url })) ?? [];

    const message = await buildSignedMessage(
      {
        type: MessageType.CAST_ADD,
        fid,
        body: {
          castAddBody: {
            text: params.text,
            embeds: embeds.length ? embeds : undefined,
            parent: { castId: { fid: params.parentCastFid, hash: parentHashBytes } },
          },
        },
      },
      signer,
    );

    const result: any = await submitToHypersnap(message);
    const castHash: string =
      result?.hash ?? result?.cast?.hash ?? result?.data?.hash ?? '';
    return { castHash };
  }, [getSigner, fid]);

  return {
    hasActiveSigner,
    requestSigner,
    submitCast,
    likeCast,
    unlikeCast,
    recast,
    removeRecast,
    reply,
    signerApprovalUrl: null,
    checkSignerStatus: async () => {},
  };
}
