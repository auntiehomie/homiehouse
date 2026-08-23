'use client';

/**
 * useFarcasterWrites — app-mnemonic signer approach.
 *
 * The app registers an Ed25519 keypair on behalf of each user via
 * POST /api/signer (which uses APP_FID + APP_MNEMONIC to sign the Warpcast
 * key-registration request).  SignerInit stores the resulting private_key in
 * localStorage under `signer_<fid>`.  Once the user approves in Warpcast,
 * all write operations sign directly with that key — no third-party TEE dependency.
 */

import { useCallback, useEffect, useState } from 'react';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { ed25519 } from '@noble/curves/ed25519';
import {
  buildSignedMessage,
  hexToBytes,
  MessageType,
  ReactionType,
  CastType,
  type FarcasterSigner,
  type CastEmbed,
} from '@/lib/fc-message-builder';

function channelKeyToParentUrl(channelKey: string): string {
  return `https://warpcast.com/~/channel/${channelKey}`;
}

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
  requestSigner: () => Promise<void>;
  submitCast: (params: SubmitCastParams) => Promise<{ castHash: string }>;
  likeCast: (params: ReactionParams) => Promise<void>;
  unlikeCast: (params: ReactionParams) => Promise<void>;
  recast: (params: ReactionParams) => Promise<void>;
  removeRecast: (params: ReactionParams) => Promise<void>;
  reply: (params: ReplyParams) => Promise<{ castHash: string }>;
  follow: (targetFid: number) => Promise<void>;
  unfollow: (targetFid: number) => Promise<void>;
  signerApprovalUrl: null;
  checkSignerStatus: () => Promise<void>;
  /** Returns the approved private key hex for this FID, or null if not available */
  getPrivateKeyHex: () => string | null;
}

