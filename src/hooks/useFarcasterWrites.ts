'use client';

/**
 * useFarcasterWrites
 *
 * Farcaster write operations using the app-managed signer flow:
 *   1. POST /api/signer  →  server creates Ed25519 keypair, registers with Warpcast
 *   2. User approves via the Warpcast deep-link (opens in new tab)
 *   3. Client polls GET /api/signer?signer_uuid=... until status === 'approved'
 *   4. Writes go to POST /api/privy-compose (server-side hub submission)
 *
 * This replaces the Privy embedded-signer flow which requires On-Device mode
 * (incompatible with TEE mode).
 */

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

export interface FarcasterWriteError extends Error {
  code: string;
}

export interface UseFarcasterWritesReturn {
  /** Whether the user has an active approved Farcaster signer */
  hasActiveSigner: boolean;
  /** Approval URL to open in Warpcast (set after requestSigner succeeds, cleared after approval) */
  signerApprovalUrl: string | null;
  /** Poll signer status manually */
  checkSignerStatus: () => Promise<void>;
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

// localStorage key helpers
function signerKey(fid: number) { return `signer_${fid}`; }

function getStoredSigner(fid: number): { signer_uuid: string; status: string; signer_approval_url?: string } | null {
  if (typeof window === 'undefined' || !fid) return null;
  try {
    const raw = localStorage.getItem(signerKey(fid));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setStoredSigner(fid: number, data: { signer_uuid: string; status: string; signer_approval_url?: string }) {
  if (typeof window === 'undefined' || !fid) return;
  try { localStorage.setItem(signerKey(fid), JSON.stringify(data)); } catch { /* ignore */ }
}

export function useFarcasterWrites(): UseFarcasterWritesReturn {
  const { user, authenticated } = usePrivy();

  const farcasterAccount = user?.linkedAccounts?.find(
    (a: any) => a.type === 'farcaster'
  ) as any | undefined;
  const fid: number = farcasterAccount?.fid ?? 0;

  const [signerUuid, setSignerUuid] = useState<string | null>(null);
  const [signerStatus, setSignerStatus] = useState<string | null>(null);
  const [signerApprovalUrl, setSignerApprovalUrl] = useState<string | null>(null);

  // Hydrate signer state from localStorage on mount / fid change
  useEffect(() => {
    if (!fid) return;
    const stored = getStoredSigner(fid);
    if (stored) {
      setSignerUuid(stored.signer_uuid);
      setSignerStatus(stored.status);
      setSignerApprovalUrl(stored.signer_approval_url ?? null);
    }
  }, [fid]);

  const hasActiveSigner = !!(signerUuid && signerStatus === 'approved' && authenticated && fid);

  /** POST /api/signer — create keypair + Warpcast approval URL */
  const requestSigner = useCallback(async () => {
    if (!authenticated) throw Object.assign(new Error('Not authenticated'), { code: 'NOT_AUTHENTICATED' });
    if (!fid) throw Object.assign(new Error('No Farcaster account linked'), { code: 'NO_FARCASTER_ACCOUNT' });

    const res = await fetch('/api/signer', { method: 'POST' });
    const data = await res.json();

    if (!data.ok || !data.signer_uuid) {
      throw new Error(data.error || 'Failed to create signer');
    }

    const stored = { signer_uuid: data.signer_uuid, status: data.status, signer_approval_url: data.signer_approval_url };
    setSignerUuid(data.signer_uuid);
    setSignerStatus(data.status);
    setSignerApprovalUrl(data.signer_approval_url ?? null);
    setStoredSigner(fid, stored);

    // Open Warpcast approval in new tab
    if (data.signer_approval_url) {
      window.open(data.signer_approval_url, '_blank');
    }
  }, [authenticated, fid]);

  /** GET /api/signer?signer_uuid=... — poll approval status */
  const checkSignerStatus = useCallback(async () => {
    if (!signerUuid || !fid) return;

    const res = await fetch(`/api/signer?signer_uuid=${encodeURIComponent(signerUuid)}`);
    const data = await res.json();

    if (data.ok) {
      const newStatus = data.status;
      setSignerStatus(newStatus);
      const stored = getStoredSigner(fid);
      if (stored) {
        setStoredSigner(fid, { ...stored, status: newStatus });
      }
      if (newStatus === 'approved') setSignerApprovalUrl(null);
    }
  }, [signerUuid, fid]);

  /** Get stored signer uuid for server-side API calls */
  const getSignerUuid = useCallback((): string => {
    if (!hasActiveSigner || !signerUuid) {
      throw Object.assign(new Error('No active signer. Enable posting first.'), { code: 'NO_SIGNER' });
    }
    return signerUuid;
  }, [hasActiveSigner, signerUuid]);

  const submitCast = useCallback(async (params: SubmitCastParams): Promise<{ castHash: string }> => {
    const uuid = getSignerUuid();
    const res = await fetch('/api/privy-compose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: params.text, embeds: params.embeds, channelKey: params.channelKey, parentUrl: params.parentUrl, signerUuid: uuid, fid }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to post cast');
    return { castHash: data.cast?.hash };
  }, [getSignerUuid, fid]);

  const likeCast = useCallback(async (params: ReactionParams): Promise<void> => {
    const uuid = getSignerUuid();
    const res = await fetch('/api/privy-like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetCastHash: params.targetCastHash, targetCastFid: params.targetCastFid, signerUuid: uuid, fid }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to like cast');
  }, [getSignerUuid, fid]);

  const unlikeCast = useCallback(async (params: ReactionParams): Promise<void> => {
    const uuid = getSignerUuid();
    const res = await fetch('/api/privy-like', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetCastHash: params.targetCastHash, targetCastFid: params.targetCastFid, signerUuid: uuid, fid }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to unlike cast');
  }, [getSignerUuid, fid]);

  const recast = useCallback(async (params: ReactionParams): Promise<void> => {
    const uuid = getSignerUuid();
    const res = await fetch('/api/privy-recast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetCastHash: params.targetCastHash, targetCastFid: params.targetCastFid, signerUuid: uuid, fid }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to recast');
  }, [getSignerUuid, fid]);

  const removeRecast = useCallback(async (params: ReactionParams): Promise<void> => {
    const uuid = getSignerUuid();
    const res = await fetch('/api/privy-recast', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetCastHash: params.targetCastHash, targetCastFid: params.targetCastFid, signerUuid: uuid, fid }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to remove recast');
  }, [getSignerUuid, fid]);

  const reply = useCallback(async (params: ReplyParams): Promise<{ castHash: string }> => {
    const uuid = getSignerUuid();
    const res = await fetch('/api/privy-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: params.text, parentCastHash: params.parentCastHash, parentCastFid: params.parentCastFid, embeds: params.embeds, signerUuid: uuid, fid }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to reply');
    return { castHash: data.cast?.hash };
  }, [getSignerUuid, fid]);

  return {
    hasActiveSigner,
    signerApprovalUrl,
    checkSignerStatus,
    requestSigner,
    submitCast,
    likeCast,
    unlikeCast,
    recast,
    removeRecast,
    reply,
  };
}
