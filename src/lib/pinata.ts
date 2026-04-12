/**
 * Piñata — combined IPFS storage + Farcaster API connector.
 *
 * Farcaster functions at the bottom of this file power all social
 * reads/writes (feed, casts, reactions, notifications, users, channels).
 * The IPFS storage class (PinataService) remains unchanged.
 */

import pinataSDK from '@pinata/sdk';
import { pinataConfig } from '@/config/web3';
import { Web3Error } from '@/config/web3';

// ─── Farcaster API ──────────────────────────────────────────────────────────

const PINATA_FARCASTER_BASE = 'https://api.pinata.cloud/v3/farcaster';

export interface PinataFetchOptions extends RequestInit {
  method?: string;
  body?: BodyInit;
}

function getPinataJwt(): string {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error('PINATA_JWT environment variable is not set');
  return jwt;
}

/**
 * Generic authenticated fetch to the Pinata Farcaster API.
 */
export async function pinataFetch(endpoint: string, opts: PinataFetchOptions = {}): Promise<any> {
  const jwt = getPinataJwt();
  const url = `${PINATA_FARCASTER_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'accept': 'application/json',
      'Authorization': `Bearer ${jwt}`,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Pinata Farcaster API error ${res.status}: ${text}`);
  }
  return res.json();
}

/** Re-exported as neynarFetch for backward compat */
export const neynarFetch = pinataFetch;

/**
 * Publish a cast (or reply / quote cast) via Pinata Farcaster API.
 * Payload shape: { signer_uuid, text, embeds?, parent?, channel_id?,
 *                  parent_cast_id?: { hash, fid } }
 */
export async function publishCast(payload: {
  signer_uuid: string;
  text: string;
  embeds?: { url: string }[];
  parent?: string;
  channel_id?: string;
  parent_cast_id?: { hash: string; fid: number };
}): Promise<any> {
  return pinataFetch('/casts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Publish a reaction (like or recast). */
export async function publishReaction(payload: {
  signer_uuid: string;
  reaction_type: 'like' | 'recast';
  target: string;
  target_author_fid?: number;
}): Promise<any> {
  return pinataFetch('/reactions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Delete a reaction. */
export async function deleteReaction(payload: {
  signer_uuid: string;
  reaction_type: 'like' | 'recast';
  target: string;
  target_author_fid?: number;
}): Promise<any> {
  return pinataFetch('/reactions', {
    method: 'DELETE',
    body: JSON.stringify(payload),
  });
}

/** Fetch a cast by hash. */
export async function fetchCast(hash: string): Promise<any> {
  return pinataFetch(`/casts/${encodeURIComponent(hash)}`);
}

/** Fetch the home / following / trending feed. */
export async function fetchFeed(params: Record<string, any> = {}): Promise<any> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  }
  // Pinata: GET /feed/following?fid=... or /feed/trending
  const feedType = params.feed_type || 'following';
  const endpoint = feedType === 'filter' && params.filter_type === 'global_trending'
    ? '/feed/trending'
    : '/feed/following';
  return pinataFetch(`${endpoint}?${qs.toString()}`);
}

/** Fetch trending feed. */
export async function fetchTrendingFeed(params: Record<string, any> = {}): Promise<any> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  }
  return pinataFetch(`/feed/trending?${qs.toString()}`);
}

/** Fetch a user by username. */
export async function fetchUserByUsername(username: string): Promise<any> {
  const data = await pinataFetch(`/users/by_username?username=${encodeURIComponent(username)}`);
  // Normalize: Pinata returns { data: { user } } or { user }
  const user = data?.data?.user ?? data?.user ?? data?.data ?? data;
  return { user };
}

/** Fetch user's channels. */
export async function fetchUserChannels(fid: number, limit = 50): Promise<any> {
  return pinataFetch(`/channel/list?limit=${limit}`);
}

/** Fetch full channel list. */
export async function fetchChannelList(limit = 50): Promise<any> {
  return pinataFetch(`/channel/list?limit=${limit}`);
}

/** Fetch following feed for a FID. */
export async function fetchFollowing(fid: number, limit = 100): Promise<any> {
  return pinataFetch(`/feed/following?fid=${fid}&limit=${limit}`);
}

/** Fetch notifications for a FID. */
export async function fetchNotifications(params: { fid: number; limit?: number; cursor?: string }): Promise<any> {
  const { fid, limit = 25, cursor } = params;
  const qs = new URLSearchParams({ fid: String(fid), limit: String(limit) });
  if (cursor) qs.set('cursor', cursor);
  return pinataFetch(`/notifications?${qs.toString()}`);
}

/** Search users by query (best-effort via username prefix). */
export async function searchUsers(query: string, limit = 10): Promise<any> {
  const data = await pinataFetch(`/users/by_username?username=${encodeURIComponent(query)}`);
  const user = data?.data?.user ?? data?.user ?? data?.data;
  return { users: user ? [user] : [] };
}

