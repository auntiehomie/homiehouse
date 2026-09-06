import { buildJfs, type JfsParams } from './snap-jfs';

export interface JfsClientOptions {
  snapUrl: string;
  fid?: number;
  privateKeyHex?: string;
  surface?: 'cast' | 'standalone';
}

export interface JfsClient {
  call<T = unknown>(inputs: Record<string, unknown>): Promise<T>;
  callGet<T = unknown>(endpoint: string): Promise<T>;
}

/**
 * Create a JFS-authenticated client for interacting with a Farcaster Snap.
 *
 * Signed calls (POST) require fid + privateKeyHex; unauthenticated GETs
 * work without them.
 */
export function createJfsClient(options: JfsClientOptions): JfsClient {
  const { snapUrl, fid, privateKeyHex, surface = 'standalone' } = options;

  async function call<T = unknown>(inputs: Record<string, unknown>): Promise<T> {
    if (fid == null || !privateKeyHex) {
      throw new Error('JFS: fid and privateKeyHex are required for signed calls');
    }

    const jfsParams: JfsParams = {
      fid,
      privateKeyHex,
      inputs,
      snapUrl,
      surface,
    };

    const token = buildJfs(jfsParams);

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    };

    const res = await fetch(snapUrl, { method: 'POST', headers, body: JSON.stringify(inputs) });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`JFS call failed (${res.status}): ${text}`);
    }

    try {
      return (await res.json()) as T;
    } catch {
      // Some snaps may return non-JSON success bodies
      return undefined as unknown as T;
    }
  }

  async function callGet<T = unknown>(endpoint: string): Promise<T> {
    const url = new URL(snapUrl);
    url.pathname = endpoint;

    const res = await fetch(url.toString(), {
      headers: { accept: 'application/json' },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`JFS GET failed (${res.status}): ${text}`);
    }

    try {
      return (await res.json()) as T;
    } catch {
      return undefined as unknown as T;
    }
  }

  return { call, callGet };
}