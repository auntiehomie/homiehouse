'use client';

/**
 * Cast, reaction and follow writes are signed locally with a scoped Hypersnap
 * signer and submitted to HomieHouse's Hypersnap relay.
 */

import { useCallback, useEffect, useState } from 'react';
import { castTypeForText } from '@/lib/cast-text';
import { fetchChannelParentUrl } from '@/lib/hypersnap';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { publishOptimisticCast } from '@/lib/optimistic-casts';
import { buildCastGalleryUrl } from '@/lib/cast-gallery';
import { ed25519 } from '@noble/curves/ed25519';
import {
  buildSignedMessage,
  hexToBytes,
  MessageType,
  ReactionType,
  type FarcasterSigner,
  type CastEmbed,
  type CastAddInput,
} from '@/lib/fc-message-builder';

async function submitMessage(message: Uint8Array): Promise<unknown> {
  const res = await fetch('/api/submit-cast', {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: message as unknown as BodyInit,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.details || data?.hub?.error_detail || data?.error || data?.hub?.errMsg || data?.hub?.message || `hub error ${res.status}`;
    throw new Error(detail);
  }
  return data;
}

function isEmbedLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /pro.?user.?feature|(?:too many|maximum|max(?:imum)?|limit|exceed\w*)[^\n]{0,48}embed|embed[^\n]{0,48}(?:limit|maximum|max|pro)/i.test(message);
}

async function publishCastWithGalleryFallback(params: {
  fid: number;
  text: string;
  embeds: CastEmbed[];
  galleryImages?: string[];
  parent?: CastAddInput['parent'];
  signer: FarcasterSigner;
}): Promise<{ result: any; embeds: CastEmbed[]; galleryFallback: boolean }> {
  const castType = castTypeForText(params.text);
  const publish = async (embeds: CastEmbed[]) => {
    const message = await buildSignedMessage(
      { type: MessageType.CAST_ADD, fid: params.fid, body: { castAddBody: {
        text: params.text,
        embeds: embeds.length ? embeds : undefined,
        parent: params.parent,
        type: castType,
      } } },
      params.signer,
    );
    return submitMessage(message);
  };

  try {
    return { result: await publish(params.embeds), embeds: params.embeds, galleryFallback: false };
  } catch (error) {
    const images = params.galleryImages?.slice(0, 4) ?? [];
    if (images.length < 3 || params.embeds.length < 3 || !isEmbedLimitError(error)) throw error;

    const galleryEmbeds: CastEmbed[] = [{ url: buildCastGalleryUrl(images) }];
    return { result: await publish(galleryEmbeds), embeds: galleryEmbeds, galleryFallback: true };
  }
}

export interface CastSubmissionResult {
  castHash: string;
  galleryFallback?: boolean;
}

export interface SubmitCastParams {
  text: string;
  embeds?: { url: string }[];
  /** Photos to preserve in a gallery if the node rejects four individual embeds. */
  galleryImages?: string[];
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
  /** Photos to preserve in a gallery if the node rejects four individual embeds. */
  galleryImages?: string[];
}

export interface UseFarcasterWritesReturn {
  hasActiveSigner: boolean;
  requestSigner: () => Promise<void>;
  submitCast: (params: SubmitCastParams) => Promise<CastSubmissionResult>;
  likeCast: (params: ReactionParams) => Promise<void>;
  unlikeCast: (params: ReactionParams) => Promise<void>;
  recast: (params: ReactionParams) => Promise<void>;
  removeRecast: (params: ReactionParams) => Promise<void>;
  reply: (params: ReplyParams) => Promise<CastSubmissionResult>;
  follow: (targetFid: number) => Promise<void>;
  unfollow: (targetFid: number) => Promise<void>;
  signerApprovalUrl: null;
  checkSignerStatus: () => Promise<void>;
  /** Returns the approved private key hex for this FID, or null if not available */
  getPrivateKeyHex: () => string | null;
}

export function useFarcasterWrites(): UseFarcasterWritesReturn {
  const { fid: rawFid, username, displayName, pfpUrl } = useFarcasterAuth()
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
      throw new Error('Set up a Hypersnap signer to publish from HomieHouse.');
    }

    const data = JSON.parse(raw);
    if (data.status !== 'approved') {
      window.dispatchEvent(new CustomEvent('hh:request:signer', { detail: { fid } }));
      throw new Error('Set up a Hypersnap signer to publish from HomieHouse.');
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

  const submitCast = useCallback(async (params: SubmitCastParams): Promise<CastSubmissionResult> => {
    const signer = await getSigner();
    const embeds: CastEmbed[] = params.embeds?.map((e) => ({ url: e.url })) ?? [];
    const resolvedParentUrl = params.parentUrl || (params.channelKey ? await fetchChannelParentUrl(params.channelKey) : undefined);
    const published = await publishCastWithGalleryFallback({
      fid,
      text: params.text,
      embeds,
      galleryImages: params.galleryImages,
      parent: resolvedParentUrl ? { url: resolvedParentUrl } : undefined,
      signer,
    });
    const result: any = published.result;
    const castHash = result?.hash ?? result?.cast?.hash ?? result?.data?.hash ?? '';
    if (typeof castHash === 'string' && castHash) {
      publishOptimisticCast({
        hash: castHash,
        text: params.text,
        timestamp: Date.now(),
        author: {
          fid,
          username: username || undefined,
          display_name: displayName || undefined,
          pfp_url: pfpUrl || undefined,
        },
        embeds: published.embeds.map((embed) => ({ url: 'url' in embed ? embed.url : '' })),
        channel: params.channelKey ? { id: params.channelKey } : undefined,
        optimistic: true,
      });
    }
    return { castHash, galleryFallback: published.galleryFallback };
  }, [getSigner, fid, username, displayName, pfpUrl]);

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

  const reply = useCallback(async (params: ReplyParams): Promise<CastSubmissionResult> => {
    const signer = await getSigner();
    const embeds: CastEmbed[] = params.embeds?.map((e) => ({ url: e.url })) ?? [];
    const published = await publishCastWithGalleryFallback({
      fid,
      text: params.text,
      embeds,
      galleryImages: params.galleryImages,
      parent: { castId: { fid: params.parentCastFid, hash: hexToBytes(params.parentCastHash) } },
      signer,
    });
    const result: any = published.result;
    const castHash = result?.hash ?? result?.cast?.hash ?? result?.data?.hash ?? '';
    if (typeof castHash === 'string' && castHash) {
      publishOptimisticCast({
        hash: castHash,
        text: params.text,
        timestamp: Date.now(),
        author: {
          fid,
          username: username || undefined,
          display_name: displayName || undefined,
          pfp_url: pfpUrl || undefined,
        },
        embeds: published.embeds.map((embed) => ({ url: 'url' in embed ? embed.url : '' })),
        parent_hash: params.parentCastHash,
        parent_author: { fid: params.parentCastFid },
        optimistic: true,
      });
    }
    return { castHash, galleryFallback: published.galleryFallback };
  }, [getSigner, fid, username, displayName, pfpUrl]);

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