/** Search casts — not supported by Pinata; returns empty stub. */
export async function searchCasts(_query: string): Promise<any> {
  return { casts: [] };
}

/** Fetch casts by username. */
export async function getCastsByUsername(username: string, limit = 25): Promise<any> {
  const userData = await fetchUserByUsername(username);
  const fid = userData?.user?.fid;
  if (!fid) return { casts: [] };
  return pinataFetch(`/casts?fid=${fid}&limit=${limit}`);
}

// File upload options interface
export interface UploadOptions {
  pinataMetadata?: {
    name?: string;
    keyvalues?: Record<string, string | number>;
  };
  pinataOptions?: {
    cidVersion?: number;
    wrapWithDirectory?: boolean;
  };
}

// Upload result interface
export interface UploadResult {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
  isDuplicate?: boolean;
  gatewayUrl: string;
}

// Metadata service interface
export interface MetadataService {
  name: string;
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

class PinataService {
  private client: any;
  private isConfigured: boolean;

  constructor() {
    this.isConfigured = false;
    
    if (pinataConfig.jwt) {
      try {
        this.client = new pinataSDK({ pinataJWTKey: pinataConfig.jwt });
        this.isConfigured = true;
      } catch (error) {
        console.warn('Failed to initialize Piñata client:', error);
      }
    } else {
      console.warn('Piñata JWT not configured. IPFS uploads will be disabled.');
    }
  }

  /**
   * Upload a file to IPFS via Piñata
   */
  async uploadFile(
    file: File | Buffer | ArrayBuffer,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    if (!this.isConfigured) {
      throw new Web3Error(
        'Piñata is not configured. Please set PINATA_JWT environment variable.',
        'PINATA_NOT_CONFIGURED'
      );
    }

    try {
      console.log('[PinataService] Uploading file...', {
        type: file instanceof File ? 'File' : 'Buffer',
        name: file instanceof File ? file.name : 'buffer',
        size: file instanceof File ? file.size : file.byteLength,
      });

      let uploadResult;
      
      if (file instanceof File) {
        const readableStream = file.stream();
        uploadResult = await this.client.pinFileToIPFS(readableStream, {
          pinataMetadata: {
            name: options.pinataMetadata?.name || file.name,
            keyvalues: {
              originalName: file.name,
              fileType: file.type,
              uploadSource: 'homiehouse-web',
              uploadedAt: new Date().toISOString(),
              ...options.pinataMetadata?.keyvalues,
            },
          },
          pinataOptions: options.pinataOptions || {
            cidVersion: 1,
            wrapWithDirectory: false,
          },
        });
      } else {
        // Handle Buffer or ArrayBuffer
        const buffer = Buffer.from(file);
        uploadResult = await this.client.pinFileToIPFS(buffer, {
          pinataMetadata: {
            name: options.pinataMetadata?.name || 'upload.bin',
            keyvalues: {
              uploadSource: 'homiehouse-web',
              uploadedAt: new Date().toISOString(),
              ...options.pinataMetadata?.keyvalues,
            },
          },
          pinataOptions: options.pinataOptions || {
            cidVersion: 1,
            wrapWithDirectory: false,
          },
        });
      }

      const result: UploadResult = {
        ...uploadResult,
        gatewayUrl: `${pinataConfig.gateway}/ipfs/${uploadResult.IpfsHash}`,
      };

      console.log('[PinataService] File uploaded successfully', {
        ipfsHash: result.IpfsHash,
        gatewayUrl: result.gatewayUrl,
        size: result.PinSize,
      });

      return result;
    } catch (error) {
      console.error('[PinataService] File upload failed:', error);
      throw new Web3Error(
        'Failed to upload file to IPFS',
        'IPFS_UPLOAD_FAILED',
        error
      );
    }
  }

  /**
   * Upload JSON metadata to IPFS
   */
  async uploadMetadata(
    metadata: MetadataService,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    if (!this.isConfigured) {
      throw new Web3Error(
        'Piñata is not configured. Please set PINATA_JWT environment variable.',
        'PINATA_NOT_CONFIGURED'
      );
    }

    try {
      console.log('[PinataService] Uploading metadata...', {
        name: metadata.name,
        hasImage: !!metadata.image,
        hasAttributes: !!metadata.attributes?.length,
      });

      const metadataString = JSON.stringify(metadata, null, 2);
      const buffer = Buffer.from(metadataString);

      const uploadResult = await this.client.pinFileToIPFS(buffer, {
        pinataMetadata: {
          name: `${metadata.name} - Metadata`,
          keyvalues: {
            type: 'metadata',
            uploadSource: 'homiehouse-web',
            uploadedAt: new Date().toISOString(),
            ...options.pinataMetadata?.keyvalues,
          },
        },
        pinataOptions: options.pinataOptions || {
          cidVersion: 1,
          wrapWithDirectory: false,
        },
      });

      const result: UploadResult = {
        ...uploadResult,
        gatewayUrl: `${pinataConfig.gateway}/ipfs/${uploadResult.IpfsHash}`,
      };

      console.log('[PinataService] Metadata uploaded successfully', {
        ipfsHash: result.IpfsHash,
        gatewayUrl: result.gatewayUrl,
      });

      return result;
    } catch (error) {
      console.error('[PinataService] Metadata upload failed:', error);
      throw new Web3Error(
        'Failed to upload metadata to IPFS',
        'IPFS_METADATA_UPLOAD_FAILED',
        error
      );
    }
  }

