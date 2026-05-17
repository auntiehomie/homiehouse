'use client';

import { useCallback } from 'react';
import { usePrivy, useFarcasterSigner } from '@privy-io/react-auth';
import { HubRestAPIClient, ExternalEd25519Signer } from '@standard-crypto/farcaster-js';

const HUB_URL = process.env.NEXT_PUBLIC_FARCASTER_HUB_URL || 'https://nemes.farcaster.xyz:2281';

export interface FarcasterWriteError extends Error {
  code: string;
}

export interface UseFarcasterWritesReturn {
  /** Whether the user has an active Farcaster signer ready to use */
  hasActiveSigner: boolean;
  /** Request user authorize a signer via Warpcast */
  requestSigner: () => Promise<void>;
  /** Submit a new cast */
  submitCast: (params: SubmitCastParams) => Promise<{ castHash: string }>;
  /** Like a cast */
  likeCast: (params: ReactionParams) => Promise<void>;
  /** Unlike a cast */
  unlikeCast: (params: ReactionParams) => Promise<void>;
  /** Recast */
  recast: (params: ReactionParams) => Promise<void>;
  /** Remove recast */
  removeRecast: (params: ReactionParams) => Promise<void>;
  /** Reply to a cast */
  reply: (params: ReplyParams) => Promise<{ castHash: string }>;
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
  const hasActiveSigner = !!(farcasterAccount?.signerPublicKey && authenticated && fid);

  /** Build a Privy-backed ExternalEd25519Signer and hub client */
  const getSigner = useCallback((): {
    client: HubRestAPIClient;
    signer: ExternalEd25519Signer;
  } => {
    if (!authenticated) throw Object.assign(new Error('Not authenticated with Privy'), { code: 'NOT_AUTHENTICATED' });
    if (!fid) throw Object.assign(new Error('No Farcaster account linked. Please log in with Farcaster.'), { code: 'NO_FARCASTER_ACCOUNT' });
    if (!farcasterAccount?.signerPublicKey) throw Object.assign(new Error('No active Farcaster signer. Call requestSigner() first.'), { code: 'NO_SIGNER' });

    const signer = new ExternalEd25519Signer(signFarcasterMessage, getFarcasterSignerPublicKey);
    const client = new HubRestAPIClient({ hubUrl: HUB_URL });
    return { client, signer };
  }, [authenticated, fid, farcasterAccount, signFarcasterMessage, getFarcasterSignerPublicKey]);

  const requestSigner = useCallback(async () => {
    if (!authenticated) throw Object.assign(new Error('Not authenticated'), { code: 'NOT_AUTHENTICATED' });
    await requestFarcasterSignerFromWarpcast();
  }, [authenticated, requestFarcasterSignerFromWarpcast]);

  const submitCast = useCallback(async (params: SubmitCastParams): Promise<{ castHash: string }> => {
    const { client, signer } = getSigner();

    const castParams: any = { text: params.text };
    if (params.embeds?.length) castParams.embeds = params.embeds.map(e => ({ url: e.url }));
    if (params.parentUrl) castParams.parentUrl = params.parentUrl;

    const response = await client.submitCast(castParams, fid, signer);
    return { castHash: response.hash };
  }, [getSigner, fid]);

  const likeCast = useCallback(async (params: ReactionParams): Promise<void> => {
    const { client, signer } = getSigner();
    await client.submitReaction(
      { type: 'like', target: { fid: params.targetCastFid, hash: params.targetCastHash } },
      fid,
      signer
    );
  }, [getSigner, fid]);

  const unlikeCast = useCallback(async (params: ReactionParams): Promise<void> => {
    const { client, signer } = getSigner();
    await client.removeReaction(
      { type: 'like', target: { fid: params.targetCastFid, hash: params.targetCastHash } },
      fid,
      signer
    );
  }, [getSigner, fid]);

  const recast = useCallback(async (params: ReactionParams): Promise<void> => {
    const { client, signer } = getSigner();
    await client.submitReaction(
      { type: 'recast', target: { fid: params.targetCastFid, hash: params.targetCastHash } },
      fid,
      signer
    );
  }, [getSigner, fid]);

  const removeRecast = useCallback(async (params: ReactionParams): Promise<void> => {
    const { client, signer } = getSigner();
    await client.removeReaction(
      { type: 'recast', target: { fid: params.targetCastFid, hash: params.targetCastHash } },
      fid,
      signer
    );
  }, [getSigner, fid]);

  const reply = useCallback(async (params: ReplyParams): Promise<{ castHash: string }> => {
    const { client, signer } = getSigner();
    const response = await client.submitCast(
      {
        text: params.text,
        parentCastId: { fid: params.parentCastFid, hash: params.parentCastHash },
        embeds: params.embeds?.map(e => ({ url: e.url })),
      },
      fid,
      signer
    );
    return { castHash: response.hash };
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
  };
}
