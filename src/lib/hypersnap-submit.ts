/** Shared server-side transport for immediate and scheduled signed messages. */
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
const HYPERSNAP_WRITE_TARGETS = [...new Set([HYPERSNAP_WRITE_BASE, HYPERSNAP_WRITE_FALLBACK]
  .map((url) => url.replace(/\/+$/, ''))
  .filter(Boolean))];

export async function submitHypersnapMessage(messageBytes: ArrayBuffer): Promise<Response> {
  let lastError: unknown;

  for (const [index, baseUrl] of HYPERSNAP_WRITE_TARGETS.entries()) {
    try {
      const response = await fetch(`${baseUrl}/v1/submitMessage`, {
        method: 'POST',
        headers: {
          'content-type': 'application/octet-stream',
          accept: 'application/json',
        },
        body: messageBytes.slice(0),
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok || response.status < 500 || index === HYPERSNAP_WRITE_TARGETS.length - 1) {
        return response;
      }

      console.warn(`[submit-cast] primary Hypersnap node returned ${response.status}; trying fallback`);
    } catch (error) {
      lastError = error;
      if (index === HYPERSNAP_WRITE_TARGETS.length - 1) throw error;
      console.warn('[submit-cast] primary Hypersnap node unavailable; trying fallback:', error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No Hypersnap write target is configured');
}
