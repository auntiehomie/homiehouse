'use client';

/**
 * useFarcasterWrites
 *
 * Farcaster write operations using Privy's embedded Farcaster signer —
 * the Quorum messenger approach (QuilibriumNetwork/quorum-shared).
 *
 * No app FID, no APP_MNEMONIC. Privy manages the Ed25519 key; we build +
 * sign protobuf messages locally, then proxy through /api/submit-cast to
 * avoid browser CORS restrictions on the Farcaster hub.
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

/** Convert a Farcaster channel key to the hub parentUrl format. */
function channelKeyToParentUrl(channelKey: string): string {
  return `https://warpcast.com/~/channel/${channelKey}`;
}

/**
 * Submit a signed protobuf message via the Next.js proxy route.
 * Proxy avoids direct browser→hub CORS restrictions while keeping
 * signing 100% client-side (no private key leaves the browser).
 */
async function submitMessage(message: Uint8Array): Promise<unknown> {
  const res = await fetch('/api/submit-cast', {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: message as unknown as BodyInit,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.error || data?.hub?.errMsg || data?.hub?.message || `hub error ${res.status}`;
    throw new Error(detail);
  }
  return data;
}

export interface SubmitCastParams {
  text: string;
  embeds?: { url: string }[];
  /** Farcaster channel key, e.g. "base" or "replyguys" */
  channelKey?: string;
  /** Full parentUrl (overrides channelKey if both supplied) */
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
  /** Request Privy to provision a Farcaster signer (opens Warpcast approval) */
  requestSigner: () => Promise<void>;
  submitCast: (params: SubmitCastParams) => Promise<{ castHash: string }>;
  likeCast: (params: ReactionParams) => Promise<void>;
  unlikeCast: (params: ReactionParams) => Promise<void>;
  recast: (params: ReactionParams) => Promise<void>;
  removeRecast: (params: ReactionParams) => Promise<void>;
  reply: (params: ReplyParams) => Promise<{ castHash: string }>;
  /** @deprecated No longer used */
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

  const hasActiveSigner = !!(authenticated && fid);

  const getSigner = useCallback(async (): Promise<FarcasterSigner> => {
    if (!authenticated) {
      throw new Error('Sign in to post.');
    }
    if (!fid) {
      throw new Error('Connect your Farcaster account first.');
    }
    let publicKeyBytes: Uint8Array;
    try {
      publicKeyBytes = await getFarcasterSignerPublicKey();
    } catch (err: any) {
      // Signer not yet approved — prompt Warpcast flow
      if (/not.*approved|no.*signer|request.*signer/i.test(err?.message ?? '')) {
        await requestFarcasterSignerFromWarpcast();
        publicKeyBytes = await getFarcasterSignerPublicKey();
      } else {
        throw err;
      }
    }
    return {
      publicKey: publicKeyBytes,
      sign: (hash) => signFarcasterMessage(hash),
    };
  }, [authenticated, fid, getFarcasterSignerPublicKey, signFarcasterMessage, requestFarcasterSignerFromWarpcast]);

  const requestSigner = useCallback(async () => {
    await requestFarcasterSignerFromWarpcast();
  }, [requestFarcasterSignerFromWarpcast]);

  const submitCast = useCallback(async (params: SubmitCastParams): Promise<{ castHash: string }> => {
    const signer = await getSigner();
    const embeds: CastEmbed[] = params.embeds?.map((e) => ({ url: e.url })) ?? [];

    // channelKey → parentUrl (Farcaster channel posts use parentUrl)
    const resolvedParentUrl =
      params.parentUrl || (params.channelKey ? channelKeyToParentUrl(params.channelKey) : undefined);

    const message = await buildSignedMessage(
      {
        type: MessageType.CAST_ADD,
        fid,
        body: {
          castAddBody: {
            text: params.text,
            embeds: embeds.length ? embeds : undefined,
            parent: resolvedParentUrl ? { url: resolvedParentUrl } : undefined,
          },
        },
      },
      signer,
    );

    const result: any = await submitMessage(message);
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
    await submitMessage(message);
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
    await submitMessage(message);
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
    await submitMessage(message);
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
    await submitMessage(message);
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

    const result: any = await submitMessage(message);
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