export function useFarcasterWrites(): UseFarcasterWritesReturn {
  const { fid: rawFid, isAuthenticated } = useFarcasterAuth()
  const fid = rawFid ?? 0
  const [hasActiveSigner, setHasActiveSigner] = useState(false)

  const refreshSignerState = useCallback(() => {
    if (!fid) { setHasActiveSigner(false); return; }
    try {
      const raw = localStorage.getItem(`signer_${fid}`);
      if (raw) {
        const data = JSON.parse(raw);
        setHasActiveSigner(data.status === 'approved' && !!data.private_key);
      } else {
        setHasActiveSigner(false);
      }
    } catch { setHasActiveSigner(false); }
  }, [fid]);

  useEffect(() => {
    refreshSignerState();
    window.addEventListener('hh:signer:approved', refreshSignerState);
    return () => window.removeEventListener('hh:signer:approved', refreshSignerState);
  }, [refreshSignerState]);

  const getSigner = useCallback(async (): Promise<FarcasterSigner> => {
    if (!fid) throw new Error('Connect your Farcaster account first.');

    const raw = localStorage.getItem(`signer_${fid}`);
    if (!raw) {
      window.dispatchEvent(new CustomEvent('hh:request:signer', { detail: { fid } }));
      throw new Error('Setting up your signer — please approve in Warpcast when prompted.');
    }

    const data = JSON.parse(raw);
    if (data.status !== 'approved') {
      if (data.signer_approval_url) {
        window.dispatchEvent(new CustomEvent('showWelcomeModal', {
          detail: { approvalUrl: data.signer_approval_url },
        }));
      }
      throw new Error('Please approve your signer in Warpcast to post.');
    }

    if (!data.private_key) throw new Error('Signer key missing. Please sign out and sign in again.');

    const privateKeyBytes = hexToBytes(data.private_key);
    const publicKeyBytes = ed25519.getPublicKey(privateKeyBytes);

    return {
      publicKey: publicKeyBytes,
      sign: async (hash: Uint8Array) => ed25519.sign(hash, privateKeyBytes),
    };
  }, [fid]);

  const requestSigner = useCallback(async () => {
    window.dispatchEvent(new CustomEvent('hh:request:signer', { detail: { fid } }));
  }, [fid]);

  const submitCast = useCallback(async (params: SubmitCastParams): Promise<{ castHash: string }> => {
    const signer = await getSigner();
    const embeds: CastEmbed[] = params.embeds?.map((e) => ({ url: e.url })) ?? [];
    const resolvedParentUrl = params.parentUrl || (params.channelKey ? channelKeyToParentUrl(params.channelKey) : undefined);
    // Use LONG_CAST type for text longer than 320 characters (FIP-8 / Snapchain)
    const castType = params.text.length > 320 ? CastType.LONG_CAST : CastType.CAST;
    const message = await buildSignedMessage(
      { type: MessageType.CAST_ADD, fid, body: { castAddBody: {
        text: params.text,
        embeds: embeds.length ? embeds : undefined,
        parent: resolvedParentUrl ? { url: resolvedParentUrl } : undefined,
        type: castType,
      } } },
      signer,
    );
    const result: any = await submitMessage(message);
    return { castHash: result?.hash ?? result?.cast?.hash ?? result?.data?.hash ?? '' };
  }, [getSigner, fid]);

  const likeCast = useCallback(async (params: ReactionParams): Promise<void> => {
    const signer = await getSigner();
    const message = await buildSignedMessage(
      { type: MessageType.REACTION_ADD, fid, body: { reactionBody: {
        type: ReactionType.LIKE,
        target: { castId: { fid: params.targetCastFid, hash: hexToBytes(params.targetCastHash) } },
      } } },
      signer,
    );
    await submitMessage(message);
  }, [getSigner, fid]);

  const unlikeCast = useCallback(async (params: ReactionParams): Promise<void> => {
    const signer = await getSigner();
    const message = await buildSignedMessage(
      { type: MessageType.REACTION_REMOVE, fid, body: { reactionBody: {
        type: ReactionType.LIKE,
        target: { castId: { fid: params.targetCastFid, hash: hexToBytes(params.targetCastHash) } },
      } } },
      signer,
    );
    await submitMessage(message);
  }, [getSigner, fid]);

  const recast = useCallback(async (params: ReactionParams): Promise<void> => {
    const signer = await getSigner();
    const message = await buildSignedMessage(
      { type: MessageType.REACTION_ADD, fid, body: { reactionBody: {
        type: ReactionType.RECAST,
        target: { castId: { fid: params.targetCastFid, hash: hexToBytes(params.targetCastHash) } },
      } } },
      signer,
    );
    await submitMessage(message);
  }, [getSigner, fid]);

  const removeRecast = useCallback(async (params: ReactionParams): Promise<void> => {
    const signer = await getSigner();
    const message = await buildSignedMessage(
      { type: MessageType.REACTION_REMOVE, fid, body: { reactionBody: {
        type: ReactionType.RECAST,
        target: { castId: { fid: params.targetCastFid, hash: hexToBytes(params.targetCastHash) } },
      } } },
      signer,
    );
    await submitMessage(message);
  }, [getSigner, fid]);

  const reply = useCallback(async (params: ReplyParams): Promise<{ castHash: string }> => {
    const signer = await getSigner();
    const embeds: CastEmbed[] = params.embeds?.map((e) => ({ url: e.url })) ?? [];
    const message = await buildSignedMessage(
      { type: MessageType.CAST_ADD, fid, body: { castAddBody: {
        text: params.text,
        embeds: embeds.length ? embeds : undefined,
        parent: { castId: { fid: params.parentCastFid, hash: hexToBytes(params.parentCastHash) } },
      } } },
      signer,
    );
    const result: any = await submitMessage(message);
    return { castHash: result?.hash ?? result?.cast?.hash ?? result?.data?.hash ?? '' };
  }, [getSigner, fid]);

  const follow = useCallback(async (targetFid: number): Promise<void> => {
    const signer = await getSigner();
    const message = await buildSignedMessage(
      { type: MessageType.LINK_ADD, fid, body: { linkBody: { type: 'follow', targetFid } } },
      signer,
    );
    await submitMessage(message);
  }, [getSigner, fid]);

  const unfollow = useCallback(async (targetFid: number): Promise<void> => {
    const signer = await getSigner();
    const message = await buildSignedMessage(
      { type: MessageType.LINK_REMOVE, fid, body: { linkBody: { type: 'follow', targetFid } } },
      signer,
    );
    await submitMessage(message);
  }, [getSigner, fid]);

  const getPrivateKeyHex = useCallback((): string | null => {
    if (!fid) return null;
    try {
      const raw = localStorage.getItem(`signer_${fid}`);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.status === 'approved' && data.private_key) return data.private_key as string;
    } catch {}
    return null;
  }, [fid]);

  return {
    hasActiveSigner,
    requestSigner,
    submitCast,
    likeCast,
    unlikeCast,
    recast,
    removeRecast,
    reply,
    follow,
    unfollow,
    signerApprovalUrl: null,
    checkSignerStatus: async () => {},
    getPrivateKeyHex,
  };
}
