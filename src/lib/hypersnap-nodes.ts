/**
 * Server-side Hypersnap node selection with failover.
 *
 * Every server route that talks to a Hypersnap node directly uses the same
 * order the cast-submission path already uses:
 *
 *   1. The operator's personal node — MY_HYPERSNAP_NODE_URL (legacy aliases
 *      HYPERSNAP_NODE_URL, SNAPCHAIN_NODE_URL). It serves signer lookups
 *      (/v1/signer, /v1/signersByFid) and accepts KEY_ADD signer
 *      registrations through /v1/submitMessage, not just casts.
 *   2. NEXT_PUBLIC_HYPERSNAP_URL, when it names a different node.
 *   3. HYPERSNAP_FALLBACK_URL (legacy SNAPCHAIN_FALLBACK_URL), defaulting to
 *      haatz.quilibrium.com.
 *
 * A node is skipped when it times out, cannot be reached, answers 5xx/429,
 * or reports itself busy. A 404 from the personal node also moves on, because
 * its reverse proxy (rpc.homiehouse.xyz) may not route every path. Any other
 * answer is returned as the authoritative result, so a real rejection from
 * a healthy node is never retried elsewhere.
 *
 * Never import this from browser code: it reads private node URLs and the
 * personal node's write key.
 */

export const DEFAULT_HYPERSNAP_URL = 'https://haatz.quilibrium.com';

const WRITE_KEY_HEADER = 'x-homiehouse-key';
const BUSY_RESPONSE = /\bunavailable\b|mempool|x-err-code"?\s*:\s*"?unavailable/i;

export interface HypersnapNode {
  url: string;
  /** True for the operator's own node (receives the HYPERSNAP_WRITE_KEY header). */
  personal: boolean;
}

function cleanUrl(value: string | undefined | null): string | null {
  const url = value?.trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '');
  return url || null;
}

/** Ordered, de-duplicated list of nodes to try: personal → configured public → fallback. */
export function getHypersnapNodes(): HypersnapNode[] {
  const personal =
    cleanUrl(process.env.MY_HYPERSNAP_NODE_URL) ||
    cleanUrl(process.env.HYPERSNAP_NODE_URL) ||
    cleanUrl(process.env.SNAPCHAIN_NODE_URL);
  const configured = cleanUrl(process.env.NEXT_PUBLIC_HYPERSNAP_URL);
  const fallback =
    cleanUrl(process.env.HYPERSNAP_FALLBACK_URL) ||
    cleanUrl(process.env.SNAPCHAIN_FALLBACK_URL) ||
    DEFAULT_HYPERSNAP_URL;

  const urls = [...new Set([personal, configured, fallback].filter((u): u is string => !!u))];
  return urls.map((url) => ({ url, personal: !!personal && url === personal && url !== DEFAULT_HYPERSNAP_URL }));
}

async function shouldTryNextNode(response: Response, node: HypersnapNode): Promise<boolean> {
  if (response.status >= 500 || response.status === 429) return true;
  if (node.personal && response.status === 404) return true;
  if (response.ok) return false;
  try {
    return BUSY_RESPONSE.test(await response.clone().text());
  } catch {
    return false;
  }
}

export interface HypersnapNodeFetchOptions extends Omit<RequestInit, 'signal'> {
  /** Per-node timeout in ms. Default 8 000. */
  timeoutMs?: number;
  /** Restrict to specific nodes, e.g. to keep paginating on the node that issued a page token. */
  nodes?: HypersnapNode[];
  /** Log prefix for failover warnings. */
  label?: string;
}

export interface HypersnapNodeResult {
  response: Response;
  node: HypersnapNode;
}

/**
 * Fetch `path` (e.g. "/v1/signer?fid=1&signer=ab…") from the first healthy
 * node. Throws only when every node failed at the network level; otherwise
 * returns the last node's response so callers can surface its status.
 */
export async function fetchFromHypersnapNodes(
  path: string,
  options: HypersnapNodeFetchOptions = {},
): Promise<HypersnapNodeResult> {
  const { timeoutMs = 8_000, nodes = getHypersnapNodes(), label = 'hypersnap', headers, ...init } = options;
  const writeKey = process.env.HYPERSNAP_WRITE_KEY?.trim();
  let lastError: unknown;

  for (const [index, node] of nodes.entries()) {
    const isLast = index === nodes.length - 1;
    const requestHeaders = new Headers(headers);
    if (!requestHeaders.has('accept')) requestHeaders.set('accept', 'application/json');
    if (node.personal && writeKey) requestHeaders.set(WRITE_KEY_HEADER, writeKey);

    try {
      const response = await fetch(`${node.url}${path}`, {
        cache: 'no-store',
        ...init,
        headers: requestHeaders,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (isLast || !(await shouldTryNextNode(response, node))) return { response, node };
      console.warn(`[${label}] ${node.personal ? 'personal' : 'public'} Hypersnap node answered ${response.status}; trying next node`);
    } catch (error) {
      lastError = error;
      if (isLast) break;
      console.warn(
        `[${label}] ${node.personal ? 'personal' : 'public'} Hypersnap node unavailable; trying next node:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  throw new HypersnapUnavailableError(lastError);
}

/** Every node timed out or was unreachable. */
export class HypersnapUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Hypersnap nodes did not respond in time. Try again in a moment.');
    this.name = 'HypersnapUnavailableError';
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}
