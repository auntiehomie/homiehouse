/**
 * Piñata — combined IPFS storage + Farcaster API connector.
 *
 * Farcaster functions at the bottom of this file are now thin re-exports
 * delegating to src/lib/hypersnap.ts, which replaced the Pinata Farcaster API.
 * The IPFS storage class (PinataService) remains completely unchanged.
 *
 * See docs/HYPERSNAP_MIGRATION.md for full migration details.
 */

import pinataSDK from '@pinata/sdk';
import { pinataConfig } from '@/config/web3';
import { Web3Error } from '@/config/web3';

// ─── IPFS-only fetch (kept for PinataService internals) ──────────────────────

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
 * Kept for backward compat; Farcaster reads now go through hypersnap.ts.
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

// ─── Farcaster API — delegated to Hypersnap ──────────────────────────────────
//
// All Farcaster social reads/writes are now served by hypersnap.ts.
// These re-exports maintain 100 % API compatibility for existing callers.

export {
  hypersnapFetch as neynarFetch,
  publishCast,
  publishReaction,
  deleteReaction,
  fetchFeed,
  fetchTrendingFeed,
  fetchUserByUsername,
  fetchCast,
  fetchUserChannels,
  fetchChannelList,
  fetchFollowing,
  fetchNotifications,
  searchUsers,
  searchCasts,
  getCastsByUsername,
} from './hypersnap';

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