  /**
   * Pin existing content by hash
   */
  async pinByHash(hash: string, options: UploadOptions = {}): Promise<UploadResult> {
    if (!this.isConfigured) {
      throw new Web3Error(
        'Piñata is not configured. Please set PINATA_JWT environment variable.',
        'PINATA_NOT_CONFIGURED'
      );
    }

    try {
      console.log('[PinataService] Pinning by hash...', { hash });

      const pinResult = await this.client.pinByHash(hash, {
        pinataMetadata: {
          name: options.pinataMetadata?.name || `Pinned - ${hash}`,
          keyvalues: {
            pinSource: 'homiehouse-web',
            pinnedAt: new Date().toISOString(),
            ...options.pinataMetadata?.keyvalues,
          },
        },
      });

      const result: UploadResult = {
        ...pinResult,
        gatewayUrl: `${pinataConfig.gateway}/ipfs/${hash}`,
      };

      console.log('[PinataService] Hash pinned successfully', {
        ipfsHash: result.IpfsHash,
        gatewayUrl: result.gatewayUrl,
      });

      return result;
    } catch (error) {
      console.error('[PinataService] Hash pinning failed:', error);
      throw new Web3Error(
        'Failed to pin content by hash',
        'IPFS_PIN_BY_HASH_FAILED',
        error
      );
    }
  }

  /**
   * Get pinned content information
   */
  async getPinnedContent(hash: string) {
    if (!this.isConfigured) {
      throw new Web3Error(
        'Piñata is not configured. Please set PINATA_JWT environment variable.',
        'PINATA_NOT_CONFIGURED'
      );
    }

    try {
      console.log('[PinataService] Getting pinned content...', { hash });

      const result = await this.client.pinList({
        hashContains: hash,
        status: 'pinned',
      });

      return result;
    } catch (error) {
      console.error('[PinataService] Failed to get pinned content:', error);
      throw new Web3Error(
        'Failed to get pinned content',
        'IPFS_GET_PINNED_FAILED',
        error
      );
    }
  }

  /**
   * Unpin content
   */
  async unpin(hash: string): Promise<void> {
    if (!this.isConfigured) {
      throw new Web3Error(
        'Piñata is not configured. Please set PINATA_JWT environment variable.',
        'PINATA_NOT_CONFIGURED'
      );
    }

    try {
      console.log('[PinataService] Unpinning content...', { hash });

      await this.client.unpin(hash);

      console.log('[PinataService] Content unpinned successfully', { hash });
    } catch (error) {
      console.error('[PinataService] Unpin failed:', error);
      throw new Web3Error(
        'Failed to unpin content',
        'IPFS_UNPIN_FAILED',
        error
      );
    }
  }

  /**
   * Generate IPFS gateway URL
   */
  getGatewayUrl(ipfsHash: string): string {
    return `${pinataConfig.gateway}/ipfs/${ipfsHash}`;
  }

  /**
   * Test Piñata connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      console.log('[PinataService] Testing connection...');
      
      const result = await this.client.testAuthentication();
      const isValid = result.authenticated === true;
      
      console.log('[PinataService] Connection test result:', isValid);
      return isValid;
    } catch (error) {
      console.error('[PinataService] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Create metadata for NFTs or social content
   */
  createContentMetadata(params: {
    name: string;
    description: string;
    image: string;
    externalUrl?: string;
    content?: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
  }): MetadataService {
    return {
      name: params.name,
      description: params.description,
      image: params.image.startsWith('ipfs://') 
        ? this.getGatewayUrl(params.image.replace('ipfs://', ''))
        : params.image,
      external_url: params.externalUrl,
      attributes: [
        ...(params.attributes || []),
        {
          trait_type: 'Created At',
          value: new Date().toISOString(),
        },
        {
          trait_type: 'Platform',
          value: 'HomieHouse',
        },
      ],
    };
  }
}

// Export singleton instance
export const pinataService = new PinataService();
export default pinataService;