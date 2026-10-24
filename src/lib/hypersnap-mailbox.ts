/**
 * Capability discovery for the Hypersnap encrypted mailbox protocol.
 *
 * Mail traffic must go only to the selected primary node. It must not use the
 * public-node fallback used for feeds, since that could split a conversation
 * across nodes or disclose mailbox metadata to a different operator.
 */

const HYPERSNAP_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_HYPERSNAP_URL) ||
  'https://haatz.quilibrium.com';
const MAILBOX_NODE_STORAGE_KEY = 'hh_hypersnap_mailbox_node_v1';

export const HYPERSNAP_MAILBOX_PROTOCOL = 'hypersnap.mailbox.v1';

export type HypersnapMailboxCapability = {
  protocol: typeof HYPERSNAP_MAILBOX_PROTOCOL;
  enabled: boolean;
  capabilities?: {
    encryptedEnvelopes?: boolean;
    inboxCursor?: boolean;
    deviceKeys?: boolean;
    liveUpdates?: boolean;
  };
};

export type MailboxAvailability =
  | { available: true; capability: HypersnapMailboxCapability }
  | { available: false; reason: 'unsupported' | 'unreachable' | 'invalid-response' };

function normalizeNodeUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const isLocalHttp = url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]');
    if (url.protocol !== 'https:' && !isLocalHttp) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

/** Resolve the browser-local mailbox node override, then the app's primary. */
export function getMailboxNodeUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(MAILBOX_NODE_STORAGE_KEY);
      if (saved) {
        const normalized = normalizeNodeUrl(saved);
        if (normalized) return normalized;
      }
    } catch { /* Use the app's configured primary node when browser storage is unavailable. */ }
  }
  return HYPERSNAP_BASE.replace(/\/+$/, '');
}

/** Store a mailbox node URL only in this browser. */
export function saveMailboxNodeUrl(value: string): boolean {
  const normalized = normalizeNodeUrl(value);
  if (!normalized || typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(MAILBOX_NODE_STORAGE_KEY, normalized);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect mailbox support on the configured primary Hypersnap node.
 * Fail closed: no other node is queried and no legacy DM service is used.
 */
export async function probeHypersnapMailbox(): Promise<MailboxAvailability> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${getMailboxNodeUrl()}/v1/hypersnap/mailbox/capabilities`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });

    if (response.status === 404 || response.status === 501) {
      return { available: false, reason: 'unsupported' };
    }
    if (!response.ok) return { available: false, reason: 'unreachable' };

    const payload = await response.json() as Partial<HypersnapMailboxCapability>;
    if (payload.protocol !== HYPERSNAP_MAILBOX_PROTOCOL || typeof payload.enabled !== 'boolean') {
      return { available: false, reason: 'invalid-response' };
    }
    if (!payload.enabled) return { available: false, reason: 'unsupported' };

    return { available: true, capability: payload as HypersnapMailboxCapability };
  } catch {
    return { available: false, reason: 'unreachable' };
  } finally {
    clearTimeout(timeout);
  }
}
