/** Shared server-side transport for immediate and scheduled signed messages. */
import { getExtraFallbackUrls, markNodeHealthy, markNodeUnhealthy, preferHealthy } from './hypersnap-nodes';

const DEFAULT_HYPERSNAP_URL = 'https://haatz.quilibrium.com';
const HYPERSNAP_WRITE_BASE =
  process.env.MY_HYPERSNAP_NODE_URL?.trim() ||
  process.env.HYPERSNAP_NODE_URL?.trim() ||
  process.env.SNAPCHAIN_NODE_URL?.trim() ||
  process.env.NEXT_PUBLIC_HYPERSNAP_URL ||
  DEFAULT_HYPERSNAP_URL;
const HYPERSNAP_WRITE_FALLBACK =
  process.env.HYPERSNAP_FALLBACK_URL?.trim() ||
  process.env.SNAPCHAIN_FALLBACK_URL?.trim() ||
  DEFAULT_HYPERSNAP_URL;
/**
 * Optional shared secret sent only to the personal node, so its reverse proxy
 * can exempt HomieHouse's server-side writes from per-IP rate limits. Never
 * sent to the fallback (haatz).
 */
const HYPERSNAP_WRITE_KEY = process.env.HYPERSNAP_WRITE_KEY?.trim();
const HYPERSNAP_WRITE_KEY_HEADER = 'x-homiehouse-key';
const PERSONAL_WRITE_BASE = HYPERSNAP_WRITE_BASE.replace(/\/+$/, '');
/** Per-node and overall time limits for one submission. */
const NODE_TIMEOUT_MS = 10_000;
const TOTAL_TIMEOUT_MS = 25_000;

/** Personal node, then haatz, then any HYPERSNAP_FALLBACK_URLS; recently failed nodes last. */
function writeTargets(): string[] {
  const targets = [...new Set([HYPERSNAP_WRITE_BASE, HYPERSNAP_WRITE_FALLBACK, ...getExtraFallbackUrls()]
    .map((url) => url.replace(/\/+$/, ''))
    .filter(Boolean))];
  return preferHealthy(targets, (url) => url);
}

/**
 * Hypersnap (like Snapchain) reports a busy node — full mempool, still syncing,
 * shedding load — as a gRPC `Unavailable` status, which its HTTP API can return
 * with a 4xx code. That rejection says nothing about the message itself, so the
 * identical signed bytes are safe to send to the fallback node.
 */
const TRANSIENT_REJECTION = /\bunavailable\b|mempool|x-err-code"?\s*:\s*"?unavailable/i;

export function isNodeBusyMessage(text: string | undefined | null): boolean {
  return typeof text === 'string' && TRANSIENT_REJECTION.test(text);
}

export const NODE_BUSY_USER_MESSAGE =
  "Hypersnap is busy right now, so your cast wasn't posted. Your text is still here—try again in a moment.";

async function isTransientRejection(response: Response): Promise<boolean> {
  if (response.status >= 500 || response.status === 429) return true;
  if (response.ok) return false;
  try {
    return TRANSIENT_REJECTION.test(await response.clone().text());
  } catch {
    return false;
  }
}

export async function submitHypersnapMessage(messageBytes: ArrayBuffer): Promise<Response> {
  let lastError: unknown;
  const targets = writeTargets();
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;

  for (const [index, baseUrl] of targets.entries()) {
    const remaining = deadline - Date.now();
    if (remaining < 1_000) break;
    const isLast = index === targets.length - 1;
    try {
      const response = await fetch(`${baseUrl}/v1/submitMessage`, {
        method: 'POST',
        headers: {
          'content-type': 'application/octet-stream',
          accept: 'application/json',
          // The write key goes only to the personal node, never to haatz or other operators.
          ...(HYPERSNAP_WRITE_KEY && baseUrl === PERSONAL_WRITE_BASE && baseUrl !== DEFAULT_HYPERSNAP_URL
            ? { [HYPERSNAP_WRITE_KEY_HEADER]: HYPERSNAP_WRITE_KEY }
            : {}),
        },
        body: messageBytes.slice(0),
        signal: AbortSignal.timeout(Math.min(NODE_TIMEOUT_MS, remaining)),
      });

      const transient = await isTransientRejection(response);
      if (transient) markNodeUnhealthy(baseUrl);
      else markNodeHealthy(baseUrl);
      if (isLast || !transient) return response;

      // Log the node's own reason (e.g. "mempool channel is full" vs "Error adding
      // to mempool") so a node problem can be told apart from a client one.
      const reason = await response.clone().text().catch(() => '');
      console.warn(
        `[submit-cast] Hypersnap node ${baseUrl} returned ${response.status} (node busy/unavailable); trying next node. Node said: ${reason.slice(0, 300)}`,
      );
    } catch (error) {
      lastError = error;
      markNodeUnhealthy(baseUrl);
      if (isLast) throw error;
      console.warn(`[submit-cast] Hypersnap node ${baseUrl} unavailable; trying next node:`, error instanceof Error ? error.message : error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No Hypersnap write target answered in time');
}
